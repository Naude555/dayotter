"use client";

import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { useState } from "react";

function BookingToggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: () => void;
}) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
      {label}
      <button
        type="button"
        role="switch"
        aria-label={`${label} booking eligibility`}
        aria-checked={checked}
        disabled={disabled}
        onClick={onChange}
        className={cn(
          "inline-flex h-5 w-9 shrink-0 items-center rounded-full border px-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-60",
          checked
            ? "border-[var(--color-accent)] bg-[var(--color-accent)]"
            : "border-[var(--color-border-strong)] bg-[var(--color-surface-2)]",
        )}
      >
        <span
          className={cn(
            "h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-[14px]" : "translate-x-0",
          )}
        />
      </button>
    </span>
  );
}

export function MemberBookingVisibility({
  teamId,
  memberId,
  initialPublic,
  initialInternal,
  editable,
}: {
  teamId: string;
  memberId: string;
  initialPublic: boolean;
  initialInternal: boolean;
  editable: boolean;
}) {
  const { toast } = useToast();
  const [publicBookable, setPublicBookable] = useState(initialPublic);
  const [internalBookable, setInternalBookable] = useState(initialInternal);
  const [saving, setSaving] = useState(false);

  async function save(field: "publicBookable" | "internalBookable", value: boolean) {
    const setValue = field === "publicBookable" ? setPublicBookable : setInternalBookable;
    setValue(value);
    setSaving(true);
    const response = await fetch(`/api/teams/${teamId}/members/${memberId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    setSaving(false);
    if (!response.ok) {
      setValue(!value);
      toast({ title: "Couldn't update booking visibility", variant: "error" });
      return;
    }
    toast({ title: "Booking visibility updated", variant: "success" });
  }

  return (
    <div className="flex items-center gap-3 rounded-md border border-[var(--color-border)] px-2.5 py-1.5">
      <BookingToggle
        label="Public"
        checked={publicBookable}
        disabled={!editable || saving}
        onChange={() => save("publicBookable", !publicBookable)}
      />
      <BookingToggle
        label="Internal"
        checked={internalBookable}
        disabled={!editable || saving}
        onChange={() => save("internalBookable", !internalBookable)}
      />
    </div>
  );
}
