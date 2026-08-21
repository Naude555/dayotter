import { describe, expect, it } from "vitest";
import { outOfOfficeCalendarDays } from "./out-of-office";

describe("outOfOfficeCalendarDays", () => {
  it("expands inclusive dates at local midnight without losing the date key", () => {
    expect(
      outOfOfficeCalendarDays(
        { startDate: "2026-08-24", endDate: "2026-08-25" },
        "Africa/Johannesburg",
        new Date("2026-08-01T00:00:00.000Z"),
        new Date("2026-09-01T00:00:00.000Z"),
      ),
    ).toEqual([
      {
        dateKey: "2026-08-24",
        startsAt: "2026-08-23T22:00:00.000Z",
        endsAt: "2026-08-24T22:00:00.000Z",
      },
      {
        dateKey: "2026-08-25",
        startsAt: "2026-08-24T22:00:00.000Z",
        endsAt: "2026-08-25T22:00:00.000Z",
      },
    ]);
  });

  it("returns only days overlapping the requested window", () => {
    expect(
      outOfOfficeCalendarDays(
        { startDate: "2026-08-24", endDate: "2026-08-28" },
        "UTC",
        new Date("2026-08-26T00:00:00.000Z"),
        new Date("2026-08-28T00:00:00.000Z"),
      ).map((day) => day.dateKey),
    ).toEqual(["2026-08-26", "2026-08-27"]);
  });
});
