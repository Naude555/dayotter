import {
  teamCalendarItems,
  teamCalendarMembers,
  teamCalendarRange,
} from "@/lib/booking/team-calendar";
import { eq, getDb, schema } from "@dayotter/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const range = teamCalendarRange(request);
  if (!range) return NextResponse.json({ error: "Invalid range" }, { status: 400 });
  const team = await getDb().query.teams.findFirst({
    where: eq(schema.teams.publicScheduleToken, token),
    columns: { id: true },
    with: {
      members: {
        columns: { userId: true },
        with: { user: { columns: { name: true, timezone: true, handle: true } } },
      },
    },
  });
  if (!team) return NextResponse.json({ error: "Calendar not found" }, { status: 404 });

  const members = team.members.map((row) => ({
    userId: row.userId,
    name: row.user?.name ?? "Team member",
    timezone: row.user?.timezone ?? "UTC",
    handle: row.user?.handle ?? null,
  }));
  const bookings = await teamCalendarItems(team.id, members, range.start, range.end);
  return NextResponse.json({ bookings, events: [], members: teamCalendarMembers(members) });
}
