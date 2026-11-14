import { NextRequest, NextResponse } from "next/server";
import { isDueOn, parseRepeat, parseRepeatDays, todayIn, validateDeposit } from "@/lib/rules";
import { FAMILY_TZ } from "@/lib/config";
import { authorizePin, lockedMessage } from "@/lib/auth";
import { COLOR_MAP } from "@/lib/colors";
import type { Contribution, Kid, RewardItem } from "@/lib/types";

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const TIME_ZONE = FAMILY_TZ;

const WRITABLE_TABLES = ["Kids", "Tasks", "Rewards", "Meals", "Shopping", "Redemptions"];

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

/** Returns an error response if the request isn't allowed to see the family's data, otherwise null. */
async function denied(req: NextRequest): Promise<NextResponse | null> {
  const auth = await authorizePin(req);
  if (auth.status === "ok") return null;
  if (auth.status === "locked") return NextResponse.json({ error: lockedMessage(auth.minutes) }, { status: 429 });
  // "wrong" lets the app know its saved PIN is out of date, so it stops sending it.
  return NextResponse.json({ mode: "demo", reason: auth.status === "wrong" ? "wrong-pin" : undefined }, { status: 401 });
}

const tableUrl = (table: string) =>
  `${process.env.AIRTABLE_API_URL || "https://api.airtable.com"}/v0/${BASE_ID}/${encodeURIComponent(table)}`;

const authHeaders = {
  Authorization: `Bearer ${AIRTABLE_TOKEN}`,
  "Content-Type": "application/json",
};

class AirtableError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function airtable<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: authHeaders, cache: "no-store" });
  const data = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } | string };
  if (!res.ok) {
    const err = data.error;
    throw new AirtableError(typeof err === "string" ? err : err?.message || `Airtable error ${res.status}`, res.status);
  }
  return data;
}

/** True when a table simply doesn't exist (yet), as opposed to a temporary failure like a rate limit. */
const isMissingTable = (e: unknown) => e instanceof AirtableError && (e.status === 404 || e.status === 403);

async function fetchTable(table: string): Promise<AirtableRecord[]> {
  const all: AirtableRecord[] = [];
  let offset: string | undefined;
  do {
    const url = tableUrl(table) + (offset ? `?offset=${offset}` : "");
    const data = await airtable<{ records: AirtableRecord[]; offset?: string }>(url);
    all.push(...data.records);
    offset = data.offset;
  } while (offset);
  return all;
}

const getRecord = (table: string, id: string) => airtable<AirtableRecord>(`${tableUrl(table)}/${id}`);

