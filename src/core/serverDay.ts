import type { Clock } from './clock';
import { SERVER_CALENDAR } from '../data/serverData';

const DAY = 86_400_000;

/**
 * Current server day (1 = launch day). Game logic takes this instead of
 * reading the system clock, so tests inject a fixed day and a future server
 * supplies the real one.
 */
export interface ServerDayProvider {
  day(): number;
}

/** A settable day for tests. */
export class FixedServerDay implements ServerDayProvider {
  constructor(public value: number) {}

  day(): number {
    return this.value;
  }
}

export interface ServerCalendar {
  launchAt: number;
  resetHour: number;
  utcOffsetMinutes: number;
}

/** Index of the calendar day containing `time` (days start at the reset hour). */
function dayIndex(time: number, cal: ServerCalendar): number {
  return Math.floor((time + cal.utcOffsetMinutes * 60_000 - cal.resetHour * 3_600_000) / DAY);
}

/**
 * Server day from a Clock and a launch time. `override` is a DEV hook: when
 * set it replaces the computed day (never below 1).
 */
export class ClockServerDay implements ServerDayProvider {
  override: number | null = null;

  constructor(
    private readonly clock: Clock,
    private readonly calendar: ServerCalendar = SERVER_CALENDAR,
  ) {}

  day(): number {
    if (this.override !== null) return Math.max(1, Math.floor(this.override));
    return Math.max(1, dayIndex(this.clock.now(), this.calendar) - dayIndex(this.calendar.launchAt, this.calendar) + 1);
  }
}
