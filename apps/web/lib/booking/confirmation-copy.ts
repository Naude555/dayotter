/** Confirmation pages are public-by-link, so summarize groups without exposing emails. */
export function bookingRecipientConfirmation(emails: string[]): string {
  const unique = [...new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean))];
  if (unique.length === 0) return "The calendar invitation was created.";
  if (unique.length === 1) return `A confirmation was sent to ${unique[0]}.`;
  return `An invitation was sent to each of the ${unique.length} attendees.`;
}
