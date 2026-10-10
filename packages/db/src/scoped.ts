import { type RoleChangeEvent, computeGrantsForRole } from "@clg-ess/core";
import { type AnyColumn, type SQL, and, eq, isNull, or, sql } from "drizzle-orm";
import { type DbClient, createDbClient } from "./client";
import { grants } from "./schema/grant";

export interface ScopeOptions {
  /**
   * Keep soft-deleted rows, to serve them as tombstones (0-5 §4). The college guard still
   * applies: a tombstone is a row too.
   */
  includeDeleted?: boolean;
}

/**
 * Builds the tenancy condition SQL for a table:
 * 1. deleted_at IS NULL (if table has deletedAt, unless options.includeDeleted)
 * 2. (college_id = ctx.collegeId OR college_id IS NULL) (if table has collegeId and ctx.collegeId is set)
 *    OR college_id IS NULL (if table has collegeId and ctx.collegeId is null)
 */
export function tenancyCondition(
  table: Record<string, unknown>,
  ctx: { collegeId: string | null },
  options: ScopeOptions = {},
): SQL | undefined {
  const hasCollegeId = Boolean(table && "collegeId" in table);
  const hasDeletedAt = Boolean(table && "deletedAt" in table);

  const conditions: (SQL | undefined)[] = [];

  if (hasDeletedAt && !options.includeDeleted) {
    conditions.push(isNull(table.deletedAt as unknown as AnyColumn));
  }

  if (hasCollegeId) {
    const col = table.collegeId as unknown as AnyColumn;
    if (ctx.collegeId) {
      conditions.push(or(eq(col, ctx.collegeId), isNull(col)));
    } else {
      conditions.push(isNull(col));
    }
  }

  if (conditions.length === 0) return undefined;
  if (conditions.length === 1) return conditions[0];
  return and(...conditions);
}

/**
 * Combines caller condition with tenancy condition so caller cannot bypass tenancy.
 */
export function scopedQuery(
  table: Record<string, unknown>,
  ctx: { collegeId: string | null },
  additionalCondition?: SQL | undefined,
): SQL {
  const guard = tenancyCondition(table, ctx);
  if (guard && additionalCondition) {
    return and(guard, additionalCondition) ?? sql`1=1`;
  }
  if (guard) {
    return guard;
  }
  if (additionalCondition) {
    return additionalCondition;
  }
  return sql`1=1`;
}

function wrapQueryBuilder(
  // biome-ignore lint/suspicious/noExplicitAny: Drizzle query proxy
  query: any,
  table: Record<string, unknown>,
  ctx: { collegeId: string | null },
  options: ScopeOptions,
  appliedConditions: SQL[] = [],
) {
  const guard = tenancyCondition(table, ctx, options);
  let guardApplied = appliedConditions.length > 0;

  const ensureGuard = () => {
    if (!guardApplied && guard) {
      query.where(guard);
      guardApplied = true;
    }
  };

  return new Proxy(query, {
    get(target, prop, receiver) {
      if (prop === "where") {
        return (callerCondition: SQL) => {
          const nextConditions = guardApplied
            ? [...appliedConditions, callerCondition]
            : guard
              ? [guard, callerCondition]
              : [callerCondition];

          const combined =
            nextConditions.length === 1 ? nextConditions[0] : (and(...nextConditions) ?? sql`1=1`);

          const nextQuery = target.where(combined);
          return wrapQueryBuilder(nextQuery, table, ctx, options, nextConditions);
        };
      }
      if (prop === "then") {
        ensureGuard();
        return target.then.bind(target);
      }
      const val = Reflect.get(target, prop, receiver);
      if (typeof val === "function") {
        return (...args: unknown[]) => {
          ensureGuard();
          const res = val.apply(target, args);
          if (res === target) {
            return receiver;
          }
          return res;
        };
      }
      return val;
    },
  });
}

/**
 * Scoped database client ensuring college-scoped reads cannot leak cross-tenant.
 * Automatically injects `college_id = ctx.collegeId` (or NULL) and `deleted_at IS NULL`
 * on the table passed to `from()`; a joined table is not guarded.
 *
 * It exposes only `select` and `selectDistinct`, typed as Drizzle's own so rows come back
 * typed. Nothing else is passed through: spreading the client used to hand out its
 * relational `query` API, which reads with no guard at all.
 */
export function scopedDb(
  ctx: { collegeId: string | null },
  client: DbClient = createDbClient(),
  options: ScopeOptions = {},
) {
  // biome-ignore lint/suspicious/noExplicitAny: polymorphic Drizzle select builder
  const guarded = (selectBuilder: any) => ({
    ...selectBuilder,
    from(table: Record<string, unknown>) {
      return wrapQueryBuilder(selectBuilder.from(table), table, ctx, options);
    },
  });
  return {
    // The proxy keeps Drizzle's builder API, so the builder's own types stay accurate.
    select: ((...args: unknown[]) =>
      // biome-ignore lint/suspicious/noExplicitAny: polymorphic Drizzle select
      guarded((client.select as any)(...args))) as unknown as DbClient["select"],
    selectDistinct: ((...args: unknown[]) =>
      // biome-ignore lint/suspicious/noExplicitAny: polymorphic Drizzle selectDistinct
      guarded((client.selectDistinct as any)(...args))) as unknown as DbClient["selectDistinct"],
  };
}

/**
 * Plain function invoked on membership or role changes to issue or revoke grants.
 * Per PLAN.md §5, does not use an event bus for one caller (Rule 2).
 */
export async function onRoleChange(db: DbClient, event: RoleChangeEvent): Promise<void> {
  const { subject, scopeType, scopeId, newRole } = event;

  if (newRole === "student") {
    // Revoke active grants for this subject and scope
    await db
      .update(grants)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(grants.userId, subject),
          eq(grants.scopeType, scopeType),
          scopeId ? eq(grants.scopeId, scopeId) : isNull(grants.scopeId),
          isNull(grants.deletedAt),
        ),
      );
    return;
  }

  const grantsToIssue = computeGrantsForRole(event);
  for (const g of grantsToIssue) {
    await db
      .insert(grants)
      .values({
        userId: g.userId,
        permission: g.permission,
        scopeType: g.scopeType,
        scopeId: g.scopeId,
        grantedBy: g.grantedBy,
      })
      .onConflictDoNothing();
  }
}
