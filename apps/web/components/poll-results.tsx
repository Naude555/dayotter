"use client";

import { CopyLinkButton } from "@/components/copy-link-button";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import {
  FINALIZE_MESSAGE_PLACEHOLDER,
  FINALIZE_MESSAGE_TEMPLATES,
} from "@/lib/polls/message-templates";
import { CheckCircle2, Clock3, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export interface PollOptionResult {
  id: string;
  label: string;
  yes: number;
  maybe: number;
  no: number;
  voters: { name: string; response: string }[];
}

interface FinalizeDraft {
  optionId: string;
  message: string;
  template: string;
}

/**
 * Host-side results: the share link, a ranked view of each option's votes, and
 * finalize. The best-supported option is highlighted so the host can lock in the
 * obvious winner fast. Finalize opens a small editor so the host can attach
 * meeting details (a Zoom link, address, ...) that go out with the confirmation
 * emails - pick a template or write their own.
 */
export function PollResults({
  pollId,
  shareUrl,
  sharePath,
  status,
  options,
  finalizedOptionId,
  votingMode,
  invitees,
  finalizeMessage,
}: {
  pollId: string;
  shareUrl: string;
  sharePath: string;
  status: string;
  options: PollOptionResult[];
  finalizedOptionId: string | null;
  votingMode: string;
  invitees: { email: string; voted: boolean; sent: boolean }[];
  finalizeMessage?: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState<FinalizeDraft | null>(null);
  const isFinalized = status === "finalized";

  // Highlight the leader (most yes, then most maybe) while the poll is open.
  const best = [...options].sort(
    (a, b) => b.yes - a.yes || b.maybe - a.maybe || a.label.localeCompare(b.label),
  )[0];

  function pickTemplate(value: string) {
    const template = FINALIZE_MESSAGE_TEMPLATES.find((t) => t.value === value);
    setDraft((prev) => (prev ? { ...prev, template: value, message: template?.text ?? "" } : prev));
  }

  async function finalize(optionId: string, message: string) {
    setBusy(optionId);
    const res = await fetch(`/api/polls/${pollId}/finalize`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ optionId, message: message.trim() || undefined }),
    });
    setBusy(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast({
        title: typeof data.error === "string" ? data.error : "Couldn't finalize",
        variant: "error",
      });
      return;
    }
    setDraft(null);
    toast({ title: "Locked in - everyone who's coming has been notified.", variant: "success" });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {!isFinalized && votingMode === "public" ? (
        <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3">
          <span className="text-sm text-[var(--color-muted)]">Share to collect votes:</span>
          <code className="min-w-0 flex-1 truncate rounded-sm bg-[var(--color-bg)] px-2 py-1 text-xs">
            {shareUrl}
          </code>
          <CopyLinkButton path={sharePath} />
        </div>
      ) : null}

      {votingMode === "invited" ? (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium">
                <Mail size={15} /> Email invitations
              </p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                {invitees.filter((invitee) => invitee.voted).length} of {invitees.length} recipients
                have voted.
              </p>
            </div>
            <span className="rounded-full bg-[var(--color-surface-2)] px-2.5 py-1 text-xs text-[var(--color-muted)]">
              Invite-only
            </span>
          </div>
          <ul className="mt-3 divide-y divide-[var(--color-border)]">
            {invitees.map((invitee) => (
              <li key={invitee.email} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0 truncate text-sm">{invitee.email}</span>
                {invitee.voted ? (
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[var(--color-success)]">
                    <CheckCircle2 size={13} /> Voted
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs text-[var(--color-muted)]">
                    <Clock3 size={13} /> {invitee.sent ? "Awaiting vote" : "Email failed"}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {isFinalized && finalizeMessage ? (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-faint)]">
            Note sent to attendees
          </p>
          <p className="mt-1.5 whitespace-pre-line text-sm text-[var(--color-muted)]">
            {finalizeMessage}
          </p>
        </div>
      ) : null}

      <div className="space-y-2">
        {options.map((o) => {
          const isBest = !isFinalized && best?.id === o.id && o.yes + o.maybe > 0;
          const isWinner = isFinalized && finalizedOptionId === o.id;
          const isDrafting = draft?.optionId === o.id;
          return (
            <div
              key={o.id}
              className={`rounded-[var(--radius-lg)] border p-4 ${
                isWinner
                  ? "border-[var(--color-success)] bg-[var(--color-success)]/[0.06]"
                  : isBest
                    ? "border-[var(--color-accent)]/50 bg-[var(--color-accent)]/[0.04]"
                    : "border-[var(--color-border)]"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium">
                    {o.label}
                    {isWinner ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-success)]">
                        <CheckCircle2 size={13} /> Booked
                      </span>
                    ) : isBest ? (
                      <span className="text-xs font-medium text-[var(--color-accent)]">
                        Leading
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 flex gap-3 text-xs text-[var(--color-muted)]">
                    <span className="text-[var(--color-success)]">{o.yes} yes</span>
                    <span>{o.maybe} maybe</span>
                    <span className="text-[var(--color-faint)]">{o.no} no</span>
                  </p>
                  {o.voters.length > 0 ? (
                    <p className="mt-1.5 text-xs text-[var(--color-faint)]">
                      {o.voters
                        .map((v) => `${v.name} (${v.response})`)
                        .slice(0, 6)
                        .join(", ")}
                      {o.voters.length > 6 ? ` +${o.voters.length - 6}` : ""}
                    </p>
                  ) : null}
                </div>
                {!isFinalized ? (
                  <Button
                    variant={isBest ? "primary" : "outline"}
                    onClick={() => setDraft({ optionId: o.id, message: "", template: "custom" })}
                    disabled={busy !== null}
                  >
                    {busy === o.id ? "Booking…" : "Pick this"}
                  </Button>
                ) : null}
              </div>

              {!isFinalized && isDrafting && draft ? (
                <div className="mt-4 space-y-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
                  <div>
                    <Label htmlFor="finalize-template">Meeting details</Label>
                    <p className="mt-1 text-xs text-[var(--color-faint)]">
                      Sent in the confirmation email. Use {FINALIZE_MESSAGE_PLACEHOLDER} as a
                      placeholder for the auto-generated meeting link (Google Meet / Teams); paste
                      your own Zoom link or number to replace it.
                    </p>
                    <Select
                      id="finalize-template"
                      value={draft.template}
                      onChange={(e) => pickTemplate(e.target.value)}
                      className="mt-2"
                      aria-label="Message template"
                    >
                      <option value="custom">Custom message</option>
                      {FINALIZE_MESSAGE_TEMPLATES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </Select>
                    <Textarea
                      id="finalize-message"
                      value={draft.message}
                      onChange={(e) =>
                        setDraft({ ...draft, message: e.target.value, template: "custom" })
                      }
                      rows={4}
                      className="mt-2"
                      placeholder="Add a Zoom link, address, or any details attendees should have."
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setDraft(null)}
                      disabled={busy !== null}
                    >
                      Cancel
                    </Button>
                    <Button onClick={() => finalize(o.id, draft.message)} disabled={busy !== null}>
                      {busy === o.id ? "Booking…" : "Confirm booking"}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
