/**
 * The four client-facing conversation-mute duration choices. The client sends
 * the CHOICE (never a raw timestamp); the server resolves it to a concrete
 * `mutedUntil` server-side, and represents "forever" via an explicit
 * `mutedForever` signal on the returned member — the SDK never string-matches a
 * magic date.
 *
 * Mirrors the server's `MUTE_DURATIONS` exactly (see server
 * `src/helpers/push/muteDuration.ts`).
 */
export const MUTE_DURATIONS = ["8h", "24h", "1w", "forever"] as const;

export type MuteDuration = (typeof MUTE_DURATIONS)[number];
