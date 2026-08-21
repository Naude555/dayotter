import { describe, expect, it } from "vitest";
import { teamCalendarMembers, teamCalendarRange } from "./team-calendar";

const request = (start: string, end: string) =>
  new Request(`http://localhost/api/team-calendar?start=${start}&end=${end}`);

describe("teamCalendarRange", () => {
  it("accepts a bounded forward range", () => {
    const range = teamCalendarRange(
      request("2026-08-01T00:00:00.000Z", "2026-09-01T00:00:00.000Z"),
    );
    expect(range?.start.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(range?.end.toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });

  it("rejects invalid, backwards, and unbounded ranges", () => {
    expect(teamCalendarRange(request("bad", "2026-09-01T00:00:00.000Z"))).toBeNull();
    expect(
      teamCalendarRange(request("2026-09-01T00:00:00.000Z", "2026-08-01T00:00:00.000Z")),
    ).toBeNull();
    expect(
      teamCalendarRange(request("2026-01-01T00:00:00.000Z", "2026-12-31T00:00:00.000Z")),
    ).toBeNull();
  });
});

describe("teamCalendarMembers", () => {
  it("shows every member and marks missing public booking pages", () => {
    expect(
      teamCalendarMembers([
        { userId: "a", name: "Alex", timezone: "UTC", handle: "alex" },
        { userId: "b", name: "No profile", timezone: "UTC", handle: null },
      ]),
    ).toEqual([
      { id: "a", name: "Alex", href: "/alex", color: "violet" },
      { id: "b", name: "No profile", href: null, color: "mint" },
    ]);
  });
});
