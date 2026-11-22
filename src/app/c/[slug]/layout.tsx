import Link from "next/link";
import { requireCompanyContext, requireUserCompanies } from "@/lib/request-context";
import { SignOutButton } from "@/components/SignOutButton";
import { NavLink } from "@/components/NavLink";

export default async function CompanyLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireCompanyContext(slug);
  const { user, companies } = await requireUserCompanies();
  const base = `/c/${slug}`;
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-[232px] shrink-0 flex-col border-r border-line bg-paper-2/60">
        <div className="border-b border-line px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] bg-ink font-display text-[15px] font-bold text-paper">N</div>
            <div className="min-w-0">
              <div className="truncate text-[14px] font-semibold leading-tight">{ctx.companyName}</div>
              <div className="text-[11px] uppercase tracking-[0.08em] text-ink-3">{ctx.role === "owner_admin" ? "Owner / Admin" : "Team member"}</div>
            </div>
          </div>
          {companies.length > 1 && (
            <Link href="/workspaces" className="mt-3 block text-[12px] text-slate underline-offset-2 hover:underline">
              Switch workspace
            </Link>
          )}
        </div>
        <nav className="flex-1 space-y-0.5 p-2">
          <NavLink href={base} exact>
            Dashboard
          </NavLink>
          <NavLink href={`${base}/opportunities`}>Pipeline</NavLink>
          <NavLink href={`${base}/customers`}>Customers</NavLink>
          <NavLink href={`${base}/jobs`}>Jobs</NavLink>
        </nav>
        <div className="border-t border-line px-4 py-3">
          <div className="truncate text-[13px] font-medium">{user.name}</div>
          <div className="truncate text-[12px] text-ink-3">{user.email}</div>
          <div className="mt-2">
            <SignOutButton className="btn btn-ghost btn-sm -ml-3" />
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-8 py-7">
        <div className="mx-auto max-w-[1180px]">{children}</div>
      </main>
    </div>
  );
}
