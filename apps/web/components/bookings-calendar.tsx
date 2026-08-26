"use client";

import { SkeletonRows } from "@/components/ui/skeleton";

import { buttonVariants } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { eventColorVar } from "@/lib/booking/event-type-input";
import { cn } from "@/lib/cn";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DateTime } from "luxon";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface CalBooking {
  uid: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: string;
  color: string | null;
  attendees: string[];
  href?: string | null;
  allDay?: boolean;
  dateKey?: string;
  category?: BlockCategory;
}

interface CalMember {
  id: string;
  name: string;
  href: string | null;
  color: string;
}

interface CalEvent {
  id?: string;
  title: string;
  startsAt: string;
  endsAt: string;
  allDay?: boolean;
  source?: "calendar" | "out_of_office" | "time_block";
  dateKey?: string;
  category?: BlockCategory;
}

/** A calendar cell item: a DayOtter booking, or a synced "busy" calendar event. */
type CalItem =
  | ({ kind: "booking"; id: string } & CalBooking)
  | ({ kind: "busy"; id: string } & CalEvent);

type View = "month" | "week" | "agenda";
type BlockCategory =
  | "booked"
  | "focus"
  | "personal"
  | "travel"
  | "unavailable"
  | "busy"
  | "out_of_office"
  | "holiday";

const BLOCK_META: Record<BlockCategory, { label: string; compact: string; className: string }> = {
  booked: {
    label: "Booked",
    compact: "Booked",
    className: "bg-[var(--color-accent-soft)] text-[var(--color-accent)]",
  },
  focus: {
    label: "Deep work",
    compact: "Focus",
    className: "bg-[var(--color-mint)]/15 text-[var(--color-mint)]",
  },
  personal: {
    label: "Personal block",
    compact: "Personal",
    className: "bg-[var(--color-amber)]/15 text-[var(--color-amber)]",
  },
  travel: {
    label: "Travel time",
    compact: "Travel",
    className: "bg-[var(--color-amber)]/15 text-[var(--color-amber)]",
  },
  unavailable: {
    label: "Unavailable",
    compact: "Blocked",
    className: "bg-[var(--color-amber)]/15 text-[var(--color-amber)]",
  },
  busy: {
    label: "External calendar busy",
    compact: "Busy",
    className: "bg-[var(--color-surface-2)] text-[var(--color-muted)]",
  },
  out_of_office: {
    label: "Out of office",
    compact: "Leave",
    className: "bg-[var(--color-coral)]/15 text-[var(--color-coral)]",
  },
  holiday: {
    label: "Team holiday",
    compact: "Holiday",
    className: "bg-[var(--color-coral)]/15 text-[var(--color-coral)]",
  },
};

