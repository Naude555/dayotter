"use client";

import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { AlertTriangle, CalendarPlus, Check, Users } from "lucide-react";
import { DateTime } from "luxon";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface CollectiveEvent {
  id: string;
  title: string;
  durationMinutes: number;
}

interface Conflict {
  member: string;
  reason: string;
  category: string;
}

interface TeamMemberOption {
  id: string;
  name: string;
  isOrganizer: boolean;
}

export function InternalTeamBookingForm({
  teamId,
  timezone,
  events,
  members,
}: {
  teamId: string;
  timezone: string;
  events: CollectiveEvent[];
  members: TeamMemberOption[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const initial = events[0];
  const [eventTypeId, setEventTypeId] = useState(initial?.id ?? "");
  const [title, setTitle] = useState(initial?.title ?? "Team meeting");
  const [duration, setDuration] = useState(initial?.durationMinutes ?? 30);
  const [localStart, setLocalStart] = useState("");
  const [notes, setNotes] = useState("");
  const [externalGuests, setExternalGuests] = useState<string[]>([]);
  const [guestInput, setGuestInput] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState(() =>
    members.map((member) => member.id),
  );
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const wholeTeamSelected = selectedMemberIds.length === members.length;

  if (events.length === 0) {
    return (
      <p className="text-sm text-[var(--color-muted)]">
        Create a collective team event below first. It defines the duration and meeting location for
        whole-team bookings.
      </p>
    );
  }

  function chooseEvent(id: string) {
    setEventTypeId(id);
    const event = events.find((candidate) => candidate.id === id);
    if (event) {
      setTitle(event.title);
      setDuration(event.durationMinutes);
    }
    setConflicts([]);
  }

  function addExternalGuest() {
    const email = guestInput.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError("Enter a valid guest email address.");
      return;
    }
    if (!externalGuests.includes(email) && externalGuests.length < 10) {
      setExternalGuests((current) => [...current, email]);
    }
    setGuestInput("");
    setError(null);
  }

  async function schedule(confirmConflicts: boolean) {
    const start = DateTime.fromISO(localStart, { zone: timezone });
    if (!start.isValid) {
      setError("Choose a valid date and time.");
      return;
    }

    setLoading(true);
    setError(null);
    const response = await fetch(`/api/teams/${teamId}/bookings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventTypeId,
        title,
        start: start.toUTC().toISO(),
        durationMinutes: duration,
        notes: notes || undefined,
        selectedMemberIds,
        externalGuests,
        confirmConflicts,
      }),
    });
    const data = await response.json().catch(() => ({}));
    setLoading(false);

    if (response.status === 409 && data.requiresConfirmation) {
      setConflicts(data.conflicts ?? []);
      return;
    }
    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not book the team.");
      return;
    }

    const selectedCount = Number(data.selectedMemberCount ?? selectedMemberIds.length);
    const guestCount = Number(data.externalGuestCount ?? 0);
    toast({
      title: "Team booking created",
      description: `${selectedCount} team member${selectedCount === 1 ? "" : "s"}${guestCount ? ` and ${guestCount} external guest${guestCount === 1 ? "" : "s"}` : ""} included.`,
      variant: "success",
    });
    router.push(data.url as `/${string}`);
    router.refresh();
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        schedule(false);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="team-event">Collective event</Label>
          <Select id="team-event" value={eventTypeId} onChange={(e) => chooseEvent(e.target.value)}>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="team-start">Starts</Label>
          <Input
            id="team-start"
            type="datetime-local"
            required
            value={localStart}
            onChange={(event) => {
              setLocalStart(event.target.value);
              setConflicts([]);
            }}
          />
          <p className="mt-1 text-xs text-[var(--color-faint)]">{timezone}</p>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]/60 p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <Users size={15} /> Team members
            </p>
            <p className="mt-0.5 text-xs text-[var(--color-faint)]">
              Select whose calendars to check and override. You remain included as the organizer.
            </p>
          </div>
          <button
            type="button"
            aria-pressed={wholeTeamSelected}
            onClick={() => {
              setSelectedMemberIds(members.map((member) => member.id));
              setConflicts([]);
            }}
            className={
              wholeTeamSelected
                ? "shrink-0 rounded-full bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-[var(--color-accent-fg)]"
                : "shrink-0 rounded-full border border-[var(--color-border-strong)] px-3 py-1.5 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-text)]"
            }
          >
            Whole team ({members.length})
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {members.map((member) => {
            const active = selectedMemberIds.includes(member.id);
            return (
              <button
                key={member.id}
                type="button"
                aria-pressed={active}
                disabled={member.isOrganizer}
                title={member.isOrganizer ? "The organizer remains included" : undefined}
                onClick={() => {
                  setSelectedMemberIds((current) =>
                    current.includes(member.id)
                      ? current.filter((id) => id !== member.id)
                      : [...current, member.id],
                  );
                  setConflicts([]);
                }}
                className={
                  active
                    ? "inline-flex items-center gap-1.5 rounded-full border border-[var(--color-accent)] bg-[var(--color-accent-soft)] px-3 py-1.5 text-xs font-medium text-[var(--color-accent)] disabled:cursor-default"
                    : "inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border-strong)] px-3 py-1.5 text-xs text-[var(--color-muted)]"
                }
              >
                {active ? <Check size={13} /> : null}
                {member.name}
                {member.isOrganizer ? " (you)" : ""}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
        <div>
          <Label htmlFor="team-booking-title">Title</Label>
          <Input
            id="team-booking-title"
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="team-duration">Duration</Label>
          <Input
            id="team-duration"
            type="number"
            min={5}
            max={480}
            step={5}
            value={duration}
            onChange={(event) => setDuration(Number(event.target.value) || 30)}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="team-booking-notes">Notes (optional)</Label>
        <textarea
          id="team-booking-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={2}
          className="w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-soft)]"
        />
      </div>

      <div>
        <Label htmlFor="team-external-guest">External guests (optional)</Label>
        <div className="flex gap-2">
          <Input
            id="team-external-guest"
            type="email"
            value={guestInput}
            onChange={(event) => setGuestInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addExternalGuest();
              }
            }}
            placeholder="guest@example.com"
          />
          <Button
            type="button"
            variant="outline"
            disabled={!guestInput || externalGuests.length >= 10}
            onClick={addExternalGuest}
          >
            Add guest
          </Button>
        </div>
        {externalGuests.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {externalGuests.map((email) => (
              <span
                key={email}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--color-surface-2)] px-2.5 py-1 text-xs"
              >
                {email}
                <button
                  type="button"
                  aria-label={`Remove ${email}`}
                  className="text-[var(--color-faint)] hover:text-[var(--color-danger)]"
                  onClick={() =>
                    setExternalGuests((current) => current.filter((guest) => guest !== email))
                  }
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <p className="mt-1 text-xs text-[var(--color-faint)]">
          Selected team members are included automatically. Add up to 10 people outside the team.
        </p>
      </div>

      {conflicts.length > 0 ? (
        <div className="rounded-lg border border-[var(--color-amber)]/40 bg-[var(--color-amber)]/10 p-4">
          <div className="flex gap-2">
            <AlertTriangle className="mt-0.5 shrink-0 text-[var(--color-amber)]" size={17} />
            <div>
              <p className="text-sm font-semibold">Some selected teammates already have plans</p>
              <ul className="mt-2 space-y-1 text-sm text-[var(--color-muted)]">
                {conflicts.map((conflict) => (
                  <li key={`${conflict.member}:${conflict.category}`}>
                    {conflict.member} has {conflict.reason}.
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-[var(--color-faint)]">
                You can still schedule it. Every selected member is included as a required host; a
                connected calendar also sends the invitations.
              </p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button type="button" disabled={loading} onClick={() => schedule(true)}>
              {loading ? "Booking…" : "Book anyway"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setConflicts([])}>
              Choose another time
            </Button>
          </div>
        </div>
      ) : (
        <Button type="submit" disabled={loading || !eventTypeId || !title || !localStart}>
          <CalendarPlus size={16} />{" "}
          {loading
            ? "Checking calendars…"
            : wholeTeamSelected
              ? "Book the whole team"
              : `Book ${selectedMemberIds.length} team members`}
        </Button>
      )}

      <FormError>{error}</FormError>
    </form>
  );
}
