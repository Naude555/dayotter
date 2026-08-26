import { pollVoteUpdate } from "@dayotter/emails";
import { describe, expect, it } from "vitest";
import { PollError, normalizeInviteeEmails, resolvePollVoter } from "./polls";

describe("poll participation", () => {
  it("normalizes and deduplicates invitation recipients", () => {
    expect(
      normalizeInviteeEmails([
        " Alex@example.com ",
        "alex@example.com",
        "SAM@example.com",
        "not-an-email",
      ]),
    ).toEqual(["alex@example.com", "sam@example.com"]);
  });

  it("binds an invite-only vote to the email behind its token", () => {
    expect(
      resolvePollVoter(
        "invited",
        [{ email: "alex@example.com", token: "personal-token" }],
        "personal-token",
        { name: " Alex ", email: "spoofed@example.com" },
      ),
    ).toEqual({ name: "Alex", email: "alex@example.com" });
  });

  it("rejects an invite-only vote without a matching personal token", () => {
    expect(() =>
      resolvePollVoter(
        "invited",
        [{ email: "alex@example.com", token: "personal-token" }],
        "wrong-token",
        { name: "Alex", email: "alex@example.com" },
      ),
    ).toThrowError(PollError);
  });

  it("keeps public voting open to a supplied identity", () => {
    expect(
      resolvePollVoter("public", [], undefined, { name: " Sam ", email: "SAM@EXAMPLE.COM" }),
    ).toEqual({ name: "Sam", email: "sam@example.com" });
  });

  it("summarizes poll progress in the organizer notification", () => {
    const email = pollVoteUpdate({
      pollTitle: "Planning",
      voterName: "Alex",
      voterEmail: "alex@example.com",
      participationLabel: "2 of 3 invited recipients have voted",
      resultsUrl: "https://example.com/polls/one",
      timezone: "Africa/Johannesburg",
      options: [
        {
          startsAt: new Date("2026-08-27T08:00:00Z"),
          yes: 2,
          maybe: 1,
          no: 0,
        },
      ],
    });

    expect(email.subject).toBe("New vote: Planning");
    expect(email.text).toContain("Poll status: Open · 2 of 3 invited recipients have voted");
    expect(email.text).toContain("2 yes, 1 maybe, 0 no");
    expect(email.html).toContain("https://example.com/polls/one");
  });
});
