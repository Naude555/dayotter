import { TeamBookingPage } from "@/components/team-booking-page";
import { and, asc, eq, getDb, inArray, schema } from "@dayotter/db";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PublicTeamBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamSlug: string }>;
  searchParams: Promise<{ event?: string }>;
}) {
  const { teamSlug } = await params;
  const { event: requestedEvent } = await searchParams;
  const db = getDb();

  const team = await db.query.teams.findFirst({
    where: eq(schema.teams.slug, teamSlug),
    with: { members: { with: { user: true } } },
  });
  if (!team) notFound();

  const events = await db.query.eventTypes.findMany({
    where: and(eq(schema.eventTypes.teamId, team.id), eq(schema.eventTypes.isActive, true)),
    orderBy: asc(schema.eventTypes.createdAt),
  });
  if (events.length === 0) notFound();

  const hostRows = await db.query.eventTypeHosts.findMany({
    where: inArray(
      schema.eventTypeHosts.eventTypeId,
      events.map((event) => event.id),
    ),
    columns: { eventTypeId: true, userId: true },
  });
  const memberByUserId = new Map(
    team.members
      .filter((member) => member.user)
      .map((member) => [
        member.userId,
        { id: member.userId, name: member.user!.name ?? "Team member" },
      ]),
  );
  const initialEvent = events.find(
    (event) => event.slug === requestedEvent || event.id === requestedEvent,
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <TeamBookingPage
        teamName={team.name}
        members={[...memberByUserId.values()]}
        initialEventId={initialEvent?.id ?? events[0]!.id}
        events={events.map((event) => ({
          id: event.id,
          title: event.title,
          durationMinutes: event.durationMinutes,
          durationOptions: event.durationOptions ?? [],
          schedulingType: event.schedulingType,
          hosts: hostRows
            .filter((host) => host.eventTypeId === event.id)
            .map((host) => memberByUserId.get(host.userId))
            .filter((host): host is { id: string; name: string } => Boolean(host)),
        }))}
      />
      <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-[var(--color-faint)]">
        <span className="relative inline-block h-3.5 w-3.5 shrink-0 overflow-hidden rounded-[3px]">
          <img
            src="/brand/dayotter-icon.svg"
            alt=""
            width={21}
            height={21}
            className="absolute -left-[3px] -top-[3px] max-w-none"
          />
        </span>
        Powered by <span className="text-[var(--color-muted)]">DayOtter</span>
      </p>
    </main>
  );
}
