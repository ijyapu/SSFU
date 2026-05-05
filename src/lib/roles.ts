import type { AppRole } from "@/types/globals";

// Role hierarchy — higher index = more permissions
const ROLE_HIERARCHY: AppRole[] = ["employee", "accountant", "manager", "admin", "superadmin"];

// Which roles can access each sensitive area (superadmin bypasses all checks via hasPermission)
export const ROLE_PERMISSIONS = {
  payroll:      ["admin", "accountant"] as AppRole[],
  profitLoss:   ["admin", "manager", "accountant"] as AppRole[],
  employees:    ["admin", "manager"] as AppRole[],
  expenses:     ["admin", "manager", "accountant", "employee"] as AppRole[],
  costing:      ["admin", "manager", "accountant"] as AppRole[],
  purchases:    ["admin", "manager", "accountant"] as AppRole[],
  sales:        ["admin", "manager", "accountant"] as AppRole[],
  inventory:    ["admin", "manager", "accountant"] as AppRole[],
  adminOverride:["admin"] as AppRole[],
  settings:     ["admin"] as AppRole[],
  reports:      ["admin", "manager", "accountant"] as AppRole[],
  receipts:     ["admin", "manager", "accountant"] as AppRole[],
  cashFlow:     ["admin", "manager", "accountant"] as AppRole[],
} as const;

export type PermissionKey = keyof typeof ROLE_PERMISSIONS;

/** Check if a role has access to a given permission area. Superadmin bypasses all checks. */
export function hasPermission(role: AppRole | undefined | null, permission: PermissionKey): boolean {
  if (!role) return false;
  if (role === "superadmin") return true;
  return (ROLE_PERMISSIONS[permission] as AppRole[]).includes(role);
}

/** Check if role is at least as privileged as the minimum required role */
export function hasMinRole(role: AppRole | undefined | null, minRole: AppRole): boolean {
  if (!role) return false;
  return ROLE_HIERARCHY.indexOf(role) >= ROLE_HIERARCHY.indexOf(minRole);
}

/** Routes that require specific roles — used in middleware */
export const ROLE_PROTECTED_ROUTES: { pattern: RegExp; allowed: AppRole[] }[] = [
  { pattern: /^\/payroll(\/.*)?$/, allowed: ROLE_PERMISSIONS.payroll },
  { pattern: /^\/profit-loss(\/.*)?$/, allowed: ROLE_PERMISSIONS.profitLoss },
  { pattern: /^\/employees(\/.*)?$/, allowed: ROLE_PERMISSIONS.employees },
  { pattern: /^\/costing\/recipes(\/.*)?$/, allowed: ROLE_PERMISSIONS.adminOverride },
  { pattern: /^\/costing(\/.*)?$/, allowed: ROLE_PERMISSIONS.costing },
  { pattern: /^\/purchases(\/.*)?$/, allowed: ROLE_PERMISSIONS.purchases },
  { pattern: /^\/sales(\/.*)?$/, allowed: ROLE_PERMISSIONS.sales },
  { pattern: /^\/inventory(\/.*)?$/, allowed: ROLE_PERMISSIONS.inventory },
  { pattern: /^\/api\/admin(\/.*)?$/, allowed: ROLE_PERMISSIONS.adminOverride },
  { pattern: /^\/settings(\/.*)?$/,  allowed: ROLE_PERMISSIONS.settings },
  { pattern: /^\/reports(\/.*)?$/,   allowed: ROLE_PERMISSIONS.reports },
  { pattern: /^\/receipts(\/.*)?$/, allowed: ROLE_PERMISSIONS.receipts },
  { pattern: /^\/cash-flow(\/.*)?$/, allowed: ROLE_PERMISSIONS.cashFlow },
];
