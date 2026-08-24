import { describe, expect, it } from "vitest";
import { summarizeTeamBookingConflicts } from "./internal-team-booking";
import type { TeamCalendarItem } from "./team-calendar";

function calendarItem(
  memberName: string,
  category: TeamCalendarItem["category"],
): TeamCalendarItem {
  return {
    uid: `${memberName}:${category}`,
    memberName,
    title: `${memberName} · Private status`,
    startsAt: "2026-08-24T08:00:00.000Z",
    endsAt: "2026-08-24T09:00:00.000Z",
    status: "confirmed",
    color: "violet",
    attendees: [],
    href: null,
    category,
  };
}

describe("summarizeTeamBookingConflicts", () => {
  it("names the affected member and uses privacy-safe reasons", () => {
    expect(
      summarizeTeamBookingConflicts([
        calendarItem("Alex", "booked"),
        calendarItem("Sam", "out_of_office"),
        calendarItem("Taylor", "focus"),
      ]),
    ).toEqual([
      { member: "Alex", reason: "another booking", category: "booked" },
      { member: "Sam", reason: "out of office", category: "out_of_office" },
      { member: "Taylor", reason: "deep work", category: "focus" },
    ]);
  });

  it("deduplicates repeated blocks without confusing names containing separators", () => {
    const first = calendarItem("Research · Design", "busy");
    expect(summarizeTeamBookingConflicts([first, { ...first, uid: "second" }])).toEqual([
      {
        member: "Research · Design",
        reason: "an external calendar event",
        category: "busy",
      },
    ]);
  });
});
