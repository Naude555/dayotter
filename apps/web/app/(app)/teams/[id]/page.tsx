import { BookingsCalendar } from "@/components/bookings-calendar";
import { InternalTeamBookingForm } from "@/components/internal-team-booking-form";
import { MemberBookingVisibility } from "@/components/member-booking-visibility";
import { MemberWeight } from "@/components/member-weight";
import { PageHeader } from "@/components/page-header";
import { TeamBookingEmbedCode } from "@/components/team-booking-embed-code";
import { TeamBriefingSettings } from "@/components/team-briefing-settings";
import { TeamCalendarSharing } from "@/components/team-calendar-sharing";
import { TeamEventTypeActions } from "@/components/team-event-type-actions";
import { AddMemberForm, CreateTeamEventForm } from "@/components/team-forms";
import { TeamMemberAction } from "@/components/team-member-action";
import { TeamRules } from "@/components/team-rules";
import { TransferTeamOwnership } from "@/components/transfer-team-ownership";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getSession } from "@/lib/auth/session";
import { and, eq, getDb, schema } from "@dayotter/db";
import { ArrowLeft, ExternalLink, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  collective: "Collective · everyone free",
  round_robin: "Round-robin · distributed",
  individual: "Individual",
};

export default async function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const db = getDb();

  const team = await db.query.teams.findFirst({
    where: eq(schema.teams.id, id),
    with: { members: { with: { user: true } } },
  });
  if (!team || !team.members.some((m) => m.userId === session!.user.id)) notFound();

  const events = await db.query.eventTypes.findMany({
    where: and(eq(schema.eventTypes.teamId, id), eq(schema.eventTypes.isActive, true)),
  });

  const rules = await db.query.teamRules.findMany({ where: eq(schema.teamRules.teamId, id) });
  const myRole = team.members.find((m) => m.userId === session!.user.id)?.role;
  const canManage = myRole === "owner" || myRole === "admin";

  const briefingPref = await db.query.teamPreferences.findFirst({
    where: eq(schema.teamPreferences.teamId, id),
    columns: { briefingEnabled: true, briefingHour: true, briefingRecipients: true },
  });

  const viewerTz = (session!.user as { timezone?: string }).timezone ?? "UTC";
  const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const collectiveEvents = events
    .filter((event) => event.schedulingType === "collective")
    .map((event) => ({
      id: event.id,
      title: event.title,
      durationMinutes: event.durationMinutes,
    }));
  const bookingMembers = team.members
    .filter(
      (member) => member.user && (member.internalBookable || member.userId === session!.user.id),
    )
    .map((member) => ({
      id: member.userId,
      name: member.user!.name ?? "Team member",
      isOrganizer: member.userId === session!.user.id,
    }));

  return (
    <>
      <Link
        href="/teams"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)]"
      >
        <ArrowLeft size={15} /> All teams
      </Link>
      <PageHeader
        eyebrow="Team"
        title={team.name}
        description={`${team.members.length} member${team.members.length === 1 ? "" : "s"}`}
      />

      <div className="space-y-6">
        <Card>
          <CardHeader
            title="Book the team"
            description="Choose the whole team or selected members. DayOtter warns you about conflicts before you override them."
          />
          <CardBody>
            <InternalTeamBookingForm
              teamId={team.id}
              timezone={viewerTz}
              events={collectiveEvents}
              members={bookingMembers}
            />
          </CardBody>
        </Card>

        {events.length > 0 ? (
          <Card>
            <CardHeader
              title="Share and embed team booking"
              description="Copy the public page, iframe link, or ready-to-paste iframe code."
            />
            <CardBody>
              <TeamBookingEmbedCode appUrl={appUrl} teamSlug={team.slug} />
            </CardBody>
          </Card>
        ) : null}

        <Card>
          <CardHeader
            title="Team calendar"
            description={`Bookings, busy time, focus blocks, and leave for the whole team, in ${viewerTz}.`}
          />
          <CardBody>
            <BookingsCalendar tz={viewerTz} endpoint={`/api/teams/${team.id}/calendar`} readOnly />
          </CardBody>
        </Card>

        {canManage ? (
          <Card>
            <CardHeader
              title="Share team calendar"
              description="Give people a read-only view of the team's booked and unavailable time."
            />
            <CardBody>
              <TeamCalendarSharing
                teamId={team.id}
                teamSlug={team.slug}
                initialToken={team.publicScheduleToken}
                appUrl={appUrl}
              />
            </CardBody>
          </Card>
        ) : null}

        <Card>
          <CardHeader
            title="Members"
            description="Control who can be booked publicly or internally. Weight tunes round-robin - higher gets booked more often; 0 pauses them."
          />
          <CardBody className="space-y-4">
            <ul className="space-y-2">
              {team.members.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-accent)] text-xs font-semibold text-white">
                    {(m.user?.name ?? m.user?.email ?? "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{m.user?.name ?? "Member"}</p>
                    <p className="truncate text-xs text-[var(--color-muted)]">{m.user?.email}</p>
                  </div>
                  <MemberBookingVisibility
                    teamId={team.id}
                    memberId={m.id}
                    initialPublic={m.publicBookable}
                    initialInternal={m.internalBookable}
                    editable={canManage}
                  />
                  <MemberWeight
                    teamId={team.id}
                    memberId={m.id}
                    initial={m.priority}
                    editable={canManage}
                  />
                  {m.role !== "owner" &&
                  (m.userId === session!.user.id ||
                    (canManage && m.userId !== session!.user.id)) ? (
                    <TeamMemberAction
                      teamId={team.id}
                      memberId={m.id}
                      name={m.user?.name ?? m.user?.email ?? "this member"}
                      leaving={m.userId === session!.user.id}
                    />
                  ) : null}
                  {myRole === "owner" && m.userId !== session!.user.id ? (
                    <TransferTeamOwnership
                      teamId={team.id}
                      memberId={m.id}
                      name={m.user?.name ?? m.user?.email ?? "this member"}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
            {canManage ? <AddMemberForm teamId={team.id} /> : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Team event types"
            description={
              canManage
                ? "Meeting choices shown together on your public team booking page. Use the actions beside each event to edit or delete it."
                : "Meeting choices shown together on your public team booking page. Only team owners and admins can edit them."
            }
          />
          <CardBody className="space-y-5">
            {events.length > 0 ? (
              <Link
                href={`/team/${team.slug}`}
                className="flex items-center justify-between rounded-md border border-[var(--color-accent)] bg-[var(--color-accent-soft)] px-4 py-3 text-sm text-[var(--color-accent)] hover:underline"
              >
                <span>
                  <span className="block font-medium">Public team booking page</span>
                  <span className="text-xs">/team/{team.slug}</span>
                </span>
                <ExternalLink size={15} />
              </Link>
            ) : null}
            {events.length > 0 ? (
              <ul className="space-y-2">
                {events.map((e) => (
                  <li
                    key={e.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--color-border)] px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{e.title}</p>
                      <p className="text-xs text-[var(--color-muted)]">
                        {e.durationMinutes}m · {TYPE_LABEL[e.schedulingType] ?? e.schedulingType}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[var(--color-muted)]">
                        Included in public page
                      </span>
                      {canManage ? (
                        <TeamEventTypeActions
                          eventTypeId={e.id}
                          initialTitle={e.title}
                          slug={e.slug}
                          durationMinutes={e.durationMinutes}
                        />
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
                <Users size={15} /> No team events yet - create one below.
              </p>
            )}
            <div className="border-t border-[var(--color-border)] pt-5">
              <CreateTeamEventForm teamId={team.id} />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Scheduling rules"
            description="Company holidays and meeting-free windows that block bookings for every member."
          />
          <CardBody>
            <TeamRules
              teamId={team.id}
              canManage={canManage}
              initial={rules.map((r) => ({
                id: r.id,
                kind: r.kind,
                label: r.label,
                theDate: r.theDate,
                dayOfWeek: r.dayOfWeek,
                startMinute: r.startMinute,
                endMinute: r.endMinute,
              }))}
            />
          </CardBody>
        </Card>

        {canManage ? (
          <Card>
            <CardHeader
              title="Daily team briefing"
              description="A shared morning digest of the team's day, sent over email and notification channels."
            />
            <CardBody>
              <TeamBriefingSettings
                teamId={team.id}
                initial={{
                  enabled: briefingPref?.briefingEnabled ?? false,
                  hour: briefingPref?.briefingHour ?? 8,
                  recipients: briefingPref?.briefingRecipients === "all" ? "all" : "admins",
                }}
              />
            </CardBody>
          </Card>
        ) : null}
      </div>
    </>
  );
}
