import { and, asc, eq, getDb, gte, inArray, lt, lte, ne, schema } from "@dayotter/db";
import { DateTime } from "luxon";
import { syncedExternalEvents } from "../calendar/agenda";
import { outOfOfficeCalendarDays } from "../out-of-office";

const MEMBER_COLORS = ["violet", "mint", "amber", "coral", "sky"];
const MAX_RANGE_MS = 100 * 24 * 60 * 60_000;

export interface TeamCalendarMember {
  userId: string;
  name: string;
  timezone: string;
  handle: string | null;
}

export interface TeamCalendarItem {
  uid: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: string;
  color: string;
  attendees: string[];
  href: string | null;
  allDay?: boolean;
  dateKey?: string;
  category:
    | "booked"
    | "focus"
    | "personal"
    | "travel"
    | "unavailable"
    | "busy"
    | "out_of_office"
    | "holiday";
}

export function teamCalendarMembers(members: TeamCalendarMember[]) {
  return members.map((member, index) => ({
    id: member.userId,
    name: member.name,
    href: member.handle ? `/${member.handle}` : null,
    color: MEMBER_COLORS[index % MEMBER_COLORS.length] ?? "violet",
  }));
}

/** Parse and cap a calendar request range before it reaches a database query. */
export function teamCalendarRange(request: Request): { start: Date; end: Date } | null {
  const url = new URL(request.url);
  const start = new Date(url.searchParams.get("start") ?? "");
  const end = new Date(url.searchParams.get("end") ?? "");
  const duration = end.getTime() - start.getTime();
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    duration <= 0 ||
    duration > MAX_RANGE_MS
  ) {
    return null;
  }
  return { start, end };
}

/**
 * Privacy-safe team schedule items for the shared calendar. Every source that
 * blocks booking is represented, but private titles, attendees, and email
 * addresses never leave this function.
 */
export async function teamCalendarItems(
  teamId: string,
  members: TeamCalendarMember[],
  start: Date,
  end: Date,
): Promise<TeamCalendarItem[]> {
  if (members.length === 0) return [];
  const db = getDb();
  const memberIds = members.map((member) => member.userId);
  const memberById = new Map(members.map((member, index) => [member.userId, { member, index }]));
  const fromDate = DateTime.fromJSDate(start).minus({ days: 1 }).toISODate()!;
  const toDate = DateTime.fromJSDate(end).plus({ days: 1 }).toISODate()!;

  const [bookings, blocks, leave, holidays, externalByMember] = await Promise.all([
    db.query.bookings.findMany({
      where: and(
        inArray(schema.bookings.hostId, memberIds),
        ne(schema.bookings.status, "cancelled"),
        lt(schema.bookings.startsAt, end),
        gte(schema.bookings.endsAt, start),
      ),
      columns: { id: true, hostId: true, startsAt: true, endsAt: true },
      orderBy: asc(schema.bookings.startsAt),
    }),
    db.query.timeBlocks.findMany({
      where: and(
        inArray(schema.timeBlocks.userId, memberIds),
        lt(schema.timeBlocks.startsAt, end),
        gte(schema.timeBlocks.endsAt, start),
      ),
      columns: { id: true, userId: true, kind: true, startsAt: true, endsAt: true },
      orderBy: asc(schema.timeBlocks.startsAt),
    }),
    db.query.outOfOfficePeriods.findMany({
      where: and(
        inArray(schema.outOfOfficePeriods.userId, memberIds),
        lte(schema.outOfOfficePeriods.startDate, toDate),
        gte(schema.outOfOfficePeriods.endDate, fromDate),
      ),
      columns: { id: true, userId: true, startDate: true, endDate: true },
    }),
    db.query.teamRules.findMany({
      where: and(
        eq(schema.teamRules.teamId, teamId),
        eq(schema.teamRules.kind, "holiday"),
        lte(schema.teamRules.theDate, toDate),
        gte(schema.teamRules.theDate, fromDate),
      ),
      columns: { id: true, label: true, theDate: true },
    }),
    Promise.all(
      members.map((member) =>
        syncedExternalEvents(member.userId, start, end, 500, true).then((events) => ({
          member,
          events,
        })),
      ),
    ),
  ]);

  const item = (
    uid: string,
    userId: string,
    label: string,
    category: TeamCalendarItem["category"],
    startsAt: Date,
    endsAt: Date,
  ): TeamCalendarItem | null => {
    const entry = memberById.get(userId);
    if (!entry) return null;
    return {
      uid,
      title: `${entry.member.name} · ${label}`,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      status: "confirmed",
      color: MEMBER_COLORS[entry.index % MEMBER_COLORS.length] ?? "violet",
      attendees: [],
      href: entry.member.handle ? `/${entry.member.handle}` : null,
      category,
    };
  };

  const items: TeamCalendarItem[] = [];
  for (const booking of bookings) {
    const row = item(
      `booking:${booking.id}`,
      booking.hostId,
      "Booked",
      "booked",
      booking.startsAt,
      booking.endsAt,
    );
    if (row) items.push(row);
  }
  for (const block of blocks) {
    const category =
      block.kind === "focus"
        ? "focus"
        : block.kind === "personal"
          ? "personal"
          : block.kind === "travel"
            ? "travel"
            : "unavailable";
    const label =
      category === "focus"
        ? "Deep work"
        : category === "personal"
          ? "Personal"
          : category === "travel"
            ? "Travel"
            : "Unavailable";
    const row = item(
      `block:${block.id}`,
      block.userId,
      label,
      category,
      block.startsAt,
      block.endsAt,
    );
    if (row) items.push(row);
  }
  for (const { member, events } of externalByMember) {
    for (const event of events) {
      const row = item(
        `external:${member.userId}:${event.startsAt.toISOString()}`,
        member.userId,
        "Busy",
        "busy",
        event.startsAt,
        event.endsAt,
      );
      if (row) items.push(row);
    }
  }
  for (const period of leave) {
    const member = memberById.get(period.userId)?.member;
    if (!member) continue;
    for (const [index, day] of outOfOfficeCalendarDays(
      period,
      member.timezone,
      start,
      end,
    ).entries()) {
      const row = item(
        `leave:${period.id}:${index}`,
        period.userId,
        "Out of office",
        "out_of_office",
        new Date(day.startsAt),
        new Date(day.endsAt),
      );
      if (row) items.push({ ...row, allDay: true, dateKey: day.dateKey });
    }
  }

  const teamZone = members[0]?.timezone ?? "UTC";
  for (const holiday of holidays) {
    if (!holiday.theDate) continue;
    const day = DateTime.fromISO(holiday.theDate, { zone: teamZone }).startOf("day");
    items.push({
      uid: `holiday:${holiday.id}`,
      title: `Team · ${holiday.label || "Holiday"}`,
      startsAt: day.toJSDate().toISOString(),
      endsAt: day.plus({ days: 1 }).toJSDate().toISOString(),
      status: "confirmed",
      color: "coral",
      attendees: [],
      href: null,
      allDay: true,
      dateKey: holiday.theDate,
      category: "holiday",
    });
  }

  return items.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