const TEAM_LEGEND: BlockCategory[] = [
  "booked",
  "focus",
  "busy",
  "out_of_office",
  "unavailable",
  "holiday",
];
const VIEWS: { value: View; label: string }[] = [
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
  { value: "agenda", label: "Agenda" },
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Sunday-based start of the week for the given day. */
function startOfWeekSun(d: DateTime): DateTime {
  return d.startOf("day").minus({ days: d.weekday % 7 });
}

function localKey(iso: string, tz: string): string {
  return DateTime.fromISO(iso).setZone(tz).toFormat("yyyy-LL-dd");
}

/**
 * Multi-view calendar for the host's bookings - Month / Week / Agenda, colour-coded
 * by event type, in the viewer's timezone. Fetches only the visible range.
 */
export function BookingsCalendar({
  tz,
  endpoint = "/api/bookings/range",
  readOnly = false,
  defaultView = "month",
}: {
  tz: string;
  endpoint?: string;
  readOnly?: boolean;
  defaultView?: View;
}) {
  const [view, setView] = useState<View>(defaultView);
  const [anchor, setAnchor] = useState<DateTime>(() => DateTime.now().setZone(tz).startOf("day"));
  const [bookings, setBookings] = useState<CalBooking[]>([]);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [members, setMembers] = useState<CalMember[]>([]);
  const [loading, setLoading] = useState(true);

  // The visible range for the current view.
  const { rangeStart, rangeEnd } = useMemo(() => {
    if (view === "month") {
      const first = anchor.startOf("month");
      const gridStart = startOfWeekSun(first);
      const last = anchor.endOf("month");
      const gridEnd = startOfWeekSun(last).plus({ days: 7 });
      return { rangeStart: gridStart, rangeEnd: gridEnd };
    }
    if (view === "week") {
      const s = startOfWeekSun(anchor);
      return { rangeStart: s, rangeEnd: s.plus({ days: 7 }) };
    }
    // agenda: 30 days forward from the anchor day
    const s = anchor.startOf("day");
    return { rangeStart: s, rangeEnd: s.plus({ days: 30 }) };
  }, [view, anchor]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const qs = new URLSearchParams({
      start: rangeStart.toUTC().toISO() ?? "",
      end: rangeEnd.toUTC().toISO() ?? "",
    });
    fetch(`${endpoint}?${qs}`)
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        setBookings(d.bookings ?? []);
        setEvents(d.events ?? []);
        setMembers(d.members ?? []);
      })
      .catch(() => {
        if (!active) return;
        setBookings([]);
        setEvents([]);
        setMembers([]);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [endpoint, rangeStart, rangeEnd]);

  // Group bookings + synced calendar events by local day for the grid views.
  const byDay = useMemo(() => {
    const map = new Map<string, CalItem[]>();
    const add = (item: CalItem) => {
      const key = item.dateKey ?? localKey(item.startsAt, tz);
      const list = map.get(key);
      if (list) list.push(item);
      else map.set(key, [item]);
    };
    const bookingStarts = new Set(bookings.map((b) => b.startsAt));
    for (const b of bookings) add({ kind: "booking", id: b.uid, ...b });
    events.forEach((e, i) => {
      // Skip an event that's a DayOtter booking's own calendar mirror.
      if (bookingStarts.has(e.startsAt)) return;
      add({ kind: "busy", id: e.id ?? `busy:${i}`, ...e });
    });
    for (const list of map.values()) list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return map;
  }, [bookings, events, tz]);

  function step(dir: 1 | -1) {
    if (view === "month") setAnchor((a) => a.plus({ months: dir }));
    else if (view === "week") setAnchor((a) => a.plus({ weeks: dir }));
    else setAnchor((a) => a.plus({ days: dir * 7 }));
  }
  function goToday() {
    setAnchor(DateTime.now().setZone(tz).startOf("day"));
  }

  const title =
    view === "agenda"
      ? `${rangeStart.toFormat("LLL d")} – ${rangeEnd.minus({ days: 1 }).toFormat("LLL d")}`
      : view === "week"
        ? `${rangeStart.toFormat("LLL d")} – ${rangeStart.plus({ days: 6 }).toFormat("LLL d")}`
        : anchor.toFormat("LLLL yyyy");

  return (
    <div>
      {readOnly && members.length > 0 ? (
        <div className="mb-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]/50 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-medium text-[var(--color-muted)]">
              Book a team member:
            </span>
            {members.map((member) =>
              member.href ? (
                <Link
                  key={member.id}
                  href={member.href}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2.5 py-1 text-xs font-medium hover:border-[var(--color-accent)]"
                >
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: eventColorVar(member.color) }}
                  />
                  Book {member.name}
                </Link>
              ) : (
                <span
                  key={member.id}
                  title="This member needs to set a public handle before they can be booked directly."
                  className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-[var(--color-border)] px-2.5 py-1 text-xs text-[var(--color-faint)]"
                >
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: eventColorVar(member.color) }}
                  />
                  {member.name} · no booking page
                </span>
              ),
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-[var(--color-border)] pt-2">
            <span className="mr-1 text-[11px] font-medium text-[var(--color-faint)]">Key:</span>
            {TEAM_LEGEND.map((category) => (
              <StatusBadge key={category} category={category} />
            ))}
          </div>
        </div>
      ) : null}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Previous"
            className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Next"
            className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
          >
            <ChevronRight size={18} />
          </button>
          <button
            type="button"
            onClick={goToday}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "ml-1")}
          >
            Today
          </button>
          <h2 className="ml-2 text-sm font-semibold text-[var(--color-text)]">{title}</h2>
        </div>
        <div className="flex rounded-md border border-[var(--color-border-strong)] p-0.5">
          {VIEWS.map((v) => (
            <button
              key={v.value}
              type="button"
              onClick={() => {
                setView(v.value);
                track("Calendar View Changed", { view: v.value });
              }}
              className={cn(
                "rounded-sm px-3 py-1 text-sm transition-colors",
                view === v.value
                  ? "bg-[var(--color-accent)] text-white"
                  : "text-[var(--color-muted)] hover:text-[var(--color-text)]",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-6">
          <SkeletonRows rows={5} />
        </div>
      ) : view === "month" ? (
        <MonthGrid
          rangeStart={rangeStart}
          anchor={anchor}
          byDay={byDay}
          tz={tz}
          readOnly={readOnly}
        />
      ) : view === "week" ? (
        <WeekGrid rangeStart={rangeStart} byDay={byDay} tz={tz} readOnly={readOnly} />
      ) : (
        <Agenda
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          byDay={byDay}
          tz={tz}
          readOnly={readOnly}
        />
      )}
    </div>
  );
}

function EventChip({
  item,
  tz,
  readOnly,
  compact = false,
}: {
  item: CalItem;
  tz: string;
  readOnly: boolean;
  compact?: boolean;
}) {
  const time = item.allDay
    ? "All day"
    : DateTime.fromISO(item.startsAt).setZone(tz).toFormat("h:mm a");
  // Synced calendar event: greyed, non-clickable "busy" block for context.
  if (item.kind === "busy") {
    const isLeave = item.source === "out_of_office";
    const isTimeBlock = item.source === "time_block";
    const content = (
      <div
        title={
          isLeave
            ? "Out of office · open availability settings to make changes"
            : isTimeBlock
              ? "Personal time block · open availability settings to make changes"
              : "From a connected calendar · manage it in the source calendar"
        }
        className={cn(
          "flex items-center gap-1.5 rounded-sm border-l-[3px] bg-[var(--color-surface-2)]/60 px-1.5 py-0.5 text-xs text-[var(--color-muted)]",
          isLeave
            ? "border-[var(--color-coral)]"
            : isTimeBlock
              ? "border-[var(--color-mint)]"
              : "border-[var(--color-border-strong)]",
        )}
      >
        <span className="shrink-0 text-[var(--color-faint)]">{time}</span>
        {item.category ? <StatusBadge category={item.category} compact /> : null}
        <span className="truncate">{item.title}</span>
      </div>
    );
    if (!readOnly && (isLeave || isTimeBlock)) {
      return (
        <Link href={isLeave ? "/availability#out-of-office" : "/availability#time-blocks"}>
          {content}
        </Link>
      );
    }
    return content;
  }
  if (readOnly) {
    const meta = item.category ? BLOCK_META[item.category] : null;
    const memberName = item.title.split(" · ")[0] ?? item.title;
    const content = (
      <>
        {item.category ? <StatusBadge category={item.category} compact /> : null}
        <span className="truncate font-medium">{memberName}</span>
        {!compact ? (
          <span className="ml-auto shrink-0 text-[10px] text-[var(--color-faint)]">{time}</span>
        ) : null}
      </>
    );
    if (item.href) {
      return (
        <Link
          href={item.href}
          title={`${memberName} — ${meta?.label ?? item.title} · ${time}. Open booking page.`}
          className="flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-xs hover:bg-[var(--color-surface-2)]"
          style={{ borderLeft: `3px solid ${eventColorVar(item.color)}` }}
        >
          {content}
        </Link>
      );
    }
    return (
      <div
        title={`${memberName} — ${meta?.label ?? item.title} · ${time}`}
        className="flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-xs"
        style={{ borderLeft: `3px solid ${eventColorVar(item.color)}` }}
      >
        {content}
      </div>
    );
  }
  return (
    <Link
      href={`/booking/${item.uid}`}
      className="flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-xs hover:bg-[var(--color-surface-2)]"
      style={{ borderLeft: `3px solid ${eventColorVar(item.color)}` }}
    >
      <span className="shrink-0 text-[var(--color-faint)]">{time}</span>
      <span className={cn("truncate", item.status === "pending" && "italic")}>{item.title}</span>
    </Link>
  );
}

function AgendaRow({ item, tz, readOnly }: { item: CalItem; tz: string; readOnly: boolean }) {
  const time = item.allDay
    ? "All day"
    : DateTime.fromISO(item.startsAt).setZone(tz).toFormat("h:mm a");
  if (item.kind === "busy") {
    const isLeave = item.source === "out_of_office";
    const isTimeBlock = item.source === "time_block";
    const content = (
      <div
        title={
          isLeave
            ? "Open availability settings to make changes"
            : isTimeBlock
              ? "Open availability settings to make changes"
              : "Manage this event in the connected calendar"
        }
        className="flex items-center gap-3 rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)]/50 px-3 py-2"
      >
        <span
          aria-hidden
          className={cn(
            "h-8 w-1 shrink-0 rounded-full",
            isLeave
              ? "bg-[var(--color-coral)]"
              : isTimeBlock
                ? "bg-[var(--color-mint)]"
                : "bg-[var(--color-border-strong)]",
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[var(--color-muted)]">{item.title}</p>
          <p className="truncate text-xs text-[var(--color-faint)]">
            {isLeave
              ? "Leave · unavailable"
              : isTimeBlock
                ? `${item.category ? BLOCK_META[item.category].label : "Time block"} · managed in DayOtter`
                : "Busy · from your connected calendar · read-only"}
          </p>
        </div>
        <p className="shrink-0 text-xs text-[var(--color-muted)]">{time}</p>
      </div>
    );
    if (!readOnly && (isLeave || isTimeBlock)) {
      return (
        <Link href={isLeave ? "/availability#out-of-office" : "/availability#time-blocks"}>
          {content}
        </Link>
      );
    }
    return content;
  }
  if (readOnly) {
    if (item.href) {
      return (
        <Link
          href={item.href}
          className="flex items-center gap-3 rounded-md border border-[var(--color-border)] px-3 py-2 hover:border-[var(--color-accent)]"
        >
          <span
            aria-hidden
            className="h-8 w-1 shrink-0 rounded-full"
            style={{ backgroundColor: eventColorVar(item.color) }}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{item.title}</p>
            <p className="flex items-center gap-1.5 truncate text-xs text-[var(--color-accent)]">
              {item.category ? <StatusBadge category={item.category} compact /> : null}
              Open booking page
            </p>
          </div>
          <p className="shrink-0 text-xs text-[var(--color-muted)]">{time}</p>
        </Link>
      );
    }
    return (
      <div className="flex items-center gap-3 rounded-md border border-[var(--color-border)] px-3 py-2">
        <span
          aria-hidden
          className="h-8 w-1 shrink-0 rounded-full"
          style={{ backgroundColor: eventColorVar(item.color) }}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{item.title}</p>
          <p className="flex items-center gap-1.5 truncate text-xs text-[var(--color-muted)]">
            {item.category ? <StatusBadge category={item.category} /> : "Unavailable"}
          </p>
        </div>
        <p className="shrink-0 text-xs text-[var(--color-muted)]">{time}</p>
      </div>
    );
  }
  return (
    <Link
      href={`/booking/${item.uid}`}
      className="flex items-center gap-3 rounded-md border border-[var(--color-border)] px-3 py-2 hover:border-[var(--color-border-strong)]"
    >
      <span
        aria-hidden
        className="h-8 w-1 shrink-0 rounded-full"
        style={{ backgroundColor: eventColorVar(item.color) }}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.title}</p>
        <p className="truncate text-xs text-[var(--color-muted)]">
          {item.attendees.join(", ") || "No attendees"}
        </p>
      </div>
      <p className="shrink-0 text-xs text-[var(--color-muted)]">{time}</p>
    </Link>
  );
}

function StatusBadge({
  category,
  compact = false,
}: {
  category: BlockCategory;
  compact?: boolean;
}) {
  const meta = BLOCK_META[category];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none",
        meta.className,
      )}
    >
      {compact ? meta.compact : meta.label}
    </span>
  );
}

