import { HostAvatar } from "@/components/host-avatar";
import { PublicProfileAvailability } from "@/components/public-profile-availability";
import { brandStyle, getHostBranding } from "@/lib/booking/branding";
import { LOCATION_LABELS, offeredLocations } from "@/lib/booking/event-type-input";
import { chargeFor, formatMoney } from "@/lib/booking/money";
import { resolveLocale } from "@/lib/i18n/booking";
import { LocaleProvider } from "@/lib/i18n/locale-provider";
import { paymentsEnabled } from "@/lib/payments/stripe";
import { and, asc, eq, getDb, schema } from "@dayotter/db";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

/** Public profile: every meeting a host offers, one link to share. */
export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const db = getDb();

  const host = await db.query.users.findFirst({ where: eq(schema.users.handle, handle) });
  if (!host) notFound();

  const [eventTypes, branding] = await Promise.all([
    db.query.eventTypes.findMany({
      where: and(
        eq(schema.eventTypes.ownerId, host.id),
        eq(schema.eventTypes.isActive, true),
        eq(schema.eventTypes.isPrivate, false),
      ),
      orderBy: asc(schema.eventTypes.createdAt),
    }),
    getHostBranding(host.id),
  ]);
  const locale = resolveLocale((await headers()).get("accept-language"));
  const profileEvents = eventTypes.map((eventType) => {
    const offered = offeredLocations(eventType);
    const locations =
      offered.length > 1 && (eventType.maxAttendees ?? 1) <= 1
        ? offered.map((location) => ({
            type: location.type,
            label: LOCATION_LABELS[location.type] ?? location.type,
          }))
        : [];
    const chargeAmount = paymentsEnabled ? chargeFor(eventType.price, eventType.depositAmount) : 0;
    return {
      id: eventType.id,
      title: eventType.title,
      description: eventType.description,
      durationMinutes: eventType.durationMinutes,
      durationOptions: eventType.durationOptions ?? [],
      questions: eventType.questions,
      priceLabel: chargeAmount > 0 ? formatMoney(chargeAmount, eventType.currency ?? "usd") : null,
      requiresCode: eventType.accessCodeHash != null,
      locations,
    };
  });

  return (
    <main
      style={brandStyle(branding.brandColor)}
      className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16"
    >
      <div className="mb-8 flex flex-col items-center text-center">
        <HostAvatar name={host.name ?? host.handle ?? "?"} image={host.image} size={64} />
        <h1 className="font-display mt-4 text-2xl tracking-[-0.01em]">
          {host.name ?? host.handle}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          {branding.welcomeMessage ?? "Pick a meeting to book."}
        </p>
      </div>

      {eventTypes.length === 0 ? (
        <p className="py-12 text-center text-sm text-[var(--color-muted)]">
          No public meetings available right now.
        </p>
      ) : (
        <LocaleProvider locale={locale}>
          <PublicProfileAvailability events={profileEvents} />
        </LocaleProvider>
      )}

      <p className="mt-10 flex items-center justify-center gap-1.5 text-xs text-[var(--color-faint)]">
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
