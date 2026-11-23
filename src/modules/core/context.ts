import { and, eq } from "drizzle-orm";
import { getDb, type Db } from "@/db/client";
import { companies, memberships, type Role } from "@/db/schema";
import { ForbiddenError, UnauthorizedError } from "./errors";
import { assertCan, roleCan, type Permission } from "./permissions";

/**
 * Everything a service needs to act on behalf of a user inside one company.
 * Built only on the server from a verified session + membership row; never from client input.
 */
export interface CompanyContext {
  readonly db: Db;
  readonly companyId: string;
  readonly companySlug: string;
  readonly companyName: string;
  readonly userId: string;
  readonly role: Role;
  can(permission: Permission): boolean;
  require(permission: Permission): void;
}

export async function buildCompanyContext(
  userId: string | null | undefined,
  companySlug: string,
  db: Db = getDb(),
): Promise<CompanyContext> {
  if (!userId) throw new UnauthorizedError();
  const [row] = await db
    .select({
      companyId: companies.id,
      companyName: companies.name,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(companies, eq(companies.id, memberships.companyId))
    .where(and(eq(memberships.userId, userId), eq(companies.slug, companySlug)))
    .limit(1);
  if (!row) throw new ForbiddenError("You are not a member of this workspace");
  return {
    db,
    companyId: row.companyId,
    companySlug,
    companyName: row.companyName,
    userId,
    role: row.role,
    can: (p) => roleCan(row.role, p),
    require: (p) => assertCan(row.role, p),
  };
}

export async function listUserCompanies(userId: string, db: Db = getDb()) {
  return db
    .select({ id: companies.id, slug: companies.slug, name: companies.name, role: memberships.role })
    .from(memberships)
    .innerJoin(companies, eq(companies.id, memberships.companyId))
    .where(eq(memberships.userId, userId))
    .orderBy(companies.name);
}