function MonthGrid({
  rangeStart,
  anchor,
  byDay,
  tz,
  readOnly,
}: {
  rangeStart: DateTime;
  anchor: DateTime;
  byDay: Map<string, CalItem[]>;
  tz: string;
  readOnly: boolean;
}) {
  const today = DateTime.now().setZone(tz).toFormat("yyyy-LL-dd");
  const gridEnd = startOfWeekSun(anchor.endOf("month")).plus({ days: 7 });
  const weeks = Math.max(4, Math.round(gridEnd.diff(rangeStart, "days").days / 7));
  const days: DateTime[] = [];
  for (let i = 0; i < weeks * 7; i++) days.push(rangeStart.plus({ days: i }));

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
      <div className="grid grid-cols-7 border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="px-2 py-1.5 text-center text-xs font-medium text-[var(--color-muted)]"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = day.toFormat("yyyy-LL-dd");
          const inMonth = day.month === anchor.month;
          const evs = byDay.get(key) ?? [];
          return (
            <div
              key={key}
              className={cn(
                "min-h-[92px] border-b border-r border-[var(--color-border)] p-1",
                !inMonth && "bg-[var(--color-surface-2)]/40",
              )}
            >
              <div
                className={cn(
                  "mb-1 text-right text-xs",
                  key === today
                    ? "font-semibold text-[var(--color-accent)]"
                    : inMonth
                      ? "text-[var(--color-muted)]"
                      : "text-[var(--color-faint)]",
                )}
              >
                {day.day}
              </div>
              <div className="space-y-0.5">
                {evs.slice(0, 3).map((it) => (
                  <EventChip key={it.id} item={it} tz={tz} readOnly={readOnly} compact={readOnly} />
                ))}
                {evs.length > 3 ? (
                  <p className="px-1.5 text-xs text-[var(--color-faint)]">+{evs.length - 3} more</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekGrid({
  rangeStart,
  byDay,
  tz,
  readOnly,
}: {
  rangeStart: DateTime;
  byDay: Map<string, CalItem[]>;
  tz: string;
  readOnly: boolean;
}) {
  const today = DateTime.now().setZone(tz).toFormat("yyyy-LL-dd");
  const days = Array.from({ length: 7 }, (_, i) => rangeStart.plus({ days: i }));
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
      {days.map((day) => {
        const key = day.toFormat("yyyy-LL-dd");
        const evs = byDay.get(key) ?? [];
        return (
          <div
            key={key}
            className="rounded-md border border-[var(--color-border)] p-2 sm:min-h-[160px]"
          >
            <div
              className={cn(
                "mb-2 text-xs font-medium",
                key === today ? "text-[var(--color-accent)]" : "text-[var(--color-muted)]",
              )}
            >
              {day.toFormat("ccc d")}
            </div>
            <div className="space-y-1">
              {evs.length === 0 ? (
                <p className="text-xs text-[var(--color-faint)]">-</p>
              ) : (
                evs.map((it) => <EventChip key={it.id} item={it} tz={tz} readOnly={readOnly} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Agenda({
  rangeStart,
  rangeEnd,
  byDay,
  tz,
  readOnly,
}: {
  rangeStart: DateTime;
  rangeEnd: DateTime;
  byDay: Map<string, CalItem[]>;
  tz: string;
  readOnly: boolean;
}) {
  const days: DateTime[] = [];
  for (let d = rangeStart; d < rangeEnd; d = d.plus({ days: 1 })) {
    if ((byDay.get(d.toFormat("yyyy-LL-dd")) ?? []).length > 0) days.push(d);
  }
  if (days.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-[var(--color-muted)]">
        Nothing scheduled in this range.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      {days.map((day) => (
        <div key={day.toISO()} className="flex gap-4">
          <div className="w-16 shrink-0 pt-0.5">
            <p className="text-sm font-semibold">{day.toFormat("ccc")}</p>
            <p className="text-xs text-[var(--color-muted)]">{day.toFormat("LLL d")}</p>
          </div>
          <div className="flex-1 space-y-1.5">
            {(byDay.get(day.toFormat("yyyy-LL-dd")) ?? []).map((it) => (
              <AgendaRow key={it.id} item={it} tz={tz} readOnly={readOnly} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
