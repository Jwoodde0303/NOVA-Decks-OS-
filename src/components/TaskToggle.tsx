"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toggleTaskAction } from "@/app/c/[slug]/actions";

export function TaskToggle({ slug, taskId, completed, backTo }: { slug: string; taskId: string; completed: boolean; backTo: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <input
      type="checkbox"
      className="mt-1 h-4 w-4 accent-cedar"
      checked={completed}
      disabled={pending}
      aria-label={completed ? "Reopen task" : "Complete task"}
      onChange={() =>
        start(async () => {
          await toggleTaskAction(slug, taskId, !completed, backTo);
          router.refresh();
        })
      }
    />
  );
}
