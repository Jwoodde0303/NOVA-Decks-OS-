"use client";
import { useActionState, type ReactNode } from "react";

export type ActionState = { error?: string; issues?: string[]; ok?: boolean; seq?: number } | undefined;
export type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/** A form bound to a server action that surfaces validation errors inline. */
export function ActionForm({ action, children, className = "", submitLabel = "Save", resetOnSuccess = false }: { action: FormAction; children: ReactNode; className?: string; submitLabel?: string; resetOnSuccess?: boolean }) {
  // Each successful submit bumps `seq`; using it as the key remounts (clears) the form.
  const sequenced: FormAction = async (prev, fd) => {
    const r = await action(prev, fd);
    return r?.ok ? { ...r, seq: (prev?.seq ?? 0) + 1 } : r;
  };
  const [state, formAction, pending] = useActionState(sequenced, undefined);
  return (
    <form action={formAction} className={className} key={resetOnSuccess ? (state?.seq ?? 0) : "form"}>
      {state?.error && (
        <div className="mb-3 rounded-[var(--radius-sm)] border border-brick/30 bg-brick-soft px-3 py-2 text-[13px] text-brick">
          <div className="font-medium">{state.error}</div>
          {state.issues && state.issues.length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {state.issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {children}
      <div className="mt-4 flex items-center gap-2">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

export function InlineAction({ action, children, className = "btn btn-secondary btn-sm", confirm: confirmText }: { action: FormAction; children: ReactNode; className?: string; confirm?: string }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form
      action={formAction}
      className="inline"
      onSubmit={(e) => {
        if (confirmText && !window.confirm(confirmText)) e.preventDefault();
      }}
    >
      <button type="submit" className={className} disabled={pending} title={state?.error}>
        {children}
      </button>
      {state?.error && <span className="ml-2 text-[12px] text-brick">{state.error}</span>}
    </form>
  );
}
