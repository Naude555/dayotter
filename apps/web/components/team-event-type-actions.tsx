"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function TeamEventTypeActions({
  eventTypeId,
  initialTitle,
  slug,
  durationMinutes,
}: {
  eventTypeId: string;
  initialTitle: string;
  slug: string;
  durationMinutes: number;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [mode, setMode] = useState<"idle" | "rename" | "delete">("idle");
  const [title, setTitle] = useState(initialTitle);
  const [loading, setLoading] = useState(false);

  async function rename(event: React.FormEvent) {
    event.preventDefault();
    const nextTitle = title.trim();
    if (!nextTitle || nextTitle === initialTitle) {
      setTitle(initialTitle);
      setMode("idle");
      return;
    }

    setLoading(true);
    const response = await fetch(`/api/event-types/${eventTypeId}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: nextTitle, slug, durationMinutes }),
    });
    setLoading(false);

    if (!response.ok) {
      toast({ title: "Couldn't rename the event type", variant: "error" });
      return;
    }

    setMode("idle");
    toast({ title: "Event type renamed", variant: "success" });
    router.refresh();
  }

  async function remove() {
    setLoading(true);
    const response = await fetch(`/api/event-types/${eventTypeId}`, { method: "DELETE" });
    setLoading(false);

    if (!response.ok) {
      setMode("idle");
      toast({ title: "Couldn't delete the event type", variant: "error" });
      return;
    }

    toast({ title: "Event type deleted", variant: "success" });
    router.refresh();
  }

  if (mode === "rename") {
    return (
      <form onSubmit={rename} className="flex w-full items-center gap-2 sm:w-auto">
        <Input
          autoFocus
          aria-label="Event type name"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="h-9 min-w-0 sm:w-52"
          maxLength={120}
        />
        <Button type="submit" size="sm" disabled={loading || !title.trim()}>
          {loading ? "Saving…" : "Save"}
        </Button>
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            setTitle(initialTitle);
            setMode("idle");
          }}
          className="text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] disabled:opacity-50"
        >
          Cancel
        </button>
      </form>
    );
  }

  if (mode === "delete") {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-[var(--color-muted)]">Delete this event type?</span>
        <button
          type="button"
          onClick={remove}
          disabled={loading}
          className="font-medium text-[var(--color-danger)] hover:underline disabled:opacity-50"
        >
          {loading ? "Deleting…" : "Confirm"}
        </button>
        <button
          type="button"
          onClick={() => setMode("idle")}
          disabled={loading}
          className="text-[var(--color-muted)] hover:text-[var(--color-text)] disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => setMode("rename")}
        aria-label={`Rename ${initialTitle}`}
        title="Rename"
        className="rounded-md p-2 text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
      >
        <Pencil size={14} />
      </button>
      <button
        type="button"
        onClick={() => setMode("delete")}
        aria-label={`Delete ${initialTitle}`}
        title="Delete"
        className="rounded-md p-2 text-[var(--color-muted)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
