import { syncedExternalEvents } from "@/lib/calendar/agenda";
import { outOfOfficeCalendarDays } from "@/lib/out-of-office";
import { jsonError, withUser } from "@/lib/server/http";
import { and, asc, eq, getDb, gte, lt, lte, ne, schema } from "@dayotter/db";
import { DateTime } from "luxon";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Bookings for the host within [start, end) - powers the calendar views.
 * Cancelled bookings are excluded. Colour comes from the event type.
 */
export const GET = withUser(async (u, request) => {
  const url = new URL(request.url);
  const startParam = url.searchParams.get("start");
  const endParam = url.searchParams.get("end");
  const start = startParam ? new Date(startParam) : null;
  const end = endParam ? new Date(endParam) : null;
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return jsonError("Invalid range", 400);
  }
  // Guard against unbounded ranges (max ~100 days).
  if (end.getTime() - start.getTime() > 100 * 24 * 60 * 60_000) {
    return jsonError("Range too large", 400);
  }

  const db = getDb();
  const fromDate = DateTime.fromJSDate(start).minus({ days: 1 }).toISODate()!;
  const toDate = DateTime.fromJSDate(end).plus({ days: 1 }).toISODate()!;
  const [rows, syncedEvents, leave, user] = await Promise.all([
    db.query.bookings.findMany({
      where: and(
        eq(schema.bookings.hostId, u.id),
        ne(schema.bookings.status, "cancelled"),
        gte(schema.bookings.startsAt, start),
        lt(schema.bookings.startsAt, end),
      ),
      orderBy: asc(schema.bookings.startsAt),
      with: {
        attendees: { columns: { name: true, email: true } },
        eventType: { columns: { color: true } },
      },
    }),
    syncedExternalEvents(u.id, start, end),
    db.query.outOfOfficePeriods.findMany({
      where: and(
        eq(schema.outOfOfficePeriods.userId, u.id),
        lte(schema.outOfOfficePeriods.startDate, toDate),
        gte(schema.outOfOfficePeriods.endDate, fromDate),
      ),
      columns: { id: true, startDate: true, endDate: true },
    }),
    db.query.users.findFirst({
      where: eq(schema.users.id, u.id),
      columns: { timezone: true },
    }),
  ]);
  const timezone = user?.timezone ?? "UTC";

  // Also surface the host's real (synced) calendar events, so the calendar shows
  // their whole schedule - not just DayOtter bookings. Shared with the AI agenda.
  const events: {
    title: string;
    startsAt: string;
    endsAt: string;
    source: "calendar" | "out_of_office";
    allDay?: boolean;
    dateKey?: string;
  }[] = syncedEvents.map((e) => ({
    title: e.title,
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt.toISOString(),
    source: "calendar" as const,
  }));
  for (const period of leave) {
    for (const day of outOfOfficeCalendarDays(period, timezone, start, end)) {
      events.push({
        title: "Out of office",
        startsAt: day.startsAt,
        endsAt: day.endsAt,
        source: "out_of_office",
        allDay: true,
        dateKey: day.dateKey,
      });
    }
  }

  return NextResponse.json({
    bookings: rows.map((b) => ({
      uid: b.uid,
      title: b.title,
      startsAt: b.startsAt.toISOString(),
      endsAt: b.endsAt.toISOString(),
      status: b.status,
      color: b.eventType?.color ?? null,
      attendees: b.attendees.map((a) => a.name ?? a.email),
    })),
    events,
  });
});
