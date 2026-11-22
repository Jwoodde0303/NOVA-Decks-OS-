import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { buildCompanyContext, listUserCompanies, type CompanyContext } from "@/modules/core/context";
import { AppError, ForbiddenError, NotFoundError, UnauthorizedError } from "@/modules/core/errors";

export async function getSessionUser() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

/** For pages: resolves the signed-in user's membership in the company slug or redirects/404s. */
export async function requireCompanyContext(slug: string): Promise<CompanyContext> {
  const user = await getSessionUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(`/c/${slug}`)}`);
  try {
    return await buildCompanyContext(user.id, slug);
  } catch (e) {
    if (e instanceof ForbiddenError || e instanceof UnauthorizedError) notFound();
    throw e;
  }
}

export async function requireUserCompanies() {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  return { user, companies: await listUserCompanies(user.id) };
}

/** For route handlers: returns a context or a JSON error response (never throws through Next). */
export async function apiCompanyContext(slug: string): Promise<CompanyContext | Response> {
  const user = await getSessionUser();
  try {
    return await buildCompanyContext(user?.id, slug);
  } catch (e) {
    return errorResponse(e);
  }
}

export function errorResponse(e: unknown): Response {
  if (e instanceof NotFoundError || e instanceof ForbiddenError) {
    // Collapse "not yours" and "does not exist" to avoid leaking existence across companies.
    return Response.json({ error: "not_found", message: "Not found" }, { status: 404 });
  }
  if (e instanceof AppError) {
    return Response.json({ error: e.code, message: e.message, issues: "issues" in e ? e.issues : undefined }, { status: e.status });
  }
  console.error(e);
  return Response.json({ error: "internal", message: "Something went wrong" }, { status: 500 });
}
