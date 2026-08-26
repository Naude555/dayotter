import { TeamBookingPage } from "@/components/team-booking-page";
import { publicTeamBookingData } from "@/lib/booking/public-team-booking";
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
  const data = await publicTeamBookingData(teamSlug, requestedEvent);
  if (!data) notFound();

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <TeamBookingPage
        teamName={data.teamName}
        members={data.members}
        initialEventId={data.initialEventId}
        events={data.events}
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
