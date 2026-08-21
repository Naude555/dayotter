import { randomBytes } from "node:crypto";
import { getSession } from "@/lib/auth/session";
import { and, eq, getDb, schema } from "@dayotter/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const body = z.object({
  enabled: z.boolean(),
  regenerate: z.boolean().optional().default(false),
});

/** Enable, revoke, or rotate a team's capability-style public calendar link. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
  if (!caller || (caller.role !== "owner" && caller.role !== "admin")) {
    return NextResponse.json({ error: "Only team admins can manage sharing" }, { status: 403 });
  }

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid sharing setting" }, { status: 400 });

  const team = await db.query.teams.findFirst({
    where: eq(schema.teams.id, teamId),
    columns: { publicScheduleToken: true },
  });
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const token = parsed.data.enabled
    ? !team.publicScheduleToken || parsed.data.regenerate
      ? randomBytes(24).toString("base64url")
      : team.publicScheduleToken
    : null;
  await db
    .update(schema.teams)
    .set({ publicScheduleToken: token })
    .where(eq(schema.teams.id, teamId));

  return NextResponse.json({ enabled: token !== null, token });
}
