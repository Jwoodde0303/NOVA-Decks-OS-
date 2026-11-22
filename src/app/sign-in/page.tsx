import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/request-context";
import { SignInForm } from "./SignInForm";

export const metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getSessionUser()) redirect(next && next.startsWith("/") ? next : "/");
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-[400px]">
        <div className="mb-8">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] bg-ink font-display text-[18px] font-bold text-paper">N</div>
          <h1 className="text-[26px]">Sign in to NOVA Decks OS</h1>
          <p className="mt-1 text-[14px] text-ink-2">CRM, deck design and estimating in one workspace.</p>
        </div>
        <div className="card p-5">
          <SignInForm next={next && next.startsWith("/") ? next : "/"} />
        </div>
        <p className="mt-6 text-center text-[12px] text-ink-3">Access is by invitation from your company&apos;s owner.</p>
      </div>
    </main>
  );
}