const patchRecord = (table: string, id: string, fields: Record<string, unknown>) =>
  airtable<AirtableRecord>(`${tableUrl(table)}/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ fields, typecast: true }),
  });

const createRecord = (table: string, fields: Record<string, unknown>) =>
  airtable<AirtableRecord>(tableUrl(table), {
    method: "POST",
    body: JSON.stringify({ fields, typecast: true }),
  });

const deleteRecord = (table: string, id: string) =>
  airtable<unknown>(`${tableUrl(table)}/${id}`, { method: "DELETE" });

async function patchMany(table: string, records: { id: string; fields: Record<string, unknown> }[]) {
  for (let i = 0; i < records.length; i += 10) {
    await airtable(tableUrl(table), {
      method: "PATCH",
      body: JSON.stringify({ records: records.slice(i, i + 10), typecast: true }),
    });
  }
}

const toKid = (r: AirtableRecord): Kid => ({
  id: r.id,
  name: String(r.fields.Name || "Kid"),
  stars: Number(r.fields.Stars || 0),
  color: String(r.fields.Color || "blue"),
  photo: r.fields.Photo ? String(r.fields.Photo) : undefined,
});

const COLOR_NAMES = Object.keys(COLOR_MAP);
const COLOR_ALIASES: Record<string, string> = { green: "emerald", teal: "emerald", yellow: "amber", orange: "amber", violet: "purple", indigo: "purple", rose: "pink", magenta: "pink" };

/** Accepts any capitalization or a common alias; blank or unknown colors get a distinct default by position. */
function pickColor(raw: unknown, index: number): string {
  const v = String(raw ?? "").trim().toLowerCase();
  if (COLOR_MAP[v]) return v;
  if (COLOR_ALIASES[v]) return COLOR_ALIASES[v];
  return COLOR_NAMES[index % COLOR_NAMES.length];
}

/** Kids in the order set by the optional "Order" number field (falls back to Airtable's order). */
const sortKids = (rows: AirtableRecord[]) =>
  rows
    .map((r, i) => ({ r, i, o: r.fields.Order === undefined ? Infinity : Number(r.fields.Order) }))
    .sort((a, b) => (a.o === b.o ? a.i - b.i : a.o - b.o))
    .map((x) => x.r);

/** The base has this field spelled "Asignee"; accept either spelling. */
const assigneeOf = (f: Record<string, unknown>) => String(f.Assignee ?? f.Asignee ?? "");

/**
 * Finds the kid a task belongs to. The "AssigneeId" column (the kid's record ID) is what counts. Rows that
 * don't have it yet fall back to matching the older plain-text name, so nothing breaks while rows are filled in.
 */
function kidLookup(kids: Kid[]) {
  const byId = new Map(kids.map((k) => [k.id, k]));
  const byName = new Map<string, Kid>();
  kids.forEach((k) => byName.has(k.name.trim().toLowerCase()) || byName.set(k.name.trim().toLowerCase(), k));
  return {
    byId,
    idByName: (name: string) => byName.get(name.trim().toLowerCase())?.id,
    resolve(fields: Record<string, unknown>): { id: string; name: string } {
      const direct = byId.get(String(fields.AssigneeId || ""));
      if (direct) return { id: direct.id, name: direct.name };
      const raw = assigneeOf(fields);
      const named = byName.get(raw.trim().toLowerCase());
      return named ? { id: named.id, name: named.name } : { id: "", name: raw };
    },
  };
}

/** Optional table: returns [] if it doesn't exist yet. */
async function fetchOptional(table: string): Promise<AirtableRecord[]> {
  try {
    return await fetchTable(table);
  } catch (e) {
    if (isMissingTable(e)) return [];
    throw e; // a temporary failure must not look like "no data" and wipe what the screen is showing
  }
}

/** Airtable-hosted picture from an "Image" attachment field, falling back to an older "ImageUrl" text field. */
function imageOf(f: Record<string, unknown>): string | undefined {
  const att = Array.isArray(f.Image) ? (f.Image[0] as { url?: string } | undefined) : undefined;
  if (att?.url) return att.url;
  const legacy = f.ImageUrl ?? f.ImageURL;
  return legacy ? String(legacy) : undefined;
}

const toReward = (r: AirtableRecord): RewardItem => ({
  id: r.id,
  title: String(r.fields.Title || ""),
  cost: Number(r.fields.Cost || 10),
  icon: String(r.fields.Icon || "🏆"),
  imageUrl: imageOf(r.fields),
  combinable: Boolean(r.fields.Combinable),
});

/** Unclaimed ledger rows. The Contributions table is optional until pooling is set up. */
const unclaimedContributions = (rows: AirtableRecord[]): Contribution[] =>
  rows
    .filter((r) => !r.fields.Claimed)
    .map((r) => ({
      id: r.id,
      rewardId: String(r.fields.Reward || ""),
      kidId: String(r.fields.Kid || ""),
      amount: Number(r.fields.Amount || 0),
    }));

async function fetchContributions(): Promise<Contribution[]> {
  return unclaimedContributions(await fetchOptional("Contributions"));
}

/** Columns found to be missing from the base, so the name sync stops trying to write them. */
const missingColumns = new Set<string>();

/** Batch-updates rows, dropping any optional column the table turns out not to have instead of failing. */
async function patchManyTolerant(table: string, records: { id: string; fields: Record<string, unknown> }[], optional: string[]) {
  let recs = records;
  for (let attempt = 0; attempt <= optional.length && recs.length; attempt++) {
    try {
      await patchMany(table, recs);
      return;
    } catch (e) {
      const missing = e instanceof Error ? /Unknown field name: "?([^"]+)"?/i.exec(e.message)?.[1] : undefined;
      if (!missing || !optional.includes(missing)) throw e;
      missingColumns.add(`${table}.${missing}`);
      recs = recs
        .map((r) => {
          const fields = { ...r.fields };
          delete fields[missing];
          return { id: r.id, fields };
        })
        .filter((r) => Object.keys(r.fields).length);
    }
  }
}

/**
 * Keeps the readable name columns in step with the IDs: fills in rows that don't have an ID or name yet and
 * corrects names after a kid or reward is renamed. A little at a time, and never allowed to fail a page load.
 */
async function syncNames(
  tasks: AirtableRecord[],
  contribRows: AirtableRecord[],
  redemptionRows: AirtableRecord[],
  lookup: ReturnType<typeof kidLookup>,
  rewardTitles: Map<string, string>
) {
  try {
    const taskPatches: { id: string; fields: Record<string, unknown> }[] = [];
    for (const r of tasks) {
      const who = lookup.resolve(r.fields);
      if (!who.id) continue;
      const fields: Record<string, unknown> = {};
      if (!missingColumns.has("Tasks.AssigneeId") && String(r.fields.AssigneeId || "") !== who.id) fields.AssigneeId = who.id;
      if (!missingColumns.has("Tasks.Assignee") && assigneeOf(r.fields) !== who.name) fields.Assignee = who.name;
      if (Object.keys(fields).length) taskPatches.push({ id: r.id, fields });
    }
    if (taskPatches.length) await patchManyTolerant("Tasks", taskPatches.slice(0, 40), ["AssigneeId", "Assignee"]);

    const contribPatches: { id: string; fields: Record<string, unknown> }[] = [];
    for (const r of contribRows) {
      const rewardName = rewardTitles.get(String(r.fields.Reward || ""));
      const kidName = lookup.byId.get(String(r.fields.Kid || ""))?.name;
      const fields: Record<string, unknown> = {};
      if (rewardName && !missingColumns.has("Contributions.RewardName") && r.fields.RewardName !== rewardName) fields.RewardName = rewardName;
      if (kidName && !missingColumns.has("Contributions.KidName") && r.fields.KidName !== kidName) fields.KidName = kidName;
      if (Object.keys(fields).length) contribPatches.push({ id: r.id, fields });
    }
    if (contribPatches.length) await patchManyTolerant("Contributions", contribPatches.slice(0, 40), ["RewardName", "KidName"]);

    // Earlier redemptions only have names. Fill in their IDs where the names clearly match. The names stay as
    // they were when the reward was earned, since this table is the history of what happened.
    const rewardIdByTitle = new Map<string, string | null>();
    rewardTitles.forEach((title, id) => {
      const key = title.trim().toLowerCase();
      rewardIdByTitle.set(key, rewardIdByTitle.has(key) ? null : id); // two rewards with one name: don't guess
    });
    const redemptionPatches: { id: string; fields: Record<string, unknown> }[] = [];
    for (const r of redemptionRows) {
      const fields: Record<string, unknown> = {};
      if (!r.fields.RewardId && !missingColumns.has("Redemptions.RewardId")) {
        const id = rewardIdByTitle.get(String(r.fields.Reward || "").trim().toLowerCase());
        if (id) fields.RewardId = id;
      }
      if (!r.fields.KidIds && !missingColumns.has("Redemptions.KidIds")) {
        const names = String(r.fields.Kids || "").split(",").map((n) => n.trim()).filter(Boolean);
        const ids = names.map((n) => lookup.idByName(n));
        if (names.length && ids.every(Boolean)) fields.KidIds = ids.join(",");
      }
      if (Object.keys(fields).length) redemptionPatches.push({ id: r.id, fields });
    }
    if (redemptionPatches.length) await patchManyTolerant("Redemptions", redemptionPatches.slice(0, 40), ["RewardId", "KidIds"]);
  } catch (e) {
    console.error("Name sync skipped:", e instanceof Error ? e.message : e);
  }
}

export async function GET(req: NextRequest) {
  const blocked = await denied(req);
  if (blocked) return blocked;

  try {
    const [kids, tasks, rewards, meals, shopping, contribRows, redemptionRows] = await Promise.all([
      fetchTable("Kids"),
      fetchTable("Tasks"),
      fetchTable("Rewards"),
      fetchTable("Meals"),
      fetchTable("Shopping"),
      fetchOptional("Contributions"),
      fetchOptional("Redemptions"),
    ]);
    const kidObjs = sortKids(kids).map((r, i) => ({ ...toKid(r), color: pickColor(r.fields.Color, i) }));
    const lookup = kidLookup(kidObjs);
    const rewardTitles = new Map(rewards.map((r) => [r.id, String(r.fields.Title || "")]));

    const { date: today, dayIndex } = todayIn(TIME_ZONE);

    // Daily reset: repeating tasks completed on an earlier day become available again. One-off tasks
    // completed on an earlier day simply stop showing on the Today screen (the app hides them).
    // A task that is checked off but has no completion date (for example ticked directly in Airtable)
    // is treated as done today. It must not be reset or hidden straight away.
    const allDone = tasks.filter((r) => r.fields.Completed);
    const repeatingDone = allDone.filter((r) => parseRepeat(r.fields.Repeat) !== "none");
    const undated = allDone.filter((r) => !r.fields.LastCompletedDate);
    if (undated.length) {
      await patchMany(
        "Tasks",
        undated.map((r) => ({ id: r.id, fields: { LastCompletedDate: today } }))
      );
      undated.forEach((r) => (r.fields.LastCompletedDate = today));
    }
    const toReset = repeatingDone.filter((r) => String(r.fields.LastCompletedDate) < today);
    if (toReset.length) {
      await patchMany(
        "Tasks",
        toReset.map((r) => ({ id: r.id, fields: { Completed: false } }))
      );
      toReset.forEach((r) => (r.fields.Completed = false));
    }

    await syncNames(tasks, contribRows, redemptionRows, lookup, rewardTitles);

    return NextResponse.json({
      mode: "live",
      today,
      timeZone: TIME_ZONE,
      kids: kidObjs,
      tasks: tasks.map((r) => {
        const repeat = parseRepeat(r.fields.Repeat);
        const repeatDays = parseRepeatDays(r.fields.RepeatDays);
        const who = lookup.resolve(r.fields);
        return {
          id: r.id,
          title: String(r.fields.Title || ""),
          assigneeId: who.id,
          assignee: who.name,
          category: String(r.fields.Category || "").toLowerCase() === "chore" ? "chore" : "school",
          points: Number(r.fields.Points || 1),
          completed: Boolean(r.fields.Completed),
          repeat,
          repeatDays,
          lastCompletedDate: r.fields.LastCompletedDate ? String(r.fields.LastCompletedDate) : undefined,
          imageUrl: imageOf(r.fields),
          icon: r.fields.Icon ? String(r.fields.Icon) : undefined,
          priority: r.fields.Priority === undefined ? undefined : Number(r.fields.Priority),
          dueToday: isDueOn(repeat, repeatDays, dayIndex),
        };
      }),
      rewards: rewards.map(toReward),
      contributions: unclaimedContributions(contribRows),
      redemptions: redemptionRows
        .map((r) => ({
          id: r.id,
          reward: String(r.fields.Reward || ""),
          kids: String(r.fields.Kids || ""),
          details: String(r.fields.Details || ""),
          cost: Number(r.fields.Cost || 0),
          date: String(r.fields.Date || ""),
          fulfilled: Boolean(r.fields.Fulfilled),
        }))
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
      meals: meals.map((r) => ({
        id: r.id,
        date: r.fields.Date ? String(r.fields.Date).slice(0, 10) : "",
        day: String(r.fields.Day || ""),
        breakfast: String(r.fields.Breakfast || ""),
        lunch: String(r.fields.Lunch || ""),
        dinner: String(r.fields.Dinner || ""),
      })),
      shopping: shopping.map((r) => ({
        id: r.id,
        item: String(r.fields.Item || ""),
        category: String(r.fields.Category || "General"),
        checked: Boolean(r.fields.Checked),
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

interface MealPayload {
  id?: string;
  date: string;
  breakfast?: string;
  lunch?: string;
  dinner?: string;
}

/** Creates, updates and deletes many days of meals at once (Airtable allows 10 records per request). */
async function saveMeals(items: MealPayload[]) {
  if (!Array.isArray(items) || items.length > 400) return { error: "Too many days at once." };
  if (items.some((i) => !/^\d{4}-\d{2}-\d{2}$/.test(i.date))) return { error: "Bad date." };

  const fieldsOf = (i: MealPayload) => ({
    Date: i.date,
    Breakfast: (i.breakfast || "").trim(),
    Lunch: (i.lunch || "").trim(),
    Dinner: (i.dinner || "").trim(),
  });
  const isEmpty = (i: MealPayload) => !fieldsOf(i).Breakfast && !fieldsOf(i).Lunch && !fieldsOf(i).Dinner;
  const chunks = <T,>(list: T[]) => Array.from({ length: Math.ceil(list.length / 10) }, (_, n) => list.slice(n * 10, n * 10 + 10));

  const creates = items.filter((i) => !i.id && !isEmpty(i));
  const updates = items.filter((i) => i.id && !isEmpty(i));
  const deletes = items.filter((i) => i.id && isEmpty(i));
  const created: Record<string, string> = {};

  for (const group of chunks(creates)) {
    const res = await airtable<{ records: AirtableRecord[] }>(tableUrl("Meals"), {
      method: "POST",
      body: JSON.stringify({ records: group.map((i) => ({ fields: fieldsOf(i) })), typecast: true }),
    });
    res.records.forEach((r, n) => (created[group[n].date] = r.id));
  }
  for (const group of chunks(updates)) {
    await airtable(tableUrl("Meals"), {
      method: "PATCH",
      body: JSON.stringify({ records: group.map((i) => ({ id: i.id, fields: fieldsOf(i) })), typecast: true }),
    });
  }
  for (const group of chunks(deletes)) {
    const qs = new URLSearchParams();
    group.forEach((i) => qs.append("records[]", i.id as string));
    await airtable(`${tableUrl("Meals")}?${qs.toString()}`, { method: "DELETE" });
  }
  return { ok: true, created };
}

interface TaskMovePayload {
  id: string;
  priority: number;
  /** Set when the task is being given to a different kid. */
  assigneeId?: string;
}

/** Reorders and/or reassigns several tasks in one go. */
async function reorderTasks(items: TaskMovePayload[]) {
  if (!Array.isArray(items) || items.length > 200) return { error: "Too many tasks at once." };
  if (items.some((i) => typeof i.id !== "string" || !Number.isFinite(i.priority))) return { error: "Bad task data." };

  // A task given to another kid saves both the kid's ID and their name.
  const moved = items.some((i) => i.assigneeId);
  const lookup = moved ? kidLookup((await fetchTable("Kids")).map(toKid)) : null;
  const records = items.map((i) => {
    const fields: Record<string, unknown> = { Priority: i.priority };
    const kid = i.assigneeId ? lookup?.byId.get(i.assigneeId) : undefined;
    if (kid) {
      fields.AssigneeId = kid.id;
      fields.Assignee = kid.name;
    }
    return { id: i.id, fields };
  });
  if (moved && records.some((r) => "Assignee" in r.fields) === false) return { error: "That kid no longer exists." };
  try {
    await patchManyTolerant("Tasks", records, ["AssigneeId"]);
  } catch (e) {
    // Older bases spelled the field "Asignee".
    if (e instanceof Error && /unknown field/i.test(e.message) && moved) {
      await patchManyTolerant(
        "Tasks",
        records.map((r) => {
          const { Assignee, ...rest } = r.fields;
          return { id: r.id, fields: Assignee ? { ...rest, Asignee: Assignee } : rest };
        }),
        ["AssigneeId"]
      );
    } else {
      throw e;
    }
  }
  return { ok: true };
}

interface PostBody {
  items?: MealPayload[] | TaskMovePayload[];
  action: string;
  table?: string;
  recordId?: string;
  fields?: Record<string, unknown>;
  taskId?: string;
  completed?: boolean;
  rewardId?: string;
  kidId?: string;
  amount?: number;
  contributionId?: string;
}

/**
 * Tidies fields before they are written. Pictures are copied into Airtable from Pixabay only, so any
 * other address is dropped; an empty list clears the picture. Task categories are saved as "school" or "chore"
 * (older rows that say "task" are still read as schoolwork).
 */
function cleanFields(table: string, input: Record<string, unknown>): Record<string, unknown> {
  const fields = { ...input };
  if (Array.isArray(fields.Image)) {
    const ok = (fields.Image as { url?: string }[]).filter((a) => {
      try {
        return new URL(a.url || "").hostname.endsWith("pixabay.com");
      } catch {
        return false;
      }
    });
    if (ok.length || fields.Image.length === 0) fields.Image = ok.map((a) => ({ url: a.url }));
    else delete fields.Image;
  }
  if (table === "Tasks" && "Category" in fields) fields.Category = fields.Category === "chore" ? "chore" : "school";
  return fields;
}

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

/** Creates a row, dropping any of the `optional` fields the table doesn't have (yet) instead of failing. */
async function createWithoutMissing(table: string, fields: Record<string, unknown>, optional: string[]) {
  const f = { ...fields };
  for (let attempt = 0; attempt <= optional.length; attempt++) {
    try {
      return await createRecord(table, f);
    } catch (e) {
      const missing = e instanceof Error ? /Unknown field name: "?([^"]+)"?/i.exec(e.message)?.[1] : undefined;
      if (!missing || !optional.includes(missing) || !(missing in f)) throw e;
      delete f[missing];
    }
  }
  return createRecord(table, f);
}

/** Fields that are nice to have; if the base doesn't have them yet, saving a task still works without them. */
const OPTIONAL_TASK_FIELDS = new Set(["TimesCompleted", "PrevCompletedDate"]);

async function patchTaskTolerant(id: string, fields: Record<string, unknown>) {
  const f = { ...fields };
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await patchRecord("Tasks", id, f);
    } catch (e) {
      const missing = e instanceof Error ? /Unknown field name: "?([^"]+)"?/i.exec(e.message)?.[1] : undefined;
      if (!missing || !OPTIONAL_TASK_FIELDS.has(missing) || !(missing in f)) throw e;
      delete f[missing];
    }
  }
}

const dateOnly = (v: unknown) => (v ? String(v).slice(0, 10) : "");

async function completeTask(taskId: string, completed: boolean) {
  const [task, kidRows] = await Promise.all([getRecord("Tasks", taskId), fetchTable("Kids")]);
  if (Boolean(task.fields.Completed) === completed) return { ok: true, unchanged: true };

  const points = Number(task.fields.Points || 1);
  const lookup = kidLookup(kidRows.map(toKid));
  const kid = lookup.byId.get(lookup.resolve(task.fields).id);

  const { date } = todayIn(TIME_ZONE);
  const lastDate = dateOnly(task.fields.LastCompletedDate);
  const prevDate = dateOnly(task.fields.PrevCompletedDate);

  // The running total goes up when a task is completed and comes back down if it's undone, so it always
  // equals the number of completions that stuck.
  const fields: Record<string, unknown> = {
    Completed: completed,
    TimesCompleted: Math.max(0, Number(task.fields.TimesCompleted || 0) + (completed ? 1 : -1)),
  };
  if (completed) {
    fields.LastCompletedDate = date;
    // Remember the earlier completion so undoing this one can put it back.
    if (lastDate && lastDate !== date) fields.PrevCompletedDate = lastDate;
  } else if (prevDate) {
    fields.LastCompletedDate = prevDate; // back to the last time it was really finished
  } else if (lastDate === date) {
    fields.LastCompletedDate = null; // it had never been finished before today's undone completion
  }

  await Promise.all([
    patchTaskTolerant(taskId, fields),
    kid ? patchRecord("Kids", kid.id, { Stars: kid.stars + (completed ? points : -points) }) : Promise.resolve(),
  ]);
  return { ok: true };
}

async function deposit(rewardId: string, kidId: string, amount: number) {
  const [kidRec, rewardRec, contribs] = await Promise.all([
    getRecord("Kids", kidId),
    getRecord("Rewards", rewardId),
    fetchContributions(),
  ]);
  const kid = toKid(kidRec);
  const reward = toReward(rewardRec);
  const error = validateDeposit(kid, reward, contribs, amount);
  if (error) return { error };

  const [, created] = await Promise.all([
    patchRecord("Kids", kid.id, { Stars: kid.stars - amount }),
    // Reward and Kid hold the internal IDs the app matches on. RewardName and KidName are readable
    // copies for people looking at the table; they're skipped if those columns don't exist yet.
    createWithoutMissing("Contributions", { Reward: rewardId, Kid: kidId, Amount: amount, Claimed: false, RewardName: reward.title, KidName: kid.name }, ["RewardName", "KidName"]),
  ]);

  // Shared rewards claim when the common jar is full; solo rewards claim per kid.
  const mine = (c: Contribution) => c.rewardId === rewardId && (reward.combinable || c.kidId === kidId);
  const jar: Contribution[] = [...contribs.filter(mine), { id: created.id, rewardId, kidId, amount }];
  const total = jar.reduce((s, c) => s + c.amount, 0);
  if (total < reward.cost) return { ok: true, claimed: false, contributionId: created.id };

  // Mark the jar claimed and log it for the parents' tracker, in parallel. The Redemptions table is
  // optional, so never fail the claim over it.
  const byKid = new Map<string, number>();
  jar.forEach((c) => byKid.set(c.kidId, (byKid.get(c.kidId) || 0) + c.amount));
  const logRedemption = async () => {
    try {
      const kidList = (await fetchTable("Kids")).map(toKid);
      const nameOf = (id: string) => kidList.find((k) => k.id === id)?.name || "?";
      // Reward, Kids and Details are the readable record of what was earned. RewardId and KidIds are the
      // matching IDs (same order as Kids); they're skipped if those columns aren't in the table yet.
      const rec = await createWithoutMissing(
        "Redemptions",
        {
          Reward: reward.title,
          Kids: Array.from(byKid.keys()).map(nameOf).join(", "),
          Details: Array.from(byKid, ([id, amt]) => `${nameOf(id)} ${amt}★`).join(", "),
          Cost: reward.cost,
          Date: todayIn(TIME_ZONE).date,
          Fulfilled: false,
          RewardId: reward.id,
          KidIds: Array.from(byKid.keys()).join(","),
        },
        ["RewardId", "KidIds"]
      );
      return rec.id;
    } catch (e) {
      console.error("Could not log redemption (is there a Redemptions table?):", e);
      return undefined;
    }
  };
  const [, redemptionId] = await Promise.all([
    patchMany("Contributions", jar.map((c) => ({ id: c.id, fields: { Claimed: true } }))),
    logRedemption(),
  ]);
  return { ok: true, claimed: true, contributionId: created.id, redemptionId };
}

async function withdraw(contributionId: string) {
  const rec = await getRecord("Contributions", contributionId);
  if (rec.fields.Claimed) return { error: "That reward was already claimed." };
  const kid = toKid(await getRecord("Kids", String(rec.fields.Kid)));
  await patchRecord("Kids", kid.id, { Stars: kid.stars + Number(rec.fields.Amount || 0) });
  await deleteRecord("Contributions", contributionId);
  return { ok: true };
}

export async function POST(req: NextRequest) {
  const blocked = await denied(req);
  if (blocked) return blocked;

  const body = (await req.json()) as PostBody;

  try {
    switch (body.action) {
      case "completeTask": {
        if (!body.taskId) return fail("taskId required");
        return NextResponse.json(await completeTask(body.taskId, !!body.completed));
      }
      case "reorderTasks": {
        const result = await reorderTasks((body.items || []) as TaskMovePayload[]);
        return "error" in result ? fail(result.error as string) : NextResponse.json(result);
      }
      case "saveMeals": {
        const result = await saveMeals((body.items || []) as MealPayload[]);
        return "error" in result ? fail(result.error as string) : NextResponse.json(result);
      }
      case "deposit": {
        if (!body.rewardId || !body.kidId) return fail("rewardId and kidId required");
        const result = await deposit(body.rewardId, body.kidId, Number(body.amount));
        return "error" in result ? fail(result.error as string, 409) : NextResponse.json(result);
      }
      case "withdraw": {
        if (!body.contributionId) return fail("contributionId required");
        const result = await withdraw(body.contributionId);
        return "error" in result ? fail(result.error as string, 409) : NextResponse.json(result);
      }
      case "create":
      case "update":
      case "delete": {
        if (!body.table || !WRITABLE_TABLES.includes(body.table)) return fail("Table not allowed");
        if (body.action === "create" || body.action === "update") {
          const fields = cleanFields(body.table, body.fields || {});
          const write = (f: Record<string, unknown>) =>
            body.action === "create" ? createRecord(body.table as string, f) : patchRecord(body.table as string, body.recordId as string, f);
          if (body.action === "update" && !body.recordId) return fail("recordId required");
          // If the base is missing a column, retry without it (or under its older spelling) instead of failing.
          let f = fields;
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              return NextResponse.json(await write(f));
            } catch (e) {
              const missing = e instanceof Error ? /Unknown field name: "?([^"]+)"?/i.exec(e.message)?.[1] : undefined;
              if (body.table === "Tasks" && missing === "AssigneeId" && "AssigneeId" in f) {
                f = { ...f };
                delete f.AssigneeId;
              } else if (body.table === "Tasks" && missing === "Assignee" && "Assignee" in f) {
                const { Assignee, ...rest } = f;
                f = { ...rest, Asignee: Assignee };
              } else {
                throw e;
              }
            }
          }
          return fail("Couldn't save that.");
        }
        if (!body.recordId) return fail("recordId required");
        return NextResponse.json(await deleteRecord(body.table, body.recordId));
      }
      default:
        return fail("Unknown action");
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
