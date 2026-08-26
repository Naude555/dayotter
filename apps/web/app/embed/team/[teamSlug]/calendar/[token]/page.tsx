import { BookingsCalendar } from "@/components/bookings-calendar";
import { EmbedBridge } from "@/components/embed-bridge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { and, eq, getDb, schema } from "@dayotter/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function EmbedTeamCalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamSlug: string; token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { teamSlug, token } = await params;
  const query = await searchParams;
  const requestedTheme = typeof query.theme === "string" ? query.theme : "auto";
  const theme = requestedTheme === "dark" ? "dark" : requestedTheme === "light" ? "light" : "auto";
  const db = getDb();
  const team = await db.query.teams.findFirst({
    where: and(eq(schema.teams.slug, teamSlug), eq(schema.teams.publicScheduleToken, token)),
    with: { members: { columns: { userId: true } } },
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
    <main className="mx-auto max-w-6xl px-2 py-2 sm:px-4 sm:py-4">
      <EmbedBridge theme={theme} />
      <Card>
        <CardHeader
          title={`${team.name} availability`}
          description={`Bookings and unavailable time, shown in ${timezone}.`}
        />
        <CardBody>
          <BookingsCalendar
            tz={timezone}
            endpoint={`/api/public/team-calendar/${token}`}
            readOnly
            defaultView="agenda"
          />
        </CardBody>
      </Card>
    </main>
  );
}
