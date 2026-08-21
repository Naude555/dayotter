import { BookingsCalendar } from "@/components/bookings-calendar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { and, eq, getDb, schema } from "@dayotter/db";
import { ShieldCheck, Users } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function PublicTeamCalendarPage({
  params,
}: {
  params: Promise<{ teamSlug: string; token: string }>;
}) {
  const { teamSlug, token } = await params;
  const db = getDb();
  const team = await db.query.teams.findFirst({
    where: and(eq(schema.teams.slug, teamSlug), eq(schema.teams.publicScheduleToken, token)),
    with: { members: { with: { user: true } } },
  });
  if (!team || team.members.length === 0) notFound();

  const referenceSchedule = await db.query.schedules.findFirst({
    where: and(
      eq(schema.schedules.userId, team.members[0]!.userId),
      eq(schema.schedules.isDefault, true),
    ),
    columns: { timezone: true },
  });
  const timezone = referenceSchedule?.timezone ?? "UTC";

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-7 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
          <Users size={20} />
        </div>
        <p className="eyebrow mt-4">Shared availability</p>
        <h1 className="font-display mt-2 text-3xl tracking-[-0.02em]">{team.name}</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          See when team members are booked or unavailable, shown in {timezone}.
        </p>
      </div>

      <Card>
        <CardHeader
          title="Team schedule"
          description="Switch between month, week, and agenda views."
        />
        <CardBody>
          <BookingsCalendar
            tz={timezone}
            endpoint={`/api/public/team-calendar/${token}`}
            readOnly
          />
        </CardBody>
      </Card>

      <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-[var(--color-faint)]">
        <ShieldCheck size={13} /> Only busy status is shared — calendar details stay private.
      </p>
    </main>
  );
}
