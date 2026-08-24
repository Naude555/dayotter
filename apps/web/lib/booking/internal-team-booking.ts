import type { TeamCalendarItem, TeamCalendarMember } from "./team-calendar";
import { teamCalendarItems } from "./team-calendar";

export interface TeamBookingConflict {
  member: string;
  reason: string;
  category: TeamCalendarItem["category"];
}

const REASON: Record<TeamCalendarItem["category"], string> = {
  booked: "another booking",
  focus: "deep work",
  personal: "a personal block",
  travel: "travel time",
  unavailable: "blocked time",
  busy: "an external calendar event",
  out_of_office: "out of office",
  holiday: "a team holiday",
};

/** Privacy-safe warnings shown before an internal whole-team override. */
export function summarizeTeamBookingConflicts(items: TeamCalendarItem[]): TeamBookingConflict[] {
  const seen = new Set<string>();
  const conflicts: TeamBookingConflict[] = [];
  for (const item of items) {
    const member = item.memberName;
    const reason = REASON[item.category];
    const key = `${member}:${item.category}`;
    if (seen.has(key)) continue;
    seen.add(key);
    conflicts.push({ member, reason, category: item.category });
  }
  return conflicts;
}

export async function internalTeamBookingConflicts(
  teamId: string,
  members: TeamCalendarMember[],
  start: Date,
  end: Date,
): Promise<TeamBookingConflict[]> {
  const items = await teamCalendarItems(teamId, members, start, end);
  // Calendar range queries deliberately include boundary rows for display. A
  // meeting ending exactly when this one starts is not a scheduling conflict.
  return summarizeTeamBookingConflicts(
    items.filter(
      (item) => new Date(item.startsAt).getTime() < end.getTime() && new Date(item.endsAt) > start,
    ),
  );
}
