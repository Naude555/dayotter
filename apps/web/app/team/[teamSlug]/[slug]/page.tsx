import { redirect } from "next/navigation";

export default async function LegacyTeamBookingPage({
  params,
}: {
  params: Promise<{ teamSlug: string; slug: string }>;
}) {
  const { teamSlug, slug } = await params;
  redirect(`/team/${encodeURIComponent(teamSlug)}?event=${encodeURIComponent(slug)}`);
}
