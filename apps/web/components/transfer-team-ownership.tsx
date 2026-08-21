"use client";

import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { Crown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function TransferTeamOwnership({
  teamId,
  memberId,
  name,
}: {
  teamId: string;
  memberId: string;
  name: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function transfer() {
    setBusy(true);
    const res = await fetch(`/api/teams/${teamId}/members/${memberId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "owner" }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      toast({ title: "Couldn't transfer ownership", description: data.error, variant: "error" });
      return;
    }
    setOpen(false);
    toast({ title: `${name} is now the team owner`, variant: "success" });
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-[var(--color-faint)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
      >
        <Crown size={14} /> Make owner
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={transfer}
        title={`Make ${name} the team owner?`}
        description="You'll become an admin. You can then leave the team if you need to."
        confirmLabel="Transfer ownership"
        loading={busy}
      />
    </>
  );
}
