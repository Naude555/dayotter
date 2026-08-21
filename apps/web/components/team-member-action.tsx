"use client";

import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { LogOut, UserMinus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function TeamMemberAction({
  teamId,
  memberId,
  name,
  leaving,
}: {
  teamId: string;
  memberId: string;
  name: string;
  leaving: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    const res = await fetch(`/api/teams/${teamId}/members/${memberId}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      toast({
        title: leaving ? "Couldn't leave the team" : "Couldn't remove that member",
        description: data.error,
        variant: "error",
      });
      return;
    }
    setOpen(false);
    toast({
      title: leaving ? "You left the team" : `${name} was removed`,
      variant: "success",
    });
    if (leaving) router.push("/teams");
    else router.refresh();
  }

  const Icon = leaving ? LogOut : UserMinus;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-[var(--color-faint)] transition-colors hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
      >
        <Icon size={14} /> {leaving ? "Leave" : "Remove"}
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={remove}
        title={leaving ? "Leave this team?" : `Remove ${name}?`}
        description={
          leaving
            ? "You'll lose access to the team calendar and team booking links."
            : "They'll lose access to this team and will no longer host its booking links."
        }
        confirmLabel={leaving ? "Leave team" : "Remove member"}
        danger
        loading={busy}
      />
    </>
  );
}
