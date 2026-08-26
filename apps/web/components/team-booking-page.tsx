"use client";

import { SlotPicker } from "@/components/slot-picker";
import { Card, CardBody } from "@/components/ui/card";
import { Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Clock, Users } from "lucide-react";
import { useState } from "react";

interface TeamBookingEvent {
  id: string;
  title: string;
  durationMinutes: number;
  durationOptions: number[];
  schedulingType: string;
  hosts: { id: string; name: string }[];
}

const TYPE_LABEL: Record<string, string> = {
  collective: "Meet with all or selected team members",
  round_robin: "Meet with one available team member",
};

export function TeamBookingPage({
  teamName,
  members,
  events,
  initialEventId,
  embedded = false,
}: {
  teamName: string;
  members: { id: string; name: string }[];
  events: TeamBookingEvent[];
  initialEventId: string;
  embedded?: boolean;
}) {
  const [selectedEventId, setSelectedEventId] = useState(initialEventId);
  const [selectedHostIds, setSelectedHostIds] = useState<string[]>([]);
  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? events[0];

  if (!selectedEvent) return null;

  const content = (
    <div className="grid gap-0 lg:grid-cols-[310px_minmax(0,1fr)]">
      <aside className="border-b border-[var(--color-border)] p-6 lg:border-b-0 lg:border-r lg:p-7">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
            <Users size={17} />
          </div>
          <span className="text-sm text-[var(--color-muted)]">{teamName}</span>
        </div>

        <div className="mt-6">
          <Label htmlFor="team-meeting-type">Meeting type</Label>
          <Select
            id="team-meeting-type"
            value={selectedEvent.id}
            onChange={(event) => setSelectedEventId(event.target.value)}
          >
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title} · {event.durationMinutes} min
              </option>
            ))}
          </Select>
        </div>

        <h1 className="font-display mt-6 text-2xl leading-tight tracking-[-0.01em]">
          {selectedEvent.title}
        </h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          {TYPE_LABEL[selectedEvent.schedulingType] ?? "Choose an available time"}
        </p>
        {selectedEvent.schedulingType === "collective" ? (
          <p className="mt-2 text-xs leading-relaxed text-[var(--color-faint)]">
            Choose one developer, select several people, or use the whole-team shortcut. The
            calendar shows when everyone selected is available.
          </p>
        ) : null}

        <div className="mt-5 flex -space-x-2">
          {members.slice(0, 7).map((member) => (
            <div
              key={member.id}
              title={member.name}
              className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--color-surface)] bg-[var(--color-accent)] text-xs font-semibold text-white"
            >
              {member.name.charAt(0).toUpperCase()}
            </div>
          ))}
          {members.length > 7 ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--color-surface)] bg-[var(--color-surface-2)] text-[10px] font-semibold text-[var(--color-muted)]">
              +{members.length - 7}
            </div>
          ) : null}
        </div>

        <p className="mt-5 flex items-center gap-2 text-sm text-[var(--color-muted)]">
          <Clock size={15} /> {selectedEvent.durationMinutes} minutes
        </p>
      </aside>

      <CardBody className="min-w-0 p-5 sm:p-7 lg:p-8">
        <h2 className="mb-4 text-sm font-semibold">Choose a time</h2>
        <SlotPicker
          key={selectedEvent.id}
          eventTypeId={selectedEvent.id}
          defaultDuration={selectedEvent.durationMinutes}
          durationOptions={selectedEvent.durationOptions}
          calendarView
          calendarDefaultView="agenda"
          teamHosts={selectedEvent.schedulingType === "collective" ? selectedEvent.hosts : []}
          selectedTeamHostIds={selectedHostIds}
          onTeamHostSelectionChange={setSelectedHostIds}
        />
      </CardBody>
    </div>
  );

  return embedded ? content : <Card>{content}</Card>;
}
