"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, exact = false, children }: { href: string; exact?: boolean; children: React.ReactNode }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={`block rounded-[var(--radius-sm)] px-3 py-1.5 text-[14px] font-medium transition ${
        active ? "bg-surface text-ink shadow-[var(--shadow-card)]" : "text-ink-2 hover:bg-surface/70 hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}
