"use client";

import { CopyLinkButton } from "@/components/copy-link-button";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { ExternalLink, Globe2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function TeamCalendarSharing({
  teamId,
  teamSlug,
  initialToken,
}: {
  teamId: string;
  teamSlug: string;
  initialToken: string | null;
}) {
  const { toast } = useToast();
  const [token, setToken] = useState(initialToken);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<"disable" | "regenerate" | null>(null);

  async function update(enabled: boolean, regenerate = false) {
    setBusy(true);
    const res = await fetch(`/api/teams/${teamId}/share`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled, regenerate }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    setConfirm(null);
    if (!res.ok) {
      toast({ title: "Couldn't update sharing", description: data.error, variant: "error" });
      return;
    }
    setToken(data.token ?? null);
    toast({
      title: enabled
        ? regenerate
          ? "A new link is ready"
          : "Public calendar enabled"
        : "Public calendar disabled",
      variant: "success",
    });
  }

  if (!token) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-xl text-sm text-[var(--color-muted)]">
          Create a private, hard-to-guess share link. Visitors see names and unavailable blocks only
          — never meeting titles, attendee details, or email addresses.
        </p>
        <Button onClick={() => update(true)} disabled={busy}>
          <Globe2 size={15} /> {busy ? "Enabling…" : "Enable public link"}
        </Button>
      </div>
    );
  }

  const path = `/team/${teamSlug}/calendar/${token}`;
  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <CopyLinkButton path={path} label="Copy team calendar link" />
          <Link
            href={path}
            target="_blank"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)]"
          >
            Preview <ExternalLink size={13} />
          </Link>
        </div>
        <p className="text-sm text-[var(--color-muted)]">
          Anyone with this link can see when members are busy, booked, focused, or away. Calendar
          details and email addresses stay private.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setConfirm("regenerate")}>
            <RefreshCw size={14} /> Replace link
          </Button>
          <Button variant="danger-soft" size="sm" onClick={() => setConfirm("disable")}>
            Disable link
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => update(confirm !== "disable", confirm === "regenerate")}
        title={confirm === "disable" ? "Disable the public calendar?" : "Replace the public link?"}
        description="The current link will stop working immediately."
        confirmLabel={confirm === "disable" ? "Disable link" : "Replace link"}
        danger
        loading={busy}
      />
    </>
  );
}
