"use client";

import { SlotPicker } from "@/components/slot-picker";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { BookingQuestionInput } from "@/lib/booking/event-type-input";
import { cn } from "@/lib/cn";
import { Clock } from "lucide-react";
import { useState } from "react";

interface ProfileEvent {
  id: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  durationOptions: number[];
  questions: BookingQuestionInput[];
  priceLabel: string | null;
  requiresCode: boolean;
  locations: { type: string; label: string }[];
}

/** Public handle page with an event selector and immediately visible real slots. */
export function PublicProfileAvailability({ events }: { events: ProfileEvent[] }) {
  const [selectedId, setSelectedId] = useState(events[0]?.id ?? "");
  const selected = events.find((event) => event.id === selectedId) ?? events[0];
  if (!selected) return null;

  return (
    <Card>
      <CardHeader
        title="Book a time"
        description="Choose a meeting, then pick one of the host's open slots."
      />
      <CardBody className="space-y-5 p-6">
        {events.length > 1 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {events.map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => setSelectedId(event.id)}
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors",
                  selected.id === event.id
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                    : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]",
                )}
              >
                <span className="block text-sm font-medium">{event.title}</span>
                <span className="mt-1 flex items-center gap-1 text-xs text-[var(--color-muted)]">
                  <Clock size={12} /> {event.durationMinutes} minutes
                  {event.priceLabel ? ` · ${event.priceLabel}` : ""}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div>
            <h2 className="font-display text-xl">{selected.title}</h2>
            {selected.description ? (
              <p className="mt-1 text-sm text-[var(--color-muted)]">{selected.description}</p>
            ) : null}
            <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
              <Clock size={13} /> {selected.durationMinutes} minutes
              {selected.priceLabel ? ` · ${selected.priceLabel}` : ""}
            </p>
          </div>
        )}
        <div className="border-t border-[var(--color-border)] pt-5">
          <SlotPicker
            key={selected.id}
            eventTypeId={selected.id}
            questions={selected.questions}
            priceLabel={selected.priceLabel}
            defaultDuration={selected.durationMinutes}
            durationOptions={selected.durationOptions}
            requiresCode={selected.requiresCode}
            locations={selected.locations}
            calendarView
          />
        </div>
      </CardBody>
    </Card>
  );
}
