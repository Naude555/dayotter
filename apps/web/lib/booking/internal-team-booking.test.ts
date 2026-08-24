import { describe, expect, it } from "vitest";
import { summarizeTeamBookingConflicts, teamBookingInvitees } from "./internal-team-booking";
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

describe("teamBookingInvitees", () => {
  it("invites every teammate except the organizer and adds external guests", () => {
    expect(
      teamBookingInvitees(
        [
          { userId: "organizer", email: "owner@example.com", name: "Owner", timezone: "UTC" },
          {
            userId: "member",
            email: "SAM@example.com",
            name: "Sam",
            timezone: "Africa/Johannesburg",
          },
        ],
        "organizer",
        ["guest@example.com"],
        "UTC",
      ),
    ).toEqual([
      {
        email: "sam@example.com",
        name: "Sam",
        timezone: "Africa/Johannesburg",
        external: false,
      },
      { email: "guest@example.com", timezone: "UTC", external: true },
    ]);
  });

  it("deduplicates guest addresses against the organizer and team", () => {
    expect(
      teamBookingInvitees(
        [
          { userId: "organizer", email: "owner@example.com", name: null, timezone: null },
          { userId: "member", email: "sam@example.com", name: null, timezone: null },
        ],
        "organizer",
        ["OWNER@example.com", "SAM@example.com", "new@example.com", "NEW@example.com"],
        "UTC",
      ).map((invitee) => invitee.email),
    ).toEqual(["sam@example.com", "new@example.com"]);
  });
});
