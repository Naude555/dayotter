import { and, eq, getDb, gte, inArray, lte, ne, schema } from "@dayotter/db";
import { DateTime } from "luxon";

/** A teammate that can be picked as a delegate. */
export interface Teammate {
  id: string;
  name: string | null;
  handle: string | null;
}

/** An out-of-office period with its delegate (if any) resolved for display. */
export interface OooPeriod {
  id: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  delegate: Teammate | null;
}

export interface OutOfOfficeCalendarDay {
  dateKey: string;
  startsAt: string;
  endsAt: string;
}

/** Expand an inclusive OOO date range into local all-day calendar entries. */
export function outOfOfficeCalendarDays(
  period: { startDate: string; endDate: string },
  timezone: string,
  rangeStart: Date,
  rangeEnd: Date,
): OutOfOfficeCalendarDay[] {
  let day = DateTime.fromISO(period.startDate, { zone: timezone }).startOf("day");
  const last = DateTime.fromISO(period.endDate, { zone: timezone }).startOf("day");
  if (!day.isValid || !last.isValid || day > last) return [];

  const days: OutOfOfficeCalendarDay[] = [];
  for (; day <= last; day = day.plus({ days: 1 })) {
    const next = day.plus({ days: 1 });
    if (next.toMillis() > rangeStart.getTime() && day.toMillis() < rangeEnd.getTime()) {
      days.push({
        dateKey: day.toISODate()!,
        startsAt: day.toUTC().toISO()!,
        endsAt: next.toUTC().toISO()!,
      });
    }
  }
  return days;
}

/**
 * Distinct users who share at least one team with `userId` (excluding self). Used
 * to populate - and validate - the delegate picker: you can only redirect bookings
 * to someone you actually share a team with. Two small queries instead of a
 * self-join keeps it alias-free.
 */
export async function listTeammates(userId: string): Promise<Teammate[]> {
  const db = getDb();
  const myTeams = await db.query.teamMembers.findMany({
    where: eq(schema.teamMembers.userId, userId),
    columns: { teamId: true },
  });
  const teamIds = myTeams.map((m) => m.teamId);
  if (teamIds.length === 0) return [];

  const peers = await db.query.teamMembers.findMany({
    where: and(inArray(schema.teamMembers.teamId, teamIds), ne(schema.teamMembers.userId, userId)),
    columns: { userId: true },
  });
  const peerIds = [...new Set(peers.map((p) => p.userId))];
  if (peerIds.length === 0) return [];

  const users = await db.query.users.findMany({
    where: inArray(schema.users.id, peerIds),
    columns: { id: true, name: true, handle: true },
  });
  return users
    .map((u) => ({ id: u.id, name: u.name, handle: u.handle }))
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
}

/** True if `delegateId` is a valid delegate for `userId` (shares a team). */
export async function isValidDelegate(userId: string, delegateId: string): Promise<boolean> {
  const teammates = await listTeammates(userId);
  return teammates.some((t) => t.id === delegateId);
}

/** Attach the delegate record to a set of OOO rows in a single lookup. */
async function withDelegates(
  rows: {
    id: string;
    startDate: string;
    endDate: string;
    reason: string | null;
    delegateUserId: string | null;
  }[],
): Promise<OooPeriod[]> {
  const delegateIds = [
    ...new Set(rows.map((r) => r.delegateUserId).filter((x): x is string => !!x)),
  ];
  const byId = new Map<string, Teammate>();
  if (delegateIds.length) {
    const users = await getDb().query.users.findMany({
      where: inArray(schema.users.id, delegateIds),
      columns: { id: true, name: true, handle: true },
    });
    for (const u of users) byId.set(u.id, { id: u.id, name: u.name, handle: u.handle });
  }
  return rows.map((r) => ({
    id: r.id,
    startDate: r.startDate,
    endDate: r.endDate,
    reason: r.reason,
    delegate: r.delegateUserId ? (byId.get(r.delegateUserId) ?? null) : null,
  }));
}

/** All of a user's OOO periods, soonest first, with delegates resolved. */
export async function listOutOfOffice(userId: string): Promise<OooPeriod[]> {
  const rows = await getDb().query.outOfOfficePeriods.findMany({
    where: eq(schema.outOfOfficePeriods.userId, userId),
    orderBy: (t, { asc }) => asc(t.startDate),
    columns: { id: true, startDate: true, endDate: true, reason: true, delegateUserId: true },
  });
  return withDelegates(rows);
}

/**
 * The OOO period covering `onDate` (YYYY-MM-DD) for a user, if any - so the public
 * booking page can show an "away" banner and redirect to the delegate. Returns the
 * earliest-starting match when ranges overlap.
 */
export async function outOfOfficeOn(userId: string, onDate: string): Promise<OooPeriod | null> {
  const rows = await getDb().query.outOfOfficePeriods.findMany({
    where: and(
      eq(schema.outOfOfficePeriods.userId, userId),
      lte(schema.outOfOfficePeriods.startDate, onDate),
      gte(schema.outOfOfficePeriods.endDate, onDate),
    ),
    orderBy: (t, { asc }) => asc(t.startDate),
    limit: 1,
    columns: { id: true, startDate: true, endDate: true, reason: true, delegateUserId: true },
  });
  if (rows.length === 0) return null;
  return (await withDelegates(rows))[0] ?? null;
}
