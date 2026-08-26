import { and, asc, eq, getDb, inArray, schema } from "@dayotter/db";

export interface PublicTeamBookingData {
  teamName: string;
  members: { id: string; name: string }[];
  initialEventId: string;
  events: {
    id: string;
    title: string;
    durationMinutes: number;
    durationOptions: number[];
    schedulingType: string;
    hosts: { id: string; name: string }[];
  }[];
}

/** Load the public-safe team event catalogue shared by the full page and iframe. */
export async function publicTeamBookingData(
  teamSlug: string,
  requestedEvent?: string,
): Promise<PublicTeamBookingData | null> {
  const db = getDb();
  const team = await db.query.teams.findFirst({
    where: eq(schema.teams.slug, teamSlug),
    with: { members: { with: { user: true } } },
  });
  if (!team) return null;

  const events = await db.query.eventTypes.findMany({
    where: and(eq(schema.eventTypes.teamId, team.id), eq(schema.eventTypes.isActive, true)),
    orderBy: asc(schema.eventTypes.createdAt),
  });
  if (events.length === 0) return null;

  const hostRows = await db.query.eventTypeHosts.findMany({
    where: inArray(
      schema.eventTypeHosts.eventTypeId,
      events.map((event) => event.id),
    ),
    columns: { eventTypeId: true, userId: true },
  });
  const memberByUserId = new Map(
    team.members
      .filter((member) => member.user && member.publicBookable)
      .map((member) => [
        member.userId,
        { id: member.userId, name: member.user!.name ?? "Team member" },
      ]),
  );
  const initialEvent = events.find(
    (event) => event.slug === requestedEvent || event.id === requestedEvent,
  );

  return {
    teamName: team.name,
    members: [...memberByUserId.values()],
    initialEventId: initialEvent?.id ?? events[0]!.id,
    events: events.map((event) => ({
      id: event.id,
      title: event.title,
      durationMinutes: event.durationMinutes,
      durationOptions: event.durationOptions ?? [],
      schedulingType: event.schedulingType,
      hosts: hostRows
        .filter((host) => host.eventTypeId === event.id)
        .map((host) => memberByUserId.get(host.userId))
        .filter((host): host is { id: string; name: string } => Boolean(host)),
    })),
  };
}
