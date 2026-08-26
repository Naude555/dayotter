"use client";

import type { Slot } from "@/components/slot-grid";
import { useLocalZone } from "@/components/slot-grid";
import { buttonVariants } from "@/components/ui/button";
import { SkeletonRows } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DateTime } from "luxon";
import { useEffect, useMemo, useState } from "react";

export type AvailabilityCalendarView = "month" | "week" | "agenda";
const VIEWS: { value: AvailabilityCalendarView; label: string }[] = [
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
  { value: "agenda", label: "Agenda" },
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface UnavailableDay {
  dateKey: string;
  startsAt: string;
  endsAt: string;
  label: string;
}

function startOfWeekSun(day: DateTime) {
  return day.startOf("day").minus({ days: day.weekday % 7 });
}

/** Month/week/agenda calendar of bookable slots with explicit host leave days. */
export function AvailabilityCalendar({
  eventTypeId,
  duration,
  selectedHostIds,
  defaultView = "month",
  onSelect,
}: {
  eventTypeId: string;
  duration?: number;
  selectedHostIds?: string[];
  defaultView?: AvailabilityCalendarView;
  onSelect: (slot: Slot) => void;
}) {
  const zone = useLocalZone();
  const [view, setView] = useState<AvailabilityCalendarView>(defaultView);
  const [anchor, setAnchor] = useState<DateTime>(() => DateTime.now().setZone(zone).startOf("day"));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [unavailable, setUnavailable] = useState<UnavailableDay[]>([]);
  const [loading, setLoading] = useState(true);

  const { rangeStart, rangeEnd } = useMemo(() => {
    if (view === "month") {
      const start = startOfWeekSun(anchor.startOf("month"));
      return { rangeStart: start, rangeEnd: start.plus({ days: 42 }) };
    }
    if (view === "week") {
      const start = startOfWeekSun(anchor);
      return { rangeStart: start, rangeEnd: start.plus({ days: 7 }) };
    }
    const start = anchor.startOf("day");
    return { rangeStart: start, rangeEnd: start.plus({ days: 30 }) };
  }, [anchor, view]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const query = new URLSearchParams({
      from: rangeStart.toUTC().toISO() ?? "",
      to: rangeEnd.toUTC().toISO() ?? "",
    });
    if (duration) query.set("duration", String(duration));
    if (selectedHostIds?.length) query.set("hosts", selectedHostIds.join(","));
    fetch(`/api/availability/${eventTypeId}?${query}`)
      .then((response) => response.json())
      .then((data) => {
        if (active) {
          setSlots(data.slots ?? []);
          setUnavailable(data.unavailable ?? []);
        }
      })
      .catch(() => {
        if (!active) return;
        setSlots([]);
        setUnavailable([]);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [duration, eventTypeId, rangeEnd, rangeStart, selectedHostIds]);

  const byDay = useMemo(() => {
    const grouped = new Map<string, Slot[]>();
    for (const slot of slots) {
      const key = DateTime.fromISO(slot.start).setZone(zone).toISODate();
      if (!key) continue;
      const rows = grouped.get(key) ?? [];
      rows.push(slot);
      grouped.set(key, rows);
    }
    return grouped;
  }, [slots, zone]);

  const unavailableByDay = useMemo(
    () => new Map(unavailable.map((day) => [day.dateKey, day])),
    [unavailable],
  );

  function step(direction: 1 | -1) {
    if (view === "month") setAnchor((value) => value.plus({ months: direction }));
    else if (view === "week") setAnchor((value) => value.plus({ weeks: direction }));
    else setAnchor((value) => value.plus({ days: direction * 30 }));
  }

  const title =
    view === "month"
      ? anchor.toFormat("LLLL yyyy")
      : `${rangeStart.toFormat("LLL d")} – ${rangeEnd.minus({ days: 1 }).toFormat("LLL d")}`;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Previous"
            className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface-2)]"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Next"
            className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface-2)]"
          >
            <ChevronRight size={18} />
          </button>
          <button
            type="button"
            onClick={() => setAnchor(DateTime.now().setZone(zone).startOf("day"))}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "ml-1")}
          >
            Today
          </button>
          <span className="ml-2 text-sm font-semibold">{title}</span>
        </div>
        <div className="flex rounded-md border border-[var(--color-border-strong)] p-0.5">
          {VIEWS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setView(option.value)}
              className={cn(
                "rounded-sm px-2.5 py-1 text-xs transition-colors",
                view === option.value
                  ? "bg-[var(--color-accent)] text-[var(--color-accent-fg)]"
                  : "text-[var(--color-muted)] hover:text-[var(--color-text)]",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-3 text-xs text-[var(--color-faint)]">
        Open times in {zone}. Select a time to book.
      </p>

      {loading ? (
        <div className="py-6">
          <SkeletonRows rows={5} />
        </div>
      ) : view === "month" ? (
        <AvailabilityMonth
          anchor={anchor}
          rangeStart={rangeStart}
          byDay={byDay}
          unavailableByDay={unavailableByDay}
          zone={zone}
          onSelect={onSelect}
          onShowDay={(day) => {
            setAnchor(day);
            setView("week");
          }}
        />
      ) : view === "week" ? (
        <AvailabilityWeek
          rangeStart={rangeStart}
          byDay={byDay}
          unavailableByDay={unavailableByDay}
          zone={zone}
          onSelect={onSelect}
        />
      ) : (
        <AvailabilityAgenda
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          byDay={byDay}
          unavailableByDay={unavailableByDay}
          zone={zone}
          onSelect={onSelect}
        />
      )}
    </div>
  );
}

