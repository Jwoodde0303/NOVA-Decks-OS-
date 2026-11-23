import type { Role } from "@/db/schema";
import { ForbiddenError } from "./errors";

/**
 * Role capabilities. Documented in docs/ROLES.md; this is the single source of truth
 * that services call through `ctx.require(...)`.
 */
export const PERMISSIONS = {
  "projects.read": ["owner_admin", "member"],
  "projects.write": ["owner_admin", "member"],
  "projects.delete": ["owner_admin"],
  "design.write": ["owner_admin", "member"],
  "estimate.write": ["owner_admin", "member"],
  "estimate.export": ["owner_admin", "member"],
  "estimate.status": ["owner_admin"],
  "pricing.manage": ["owner_admin"],
  "integrations.manage": ["owner_admin"],
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
