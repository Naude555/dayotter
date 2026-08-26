import { and, asc, eq, getDb, gte, inArray, lt, ne, schema } from "@dayotter/db";

/**
 * One item on the host's real agenda - a DayOtter booking, an app-owned time
 * block, or a busy event synced from a connected calendar. This is what calendar
 * views and the AI assistant should both see: an agenda that only knows its own
 * bookings is blind to the rest of the host's actual calendar.
 */
export interface AgendaItem {
  title: string;
  startsAt: Date;
  endsAt: Date;
  /** DayOtter items are actionable; synced calendar events remain read-only. */
  source: "booking" | "external" | "time_block";
  attendees: string[];
  /** Public booking id (only for `source: "booking"`), so it can be acted on. */
  uid?: string;
  /** Internal id for app-owned agenda items other than bookings. */
  id?: string;
  /** The kind of a first-class DayOtter time block. */
  category?: "focus" | "personal" | "travel" | "unavailable";
}

/**
 * Busy, non-all-day events synced from the host's conflict-checked calendars in
 * [from, to). Mirrors of DayOtter bookings we wrote to the calendar are excluded
 * (by external id) so a booking never shows up twice. Shared by the calendar
 * range API and the AI agenda so the two can never drift.
 */
export async function syncedExternalEvents(
  userId: string,
  from: Date,
  to: Date,
  limit = 500,
  includeAllDay = false,
): Promise<{ title: string; startsAt: Date; endsAt: Date; allDay: boolean }[]> {
  const db = getDb();
  const conns = await db.query.calendarConnections.findMany({
    where: eq(schema.calendarConnections.userId, userId),
    with: { calendars: { columns: { id: true, checkForConflicts: true } } },
  });
  const calIds = conns
    .flatMap((c) => c.calendars)
    .filter((c) => c.checkForConflicts)
    .map((c) => c.id);
  if (calIds.length === 0) return [];

  const refs = await db.query.bookingReferences.findMany({
    where: inArray(schema.bookingReferences.calendarId, calIds),
    columns: { externalEventId: true },
  });
  const mirrorIds = new Set(refs.map((r) => r.externalEventId));

  const rows = await db.query.calendarEvents.findMany({
    where: and(
      inArray(schema.calendarEvents.calendarId, calIds),
      gte(schema.calendarEvents.endsAt, from),
      lt(schema.calendarEvents.startsAt, to),
      ne(schema.calendarEvents.transparency, "transparent"),
      includeAllDay ? undefined : eq(schema.calendarEvents.allDay, false),
    ),
    columns: {
      title: true,
      startsAt: true,
      endsAt: true,
      allDay: true,
      externalEventId: true,
    },
    orderBy: asc(schema.calendarEvents.startsAt),
    limit,
  });
  return rows
    .filter((e) => !mirrorIds.has(e.externalEventId))
    .map((e) => ({
      title: e.title ?? "Busy",
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      allDay: e.allDay,
    }));
}

/**
 * Merge DayOtter bookings, app-owned time blocks, and synced external events into
 * one chronological, source-tagged agenda. Pure (no I/O) so it can be unit-tested.
 */
export function mergeAgenda(
  bookings: { title: string; startsAt: Date; endsAt: Date; uid: string; attendees: string[] }[],
  external: { title: string; startsAt: Date; endsAt: Date }[],
  limit: number,
  timeBlocks: {
    id: string;
    title: string;
    kind: string;
    startsAt: Date;
    endsAt: Date;
  }[] = [],
): AgendaItem[] {
  const items: AgendaItem[] = [
    ...bookings.map((b) => ({
      title: b.title,
      startsAt: b.startsAt,
      endsAt: b.endsAt,
      source: "booking" as const,
      attendees: b.attendees,
      uid: b.uid,
    })),
    ...external.map((e) => ({
      title: e.title,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      source: "external" as const,
      attendees: [],
    })),
    ...timeBlocks.map((block) => ({
      id: block.id,
      title: block.title,
      startsAt: block.startsAt,
      endsAt: block.endsAt,
      source: "time_block" as const,
      attendees: [],
      category:
        block.kind === "focus"
          ? ("focus" as const)
          : block.kind === "personal"
            ? ("personal" as const)
            : block.kind === "travel"
              ? ("travel" as const)
              : ("unavailable" as const),
    })),
  ];
  items.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  return items.slice(0, limit);
}

/**
 * The host's real agenda over [from, to): DayOtter bookings and time blocks plus
 * synced external calendar events, merged chronologically and capped. This is the
 * source of truth for "what's on my calendar / how busy am I / what's next".
 */
export async function getAgenda(
  userId: string,
  from: Date,
  to: Date,
  limit = 50,
): Promise<AgendaItem[]> {
  const db = getDb();
  const [bookings, external, timeBlocks] = await Promise.all([
    db.query.bookings.findMany({
      where: and(
        eq(schema.bookings.hostId, userId),
        ne(schema.bookings.status, "cancelled"),
        gte(schema.bookings.startsAt, from),
        lt(schema.bookings.startsAt, to),
      ),
      orderBy: asc(schema.bookings.startsAt),
      limit,
      with: { attendees: { columns: { name: true, email: true } } },
    }),
    syncedExternalEvents(userId, from, to, limit),
    db.query.timeBlocks.findMany({
      where: and(
        eq(schema.timeBlocks.userId, userId),
        gte(schema.timeBlocks.endsAt, from),
        lt(schema.timeBlocks.startsAt, to),
      ),
      columns: { id: true, title: true, kind: true, startsAt: true, endsAt: true },
      orderBy: asc(schema.timeBlocks.startsAt),
      limit,
    }),
  ]);

  return mergeAgenda(
    bookings.map((b) => ({
      title: b.title,
      startsAt: b.startsAt,
      endsAt: b.endsAt,
      uid: b.uid,
      attendees: b.attendees.map((a) => a.name ?? a.email),
    })),
    external,
    limit,
    timeBlocks,
  );
}
