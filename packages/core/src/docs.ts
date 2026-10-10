import type { UserRole } from "./permissions.js";

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  student: 1,
  co_admin: 2,
  college_admin: 3,
  platform_admin: 4,
};

export function isRoleSufficient(viewerRole: string, minRole: string): boolean {
  const viewerRank = ROLE_HIERARCHY[viewerRole as UserRole] ?? 1;
  const minRank = ROLE_HIERARCHY[minRole as UserRole] ?? 1;
  return viewerRank >= minRank;
}

export interface DocRecord {
  id?: string;
  collegeId: string | null;
  slug: string;
  title: string;
  bodyMd: string;
  audience: "user" | "co_admin" | "admin";
  kind: "guide" | "faq" | "changelog";
  orderIndex: number;
  minRole: "student" | "co_admin" | "college_admin" | "platform_admin";
  published: boolean;
  deletedAt?: Date | null;
}

/**
 * Resolution helper per PLAN 0-9 §1:
 * resolveDoc(slug, collegeId, viewerRole)
 *   -> college-specific row, else platform default, else null
 *   -> filtered by published = true AND viewerRole >= min_role
 */
export function resolveDocFromList(
  docsList: readonly DocRecord[],
  slug: string,
  collegeId: string | null | undefined,
  viewerRole = "student",
): DocRecord | null {
  // Filter matching slug, active, published, and viewerRole >= minRole
  const eligible = docsList.filter(
    (doc) =>
      doc.slug === slug &&
      !doc.deletedAt &&
      doc.published &&
      isRoleSufficient(viewerRole, doc.minRole),
  );

  // College-specific override wins first
  if (collegeId) {
    const collegeDoc = eligible.find((doc) => doc.collegeId === collegeId);
    if (collegeDoc) return collegeDoc;
  }

  // Fallback to platform default (collegeId is null)
  const platformDoc = eligible.find((doc) => doc.collegeId === null || doc.collegeId === undefined);
  if (platformDoc) return platformDoc;

  return null;
}
