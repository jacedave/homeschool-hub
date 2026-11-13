import { DAY_ABBRS, Contribution, Kid, RepeatMode, RewardItem, TaskItem } from "./types";

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

/* ---------- Task order ---------- */

/** Sort key for a task: its Priority, or (if none yet) its original position, placed before numbered tasks. */
const taskKey = (t: TaskItem, index: number) => t.priority ?? index - 1_000_000;

/** All of one kid's tasks in priority order (including ones not due today). */
export function sortedKidTasks(tasks: TaskItem[], kidName: string): TaskItem[] {
  return tasks
    .map((t, i) => ({ t, k: taskKey(t, i) }))
    .filter((x) => x.t.assignee === kidName)
    .sort((a, b) => a.k - b.k)
    .map((x) => x.t);
}

/** Priority for a brand-new task so that it lands at the bottom of the kid's list. */
export function nextPriority(tasks: TaskItem[], kidName: string): number {
  return Math.max(0, ...tasks.filter((t) => t.assignee === kidName && t.priority !== undefined).map((t) => t.priority as number)) + 1;
}

export type TaskPlacement = { before: string } | "top" | "end";
export interface TaskMove {
  id: string;
  priority: number;
  assignee?: string;
}

/**
 * Works out the changes needed to put a task in a spot in a kid's list. The whole target list is
 * renumbered 1..n so the order is explicit and stays stable.
 */
export function planTaskMove(tasks: TaskItem[], taskId: string, toKid: string, where: TaskPlacement): TaskMove[] {
  const moving = tasks.find((t) => t.id === taskId);
  if (!moving) return [];
  const list = sortedKidTasks(tasks, toKid).filter((t) => t.id !== taskId);
  let at = list.length;
  if (where === "top") at = 0;
  else if (where !== "end") {
    const i = list.findIndex((t) => t.id === where.before);
    if (i >= 0) at = i;
  }
  const ordered = [...list.slice(0, at), moving, ...list.slice(at)];
  const moves: TaskMove[] = [];
  ordered.forEach((t, i) => {
    const assignee = t.id === taskId && t.assignee !== toKid ? toKid : undefined;
    if (t.priority !== i + 1 || assignee) moves.push({ id: t.id, priority: i + 1, ...(assignee ? { assignee } : {}) });
  });
  return moves;
}

/**
 * Whether a task belongs on today's screen. Repeating tasks show on the days they are due. A one-off
 * task shows until it is done, and stays for the rest of that day, then disappears the next day.
 */
export function isVisibleToday(task: TaskItem, today: string): boolean {
  if (!task.dueToday) return false;
  if (task.repeat === "none" && task.completed && task.lastCompletedDate && today && task.lastCompletedDate < today) return false;
  return true;
}
