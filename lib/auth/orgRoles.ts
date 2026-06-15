export type OrgRole = "owner" | "admin" | "member" | "viewer";
export type Permission =
  | "billing"
  | "manage_users"
  | "delete_org"
  | "manage_websites"
  | "run_scans"
  | "view_scans"
  | "view_reports";

const ROLE_PERMISSIONS: Record<OrgRole, Permission[]> = {
  owner: [
    "billing",
    "manage_users",
    "delete_org",
    "manage_websites",
    "run_scans",
    "view_scans",
    "view_reports",
  ],
  admin: ["billing", "manage_websites", "run_scans", "view_scans", "view_reports"],
  member: ["run_scans", "view_scans", "view_reports"],
  viewer: ["view_scans", "view_reports"],
};

export function hasPermission(role: OrgRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** Org owner or admin — may access enterprise controls and billing. */
export function isOrgAdminRole(role: OrgRole | string | null | undefined): boolean {
  return role === "owner" || role === "admin";
}
