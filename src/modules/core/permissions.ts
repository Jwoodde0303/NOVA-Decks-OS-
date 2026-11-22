import type { Role } from "@/db/schema";
import { ForbiddenError } from "./errors";

/**
 * Role capabilities. Documented in docs/ROLES.md; this is the single source of truth
 * that services call through `ctx.require(...)`.
 */
export const PERMISSIONS = {
  "crm.read": ["owner_admin", "member"],
  "crm.write": ["owner_admin", "member"],
  "crm.delete": ["owner_admin"],
  "crm.export": ["owner_admin", "member"],
  "crm.convert_job": ["owner_admin"],
  "design.write": ["owner_admin", "member"],
  "estimate.write": ["owner_admin", "member"],
  "pricing.manage": ["owner_admin"],
  "company.manage_members": ["owner_admin"],
  "company.manage_settings": ["owner_admin"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function roleCan(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export function assertCan(role: Role, permission: Permission): void {
  if (!roleCan(role, permission)) throw new ForbiddenError(`Requires permission "${permission}"`);
}
