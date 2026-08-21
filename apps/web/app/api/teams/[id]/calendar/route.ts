import { getSession } from "@/lib/auth/session";
import {
  teamCalendarItems,
  teamCalendarMembers,
  teamCalendarRange,
} from "@/lib/booking/team-calendar";
import { and, eq, getDb, schema } from "@dayotter/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: teamId } = await params;
  const db = getDb();
  const caller = await db.query.teamMembers.findFirst({
    where: and(
      eq(schema.teamMembers.teamId, teamId),
      eq(schema.teamMembers.userId, session.user.id),
    ),
  });
  if (!caller) return NextResponse.json({ error: "Not a team member" }, { status: 403 });
  const range = teamCalendarRange(request);
  if (!range) return NextResponse.json({ error: "Invalid range" }, { status: 400 });

  const rows = await db.query.teamMembers.findMany({
    where: eq(schema.teamMembers.teamId, teamId),
    with: { user: { columns: { name: true, timezone: true, handle: true } } },
  });
  const members = rows.map((row) => ({
    userId: row.userId,
    name: row.user?.name ?? "Team member",
    timezone: row.user?.timezone ?? "UTC",
    handle: row.user?.handle ?? null,
  }));
  const bookings = await teamCalendarItems(teamId, members, range.start, range.end);
  return NextResponse.json({ bookings, events: [], members: teamCalendarMembers(members) });
}
