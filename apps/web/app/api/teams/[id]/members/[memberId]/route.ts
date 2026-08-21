import { getSession } from "@/lib/auth/session";
import { and, eq, getDb, schema } from "@dayotter/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const body = z.union([
  z.object({ priority: z.number().int().min(0).max(10) }),
  z.object({ role: z.literal("owner") }),
]);

/**
 * Update a member's round-robin weight, or let the current owner transfer
 * ownership. Weight changes propagate to existing team event host rows.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const session = await getSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: teamId, memberId } = await params;
  const db = getDb();

  const caller = await db.query.teamMembers.findFirst({
    where: and(
      eq(schema.teamMembers.teamId, teamId),
      eq(schema.teamMembers.userId, session.user.id),
    ),
  });
  if (!caller) return NextResponse.json({ error: "Not a team member" }, { status: 403 });

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid member update" }, { status: 400 });

  const member = await db.query.teamMembers.findFirst({
    where: and(eq(schema.teamMembers.id, memberId), eq(schema.teamMembers.teamId, teamId)),
  });
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  if ("role" in parsed.data) {
    if (caller.role !== "owner") {
      return NextResponse.json(
        { error: "Only the team owner can transfer ownership" },
        { status: 403 },
      );
    }
    if (member.id === caller.id) return NextResponse.json({ ok: true });
    await db.transaction(async (tx) => {
      await tx
        .update(schema.teamMembers)
        .set({ role: "admin" })
        .where(eq(schema.teamMembers.id, caller.id));
      await tx
        .update(schema.teamMembers)
        .set({ role: "owner" })
        .where(eq(schema.teamMembers.id, member.id));
    });
    return NextResponse.json({ ok: true });
  }

  if (caller.role !== "owner" && caller.role !== "admin") {
    return NextResponse.json({ error: "Only team admins can change weights" }, { status: 403 });
  }

  await db
    .update(schema.teamMembers)
    .set({ priority: parsed.data.priority })
    .where(eq(schema.teamMembers.id, memberId));

  // Reflect the new weight on this member's host rows for the team's event types.
  const teamEventTypes = await db.query.eventTypes.findMany({
    where: eq(schema.eventTypes.teamId, teamId),
    columns: { id: true },
  });
  if (teamEventTypes.length > 0) {
    for (const et of teamEventTypes) {
      await db
        .update(schema.eventTypeHosts)
        .set({ priority: parsed.data.priority })
        .where(
          and(
            eq(schema.eventTypeHosts.eventTypeId, et.id),
            eq(schema.eventTypeHosts.userId, member.userId),
          ),
        );
    }
  }

  return NextResponse.json({ ok: true });
}

/**
 * Remove a member from the team. Admins/owners can remove anyone; any member can
 * remove (leave) themselves. The owner can't leave or be removed - they must
 * transfer ownership or delete the team first.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const session = await getSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: teamId, memberId } = await params;
  const db = getDb();

  const caller = await db.query.teamMembers.findFirst({
    where: and(
      eq(schema.teamMembers.teamId, teamId),
      eq(schema.teamMembers.userId, session.user.id),
    ),
  });
  if (!caller) {
    return NextResponse.json({ error: "You're not a member of this team" }, { status: 403 });
  }

  const member = await db.query.teamMembers.findFirst({
    where: and(eq(schema.teamMembers.id, memberId), eq(schema.teamMembers.teamId, teamId)),
  });
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });
  const leaving = member.userId === session.user.id;
  if (!leaving && caller.role !== "owner" && caller.role !== "admin") {
    return NextResponse.json({ error: "Only team admins can remove members" }, { status: 403 });
  }
  if (member.role === "owner") {
    return NextResponse.json(
      {
        error: "The team owner can't leave or be removed - transfer ownership or delete the team.",
      },
      { status: 400 },
    );
  }

  const teamEventTypes = await db.query.eventTypes.findMany({
    where: eq(schema.eventTypes.teamId, teamId),
    columns: { id: true },
  });
  await db.transaction(async (tx) => {
    await tx.delete(schema.teamMembers).where(eq(schema.teamMembers.id, memberId));
    // A former member must not remain eligible for the team's event types.
    for (const et of teamEventTypes) {
      await tx
        .delete(schema.eventTypeHosts)
        .where(
          and(
            eq(schema.eventTypeHosts.eventTypeId, et.id),
            eq(schema.eventTypeHosts.userId, member.userId),
          ),
        );
    }
  });

  return NextResponse.json({ ok: true, left: leaving });
}
