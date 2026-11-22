import Link from "next/link";
import { requireUserCompanies } from "@/lib/request-context";
import { SignOutButton } from "@/components/SignOutButton";

export const metadata = { title: "Workspaces" };

export default async function WorkspacesPage() {
  const { user, companies } = await requireUserCompanies();
  return (
    <main className="mx-auto max-w-[640px] p-6 pt-16">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <div className="mb-1 text-[12px] font-medium uppercase tracking-[0.1em] text-ink-3">Signed in as {user.email}</div>
          <h1 className="text-[26px]">Choose a workspace</h1>
        </div>
        <SignOutButton />
      </div>
      {companies.length === 0 ? (
        <div className="card p-6 text-[14px] text-ink-2">You are not a member of any company workspace yet. Ask a company owner to add you.</div>
      ) : (
        <ul className="space-y-2">
          {companies.map((c) => (
            <li key={c.id}>
              <Link href={`/c/${c.slug}`} className="card flex items-center justify-between px-5 py-4 transition hover:border-line-strong">
                <span className="text-[16px] font-medium">{c.name}</span>
                <span className="text-[12px] uppercase tracking-[0.08em] text-ink-3">{c.role === "owner_admin" ? "Owner / Admin" : "Team member"}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
