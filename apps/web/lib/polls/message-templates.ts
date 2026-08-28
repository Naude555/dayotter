/**
 * Quick-fill templates for the poll finalize step. The `{details}` placeholder
 * is filled at send time: with the auto-generated conference URL when the
 * calendar write created one (e.g. Google Meet / Teams), otherwise with nothing -
 * hosts replace it with their own Zoom link, phone number or address in the
 * textarea before confirming. Pure module: safe to import from client + server.
 */

export const FINALIZE_MESSAGE_PLACEHOLDER = "{details}";

export interface FinalizeMessageTemplate {
  value: string;
  label: string;
  text: string;
}

export const FINALIZE_MESSAGE_TEMPLATES: FinalizeMessageTemplate[] = [
  {
    value: "video",
    label: "Video call",
    text: `We'll meet over video.\n\nJoin here: ${FINALIZE_MESSAGE_PLACEHOLDER}`,
  },
  {
    value: "phone",
    label: "Phone call",
    text: `We'll connect by phone.\n\nDial-in number: ${FINALIZE_MESSAGE_PLACEHOLDER}`,
  },
  {
    value: "in_person",
    label: "In person",
    text: `We'll meet in person.\n\nAddress: ${FINALIZE_MESSAGE_PLACEHOLDER}`,
  },
];

/** Fill the `{details}` placeholder in a finalize message with the generated
 * meeting URL when one exists; otherwise leave the text as the host wrote it
 * (they can paste their own link instead of the placeholder). */
export function applyFinalizeMessage(
  message: string | null | undefined,
  meetingUrl: string | undefined,
): string | undefined {
  const trimmed = message?.trim();
  if (!trimmed) return undefined;
  if (meetingUrl) return trimmed.replaceAll(FINALIZE_MESSAGE_PLACEHOLDER, meetingUrl);
  return trimmed;
}
