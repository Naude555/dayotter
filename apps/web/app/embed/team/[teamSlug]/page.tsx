import { EmbedBridge } from "@/components/embed-bridge";
import { TeamBookingPage } from "@/components/team-booking-page";
import { brandStyle } from "@/lib/booking/branding";
import { publicTeamBookingData } from "@/lib/booking/public-team-booking";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EmbedTeamBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { teamSlug } = await params;
  const query = await searchParams;
  const requestedEvent = typeof query.event === "string" ? query.event : undefined;
  const data = await publicTeamBookingData(teamSlug, requestedEvent);
  if (!data) notFound();

  const requestedTheme = typeof query.theme === "string" ? query.theme : "auto";
  const theme = requestedTheme === "dark" ? "dark" : requestedTheme === "light" ? "light" : "auto";
  const primaryColor =
    typeof query.primaryColor === "string" ? `#${query.primaryColor.replace(/^#/, "")}` : undefined;

  return (
    <main style={brandStyle(primaryColor)} className="mx-auto max-w-6xl px-2 py-2 sm:px-4 sm:py-4">
      <EmbedBridge theme={theme} />
      <TeamBookingPage
        embedded
        teamName={data.teamName}
        members={data.members}
        events={data.events}
        initialEventId={data.initialEventId}
      />
    </main>
  );
}
