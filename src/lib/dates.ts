import type { MealItem } from "./types";

/** Date helpers that work on plain "YYYY-MM-DD" strings, so timezones never shift a day. */

const parse = (ymd: string) => new Date(`${ymd}T12:00:00Z`);
const fmt = (d: Date) => d.toISOString().slice(0, 10);

export const addDays = (ymd: string, n: number) => {
  const d = parse(ymd);
  d.setUTCDate(d.getUTCDate() + n);
  return fmt(d);
};

export const weekdayIndex = (ymd: string) => parse(ymd).getUTCDay();

export const monthStart = (ymd: string) => `${ymd.slice(0, 7)}-01`;

/** First day of the month that is `n` months from the month containing `ymd`. */
export const addMonths = (ymd: string, n: number) => {
  const [y, m] = ymd.split("-").map(Number);
  return fmt(new Date(Date.UTC(y, m - 1 + n, 1, 12)));
};

export const daysInMonth = (ymd: string) => {
  const [y, m] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

/** Every date in the month containing `ymd`. */
export const monthDays = (ymd: string) => {
  const first = monthStart(ymd);
  return Array.from({ length: daysInMonth(ymd) }, (_, i) => addDays(first, i));
};

/** Weeks (Sunday first) covering the month, including leading/trailing days from neighbouring months. */
export const monthGrid = (ymd: string) => {
  const first = monthStart(ymd);
  const start = addDays(first, -weekdayIndex(first));
  const weeks = Math.ceil((weekdayIndex(first) + daysInMonth(ymd)) / 7);
  return Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
};

export const label = (ymd: string, opts: Intl.DateTimeFormatOptions) =>
  parse(ymd).toLocaleDateString("en-US", { timeZone: "UTC", ...opts });

/** The meal planned for a date. Falls back to an old weekday-only row (no Date) if there is no dated one. */
export function mealFor(meals: MealItem[], date: string): MealItem | undefined {
  if (!date) return undefined;
  const weekday = label(date, { weekday: "long" }).toLowerCase();
  return meals.find((m) => m.date === date) ?? meals.find((m) => !m.date && m.day.toLowerCase() === weekday);
}
