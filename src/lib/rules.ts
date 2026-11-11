import { DAY_ABBRS, Contribution, Kid, RepeatMode, RewardItem } from "./types";

/** Shared by the API route and the demo-mode client so both follow the same rules. */

export function isDueOn(repeat: RepeatMode, repeatDays: string[], dayIndex: number): boolean {
  if (repeat === "none" || repeat === "daily") return true;
  if (repeat === "weekdays") return dayIndex >= 1 && dayIndex <= 5;
  return repeatDays.includes(DAY_ABBRS[dayIndex]);
}

export function parseRepeat(value: unknown): RepeatMode {
  const v = String(value || "").toLowerCase();
  return v === "daily" || v === "weekdays" || v === "custom" ? v : "none";
}

export function parseRepeatDays(value: unknown): string[] {
  return String(value || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => (DAY_ABBRS as readonly string[]).includes(s));
}

/** YYYY-MM-DD and weekday index for "now" in the given IANA timezone. */
export function todayIn(timeZone: string, now = new Date()): { date: string; dayIndex: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    dayIndex: DAY_ABBRS.indexOf(get("weekday") as (typeof DAY_ABBRS)[number]),
  };
}

/** The instant today began (midnight) in the given IANA timezone. */
export function zonedStartOfDay(timeZone: string, now = new Date()): Date {
  const { date } = todayIn(timeZone, now);
  const [y, m, d] = date.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(new Date(guess));
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
  return new Date(guess - (asUtc - guess));
}

/** Stars saved toward a reward. Pass kidId to count only that kid's savings. */
export function poolTotal(rewardId: string, contribs: Contribution[], kidId?: string): number {
  return contribs
    .filter((c) => c.rewardId === rewardId && (!kidId || c.kidId === kidId))
    .reduce((s, c) => s + c.amount, 0);
}

/**
 * Stars still needed. Shared rewards have one jar for everyone; solo rewards are unlimited, so each
 * kid saves toward their own copy (pass that kid's id).
 */
export function remainingCost(reward: RewardItem, contribs: Contribution[], kidId?: string): number {
  return Math.max(0, reward.cost - poolTotal(reward.id, contribs, reward.combinable ? undefined : kidId));
}

/** Returns an error message if the deposit is not allowed, otherwise null. */
export function validateDeposit(
  kid: Kid | undefined,
  reward: RewardItem | undefined,
  contribs: Contribution[],
  amount: number
): string | null {
  if (!kid || !reward) return "Unknown kid or reward.";
  if (!Number.isInteger(amount) || amount < 1) return "Add at least 1 star.";
  if (amount > kid.stars) return `${kid.name} only has ${kid.stars} stars.`;
  const remaining = remainingCost(reward, contribs, kid.id);
  if (amount > remaining) return `Only ${remaining} more stars are needed.`;
  return null;
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** True when `now` falls in the sleep window. Handles windows that cross midnight (e.g. 21:00 to 06:30). */
export function inSleepWindow(sleepAt: string, wakeAt: string, now = new Date()): boolean {
  const cur = now.getHours() * 60 + now.getMinutes();
  const s = toMinutes(sleepAt);
  const w = toMinutes(wakeAt);
  if (s === w) return false;
  return s < w ? cur >= s && cur < w : cur >= s || cur < w;
}
