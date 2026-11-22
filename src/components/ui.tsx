import Link from "next/link";
import type { ReactNode } from "react";

export function Chip({ tone = "slate", children }: { tone?: "slate" | "cedar" | "moss" | "brick" | "amber" | "ink"; children: ReactNode }) {
  const tones = {
    slate: "border-slate/20 bg-slate-soft text-slate",
    cedar: "border-cedar/25 bg-cedar-soft text-cedar-strong",
    moss: "border-moss/25 bg-moss-soft text-moss",
    brick: "border-brick/25 bg-brick-soft text-brick",
    amber: "border-amber/25 bg-amber-soft text-amber",
    ink: "border-line bg-paper-2 text-ink-2",
  };
  return <span className={`chip ${tones[tone]}`}>{children}</span>;
}

export function stageTone(kind: string): "slate" | "moss" | "brick" {
  return kind === "won" ? "moss" : kind === "lost" ? "brick" : "slate";
}

export function PageHeader({ eyebrow, title, actions, children }: { eyebrow?: string; title: string; actions?: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
      <div>
        {eyebrow && <div className="mb-1 text-[12px] font-medium uppercase tracking-[0.1em] text-ink-3">{eyebrow}</div>}
        <h1 className="text-[28px] leading-tight">{title}</h1>
        {children && <div className="mt-2 text-[14px] text-ink-2">{children}</div>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Card({ title, aside, children, className = "" }: { title?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || aside) && (
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          {aside}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-[var(--radius-sm)] border border-dashed border-line-strong px-4 py-8 text-center text-[14px] text-ink-3">{children}</div>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      <label className="lbl">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[12px] text-ink-3">{hint}</p>}
    </div>
  );
}

export function LinkButton({ href, children, variant = "secondary" }: { href: string; children: ReactNode; variant?: "primary" | "secondary" | "ghost" }) {
  return (
    <Link href={href} className={`btn btn-${variant}`}>
      {children}
    </Link>
  );
}

export function Money({ cents }: { cents: number }) {
  return <span className="num">{(cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })}</span>;
}

export function DateText({ value }: { value: string | Date | null | undefined }) {
  if (!value) return <span className="text-ink-3">—</span>;
  const d = typeof value === "string" ? new Date(value + (value.length === 10 ? "T00:00:00" : "")) : value;
  return <span className="num">{d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>;
}

export function isOverdue(date: string | null) {
  return !!date && date < new Date().toISOString().slice(0, 10);
}
