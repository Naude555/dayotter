import { getSession } from "@/lib/auth/session";
import { createHostBooking } from "@/lib/booking/host-booking";
import { internalTeamBookingConflicts } from "@/lib/booking/internal-team-booking";
import { and, eq, getDb, schema } from "@dayotter/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const body = z.object({
  eventTypeId: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
  start: z.string().datetime(),
  durationMinutes: z.number().int().min(5).max(480),
  notes: z.string().trim().max(2000).optional(),
  confirmConflicts: z.boolean().default(false),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: teamId } = await params;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid team booking" }, { status: 400 });
  }

  const db = getDb();
  const team = await db.query.teams.findFirst({
    where: eq(schema.teams.id, teamId),
    with: { members: { with: { user: true } } },
  });
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });
  const caller = team.members.find((member) => member.userId === session.user.id);
  if (!caller?.user) return NextResponse.json({ error: "Not a team member" }, { status: 403 });

  const eventType = await db.query.eventTypes.findFirst({
    where: and(
      eq(schema.eventTypes.id, parsed.data.eventTypeId),
      eq(schema.eventTypes.teamId, teamId),
      eq(schema.eventTypes.schedulingType, "collective"),
    ),
  });
  if (!eventType) {
    return NextResponse.json({ error: "Collective team event not found" }, { status: 404 });
  }

  const start = new Date(parsed.data.start);
  const end = new Date(start.getTime() + parsed.data.durationMinutes * 60_000);
  const members = team.members
    .filter((member) => member.user)
    .map((member) => ({
      userId: member.userId,
      name: member.user!.name ?? "Team member",
      timezone: member.user!.timezone ?? "UTC",
      handle: member.user!.handle ?? null,
    }));
  const conflicts = await internalTeamBookingConflicts(teamId, members, start, end);
  if (conflicts.length > 0 && !parsed.data.confirmConflicts) {
    return NextResponse.json(
      {
        error: "Some team members already have calendar commitments.",
        requiresConfirmation: true,
        conflicts,
      },
      { status: 409 },
    );
  }

  const result = await createHostBooking({
    userId: caller.userId,
    eventTypeId: eventType.id,
    participantUserIds: members.map((member) => member.userId),
    allowOverlap: true,
    title: parsed.data.title,
    start,
    end,
    timezone: caller.user.timezone ?? "UTC",
    notes: parsed.data.notes,
    location: eventType.location,
    locationDetail: eventType.locationDetail ?? undefined,
    attendees: team.members
      .filter((member) => member.userId !== caller.userId && member.user?.email)
      .map((member) => ({
        email: member.user!.email,
        name: member.user!.name ?? undefined,
      })),
  });
  if (!result) return NextResponse.json({ error: "Could not create booking" }, { status: 500 });

  return NextResponse.json({
    uid: result.uid,
    url: `/booking/${result.uid}`,
    conflicts,
  });
}