function SlotButton({
  slot,
  zone,
  onSelect,
}: { slot: Slot; zone: string; onSelect: (slot: Slot) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(slot)}
      className="w-full truncate rounded-sm bg-[var(--color-accent-soft)] px-1.5 py-1 text-left text-[11px] font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-[var(--color-accent-fg)]"
    >
      {DateTime.fromISO(slot.start).setZone(zone).toFormat("h:mm a")}
    </button>
  );
}

function AvailabilityMonth({
  anchor,
  rangeStart,
  byDay,
  unavailableByDay,
  zone,
  onSelect,
  onShowDay,
}: {
  anchor: DateTime;
  rangeStart: DateTime;
  byDay: Map<string, Slot[]>;
  unavailableByDay: Map<string, UnavailableDay>;
  zone: string;
  onSelect: (slot: Slot) => void;
  onShowDay: (day: DateTime) => void;
}) {
  const today = DateTime.now().setZone(zone).toISODate();
  const days = Array.from({ length: 42 }, (_, index) => rangeStart.plus({ days: index }));
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
      <div className="grid grid-cols-7 border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
        {WEEKDAYS.map((day) => (
          <div key={day} className="px-1 py-1.5 text-center text-xs text-[var(--color-muted)]">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = day.toISODate()!;
          const daySlots = byDay.get(key) ?? [];
          const unavailable = unavailableByDay.get(key);
          return (
            <div
              key={key}
              className={cn(
                "min-h-[96px] border-b border-r border-[var(--color-border)] p-1",
                day.month !== anchor.month && "bg-[var(--color-surface-2)]/40",
              )}
            >
              <div
                className={cn(
                  "mb-1 text-right text-xs",
                  key === today
                    ? "font-semibold text-[var(--color-accent)]"
                    : "text-[var(--color-muted)]",
                )}
              >
                {day.day}
              </div>
              <div className="space-y-0.5">
                {unavailable ? <UnavailableBadge label={unavailable.label} /> : null}
                {daySlots.slice(0, 3).map((slot) => (
                  <SlotButton key={slot.start} slot={slot} zone={zone} onSelect={onSelect} />
                ))}
                {daySlots.length > 3 ? (
                  <button
                    type="button"
                    onClick={() => onShowDay(day)}
                    className="px-1 text-left text-[10px] text-[var(--color-accent)] hover:underline"
                  >
                    +{daySlots.length - 3} more
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AvailabilityWeek({
  rangeStart,
  byDay,
  unavailableByDay,
  zone,
  onSelect,
}: {
  rangeStart: DateTime;
  byDay: Map<string, Slot[]>;
  unavailableByDay: Map<string, UnavailableDay>;
  zone: string;
  onSelect: (slot: Slot) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
      {Array.from({ length: 7 }, (_, index) => rangeStart.plus({ days: index })).map((day) => {
        const slots = byDay.get(day.toISODate()!) ?? [];
        const unavailable = unavailableByDay.get(day.toISODate()!);
        return (
          <div
            key={day.toISODate()}
            className="rounded-md border border-[var(--color-border)] p-2 sm:min-h-[180px]"
          >
            <p className="mb-2 text-xs font-medium text-[var(--color-muted)]">
              {day.toFormat("ccc d")}
            </p>
            <div className="space-y-1">
              {unavailable ? <UnavailableBadge label={unavailable.label} /> : null}
              {slots.length === 0 && !unavailable ? (
                <p className="text-xs text-[var(--color-faint)]">No openings</p>
              ) : (
                slots
                  .slice(0, 10)
                  .map((slot) => (
                    <SlotButton key={slot.start} slot={slot} zone={zone} onSelect={onSelect} />
                  ))
              )}
              {slots.length > 10 ? (
                <p className="text-[10px] text-[var(--color-faint)]">+{slots.length - 10} more</p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AvailabilityAgenda({
  rangeStart,
  rangeEnd,
  byDay,
  unavailableByDay,
  zone,
  onSelect,
}: {
  rangeStart: DateTime;
  rangeEnd: DateTime;
  byDay: Map<string, Slot[]>;
  unavailableByDay: Map<string, UnavailableDay>;
  zone: string;
  onSelect: (slot: Slot) => void;
}) {
  const days: DateTime[] = [];
  for (let day = rangeStart; day < rangeEnd; day = day.plus({ days: 1 })) {
    const key = day.toISODate()!;
    if ((byDay.get(key) ?? []).length > 0 || unavailableByDay.has(key)) days.push(day);
  }
  if (days.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-[var(--color-muted)]">
        No open times in this range.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      {days.map((day) => (
        <div key={day.toISODate()} className="grid gap-2 sm:grid-cols-[90px_1fr]">
          <div>
            <p className="text-sm font-semibold">{day.toFormat("ccc")}</p>
            <p className="text-xs text-[var(--color-muted)]">{day.toFormat("LLL d")}</p>
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {unavailableByDay.has(day.toISODate()!) ? (
              <UnavailableBadge label={unavailableByDay.get(day.toISODate()!)!.label} />
            ) : null}
            {(byDay.get(day.toISODate()!) ?? []).map((slot) => (
              <SlotButton key={slot.start} slot={slot} zone={zone} onSelect={onSelect} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function UnavailableBadge({ label }: { label: string }) {
  return (
    <div className="rounded-sm border-l-[3px] border-[var(--color-coral)] bg-[var(--color-surface-2)] px-1.5 py-1 text-[11px] font-medium text-[var(--color-muted)]">
      {label}
    </div>
  );
}
