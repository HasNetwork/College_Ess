import { z } from "zod";

export const UserRoleSchema = z.enum(["student", "co_admin", "college_admin", "platform_admin"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const ScopeTypeSchema = z.enum(["platform", "college", "club"]);
export type ScopeType = z.infer<typeof ScopeTypeSchema>;

export interface GrantRecord {
  id?: string;
  userId: string;
  permission: string;
  scopeType: ScopeType;
  scopeId: string | null;
  grantedBy?: string | null;
  expiresAt?: Date | null;
  deletedAt?: Date | null;
}

export interface Ctx {
  userId: string;
  collegeId: string | null;
  role: UserRole;
  grants: GrantRecord[]; // non-expired, non-deleted
  userMode: boolean; // admin browsing as an ordinary student
}

export interface Scope {
  type: ScopeType;
  id?: string | null;
}

/**
 * Check if a grant is currently active (not soft-deleted and not expired).
 */
export function isGrantActive(grant: GrantRecord, now: Date = new Date()): boolean {
  if (!grant) return false;
  if (grant.deletedAt) return false;
  if (grant.expiresAt && grant.expiresAt.getTime() <= now.getTime()) return false;
  return true;
}

/**
 * Placeholder club-to-college resolver.
 * Clubs do not exist until Phase 4, so this returns null by default
 * unless provided via options.
 */
export function resolveClubCollege(_clubId: string): string | null {
  return null;
}

export interface CanOptions {
  resolveClubCollege?: (clubId: string) => string | null;
  now?: Date;
}

/**
 * Scoped permission check per PLAN.md §6 and 0-4-permissions-tenancy.md §3.
 *
 * Rules, in order:
 * 1. platform_admin with a platform-scoped grant passes everything.
 * 2. A grant matches if permission, scope_type and scope_id all match and it has not expired.
 * 3. A college-scoped grant implies authority over clubs within that college —
 *    resolve the club's college before deciding. Do not let a co-admin of college A
 *    manage a club in college B because the permission string happened to match.
 * 4. userMode collapses the effective role to student before any of the above,
 *    suppressing every elevated grant for that request.
 *
 * This function NEVER throws; it returns false for any invalid or unpermitted request.
 */
export function can(
  ctx: Ctx | null | undefined,
  permission: string,
  targetScope: Scope,
  options?: CanOptions,
): boolean {
  try {
    if (
      !ctx ||
      !permission ||
      typeof permission !== "string" ||
      !targetScope ||
      !targetScope.type
    ) {
      return false;
    }

    // Rule 4: userMode collapses effective role to student and suppresses elevated grants
    if (ctx.userMode === true) {
      return false;
    }

    const now = options?.now ?? new Date();
    const effectiveGrants = (ctx.grants || []).filter((g) => isGrantActive(g, now));

    // Rule 1: platform_admin with a platform-scoped grant passes everything
    if (ctx.role === "platform_admin") {
      const hasPlatformGrant = effectiveGrants.some((g) => g.scopeType === "platform");
      if (hasPlatformGrant) {
        return true;
      }
    }

    const clubCollegeResolver = options?.resolveClubCollege ?? resolveClubCollege;

    // Rule 2 & 3: Check matching grants
    for (const g of effectiveGrants) {
      // Permission match: exact match or wildcard "*"
      const permissionMatches = g.permission === "*" || g.permission === permission;
      if (!permissionMatches) {
        continue;
      }

      // Check scope match
      if (g.scopeType === "platform") {
        // Platform grant for this permission covers all scopes
        return true;
      }

      if (g.scopeType === "college") {
        if (targetScope.type === "college") {
          if (g.scopeId === targetScope.id) {
            return true;
          }
        } else if (targetScope.type === "club") {
          // Rule 3: college-scoped grant implies authority over clubs within that college
          if (targetScope.id) {
            const clubCollegeId = clubCollegeResolver(targetScope.id);
            if (clubCollegeId && clubCollegeId === g.scopeId) {
              return true;
            }
          }
        }
      }

      if (g.scopeType === "club") {
        if (targetScope.type === "club" && targetScope.id && g.scopeId === targetScope.id) {
          return true;
        }
      }
    }

    return false;
  } catch {
    // Fail closed, never throw
    return false;
  }
}

export interface RoleChangeEvent {
  subject: string; // userId
  scopeType: ScopeType;
  scopeId: string | null;
  newRole: UserRole;
  grantedBy?: string | null;
}

export interface GrantToIssue {
  userId: string;
  permission: string;
  scopeType: ScopeType;
  scopeId: string | null;
  grantedBy: string | null;
}

/**
 * Compute the default grants to be issued when a role change occurs.
 */
export function computeGrantsForRole(event: RoleChangeEvent): GrantToIssue[] {
  const { subject, scopeType, scopeId, newRole, grantedBy = null } = event;
  switch (newRole) {
    case "platform_admin":
      return [
        {
          userId: subject,
          permission: "*",
          scopeType: "platform",
          scopeId: null,
          grantedBy,
        },
      ];
    case "college_admin":
      return [
        {
          userId: subject,
          permission: "manage:college",
          scopeType: "college",
          scopeId,
          grantedBy,
        },
      ];
    case "co_admin":
      return [
        {
          userId: subject,
          permission: "manage:club",
          scopeType,
          scopeId,
          grantedBy,
        },
      ];
    default:
      return [];
  }
}
