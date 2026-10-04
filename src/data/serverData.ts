/*
 * Server calendar. The server day drives the level cap and the daily Field
 * Energy refill.
 *
 * DEMO: there is no server. The launch time below is a placeholder and the
 * day is computed from the local (untrusted) clock; dev tools can override
 * it. A real server supplies its own launch time and authoritative time.
 */
export const SERVER_CALENDAR = {
  /** Start of server day 1 (DEMO placeholder: 2026-10-04 00:00 at UTC+7). */
  launchAt: Date.UTC(2026, 9, 3, 17),
  /** A new server day starts at this hour in `utcOffsetMinutes`. */
  resetHour: 0,
  utcOffsetMinutes: 7 * 60,
} as const;
