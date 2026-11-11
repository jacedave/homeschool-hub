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

export function poolTotal(rewardId: string, contribs: Contribution[]): number {
  return contribs.filter((c) => c.rewardId === rewardId).reduce((s, c) => s + c.amount, 0);
}

export function remainingCost(reward: RewardItem, contribs: Contribution[]): number {
  return Math.max(0, reward.cost - poolTotal(reward.id, contribs));
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
  const remaining = remainingCost(reward, contribs);
  if (amount > remaining) return `Only ${remaining} more stars are needed.`;
  if (!reward.combinable) {
    const other = contribs.find((c) => c.rewardId === reward.id && c.kidId !== kid.id);
    if (other) return "This reward can only be earned by one kid at a time.";
  }
  return null;
}
