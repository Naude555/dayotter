import { describe, expect, it } from "vitest";
import { bookingRecipientConfirmation } from "./confirmation-copy";

describe("bookingRecipientConfirmation", () => {
  it("shows the address for one recipient", () => {
    expect(bookingRecipientConfirmation(["Person@Example.com"])).toBe(
      "A confirmation was sent to person@example.com.",
    );
  });

  it("shows an accurate count without exposing group email addresses", () => {
    expect(
      bookingRecipientConfirmation(["one@example.com", "two@example.com", "three@example.com"]),
    ).toBe("An invitation was sent to each of the 3 attendees.");
  });

  it("deduplicates recipients case-insensitively", () => {
    expect(bookingRecipientConfirmation(["one@example.com", "ONE@example.com"])).toBe(
      "A confirmation was sent to one@example.com.",
    );
  });
});
