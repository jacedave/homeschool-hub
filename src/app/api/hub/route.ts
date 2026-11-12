import { NextRequest, NextResponse } from "next/server";
import { isDueOn, parseRepeat, parseRepeatDays, todayIn, validateDeposit } from "@/lib/rules";
import { FAMILY_TZ } from "@/lib/config";
import { COLOR_MAP } from "@/lib/colors";
import type { Contribution, Kid, RewardItem } from "@/lib/types";

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const FAMILY_PIN = process.env.FAMILY_PIN;
const TIME_ZONE = FAMILY_TZ;

const WRITABLE_TABLES = ["Kids", "Tasks", "Rewards", "Meals", "Shopping", "Redemptions"];

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

function isAuthorized(req: NextRequest) {
  const pin = req.headers.get("x-family-pin");
  return !!FAMILY_PIN && pin === FAMILY_PIN && !!AIRTABLE_TOKEN && !!BASE_ID;
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
async function fetchContributions(): Promise<Contribution[]> {
  const rows = await fetchOptional("Contributions");
  return rows
    .filter((r) => !r.fields.Claimed)
    .map((r) => ({
      id: r.id,
      rewardId: String(r.fields.Reward || ""),
      kidId: String(r.fields.Kid || ""),
      amount: Number(r.fields.Amount || 0),
    }));
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ mode: "demo" }, { status: 401 });
  }

  try {
    const [kids, tasks, rewards, meals, shopping, contributions, redemptionRows] = await Promise.all([
      fetchTable("Kids"),
      fetchTable("Tasks"),
      fetchTable("Rewards"),
      fetchTable("Meals"),
      fetchTable("Shopping"),
      fetchContributions(),
      fetchOptional("Redemptions"),
    ]);

    const { date: today, dayIndex } = todayIn(TIME_ZONE);

    // Daily reset: repeating tasks completed on an earlier day become available again.
    // A task that is checked off but has no completion date (for example ticked directly in Airtable)
    // is treated as done today. It must not be reset straight away.
    const repeatingDone = tasks.filter((r) => r.fields.Completed && parseRepeat(r.fields.Repeat) !== "none");
    const undated = repeatingDone.filter((r) => !r.fields.LastCompletedDate);
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

    return NextResponse.json({
      mode: "live",
      today,
      timeZone: TIME_ZONE,
      kids: sortKids(kids).map((r, i) => ({ ...toKid(r), color: pickColor(r.fields.Color, i) })),
      tasks: tasks.map((r) => {
        const repeat = parseRepeat(r.fields.Repeat);
        const repeatDays = parseRepeatDays(r.fields.RepeatDays);
        return {
          id: r.id,
          title: String(r.fields.Title || ""),
          assignee: assigneeOf(r.fields),
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
      contributions,
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
  assignee?: string;
}

/** Reorders and/or reassigns several tasks in one go. */
async function reorderTasks(items: TaskMovePayload[]) {
  if (!Array.isArray(items) || items.length > 200) return { error: "Too many tasks at once." };
  if (items.some((i) => typeof i.id !== "string" || !Number.isFinite(i.priority))) return { error: "Bad task data." };
  const records = items.map((i) => ({ id: i.id, fields: { Priority: i.priority, ...(i.assignee ? { Assignee: i.assignee } : {}) } }));
  try {
    await patchMany("Tasks", records);
  } catch (e) {
    // Older bases spelled the field "Asignee".
    if (e instanceof Error && /unknown field/i.test(e.message) && items.some((i) => i.assignee)) {
      await patchMany("Tasks", items.map((i) => ({ id: i.id, fields: { Priority: i.priority, ...(i.assignee ? { Asignee: i.assignee } : {}) } })));
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

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

async function completeTask(taskId: string, completed: boolean) {
  const [task, kidRows] = await Promise.all([getRecord("Tasks", taskId), fetchTable("Kids")]);
  if (Boolean(task.fields.Completed) === completed) return { ok: true, unchanged: true };

  const points = Number(task.fields.Points || 1);
  const assignee = assigneeOf(task.fields);
  const kid = kidRows.map(toKid).find((k) => k.name === assignee);

  const { date } = todayIn(TIME_ZONE);
  await Promise.all([
    patchRecord("Tasks", taskId, { Completed: completed, LastCompletedDate: completed ? date : null }),
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
    createRecord("Contributions", { Reward: rewardId, Kid: kidId, Amount: amount, Claimed: false }),
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
      const rec = await createRecord("Redemptions", {
        Reward: reward.title,
        Kids: Array.from(byKid.keys()).map(nameOf).join(", "),
        Details: Array.from(byKid, ([id, amt]) => `${nameOf(id)} ${amt}★`).join(", "),
        Cost: reward.cost,
        Date: todayIn(TIME_ZONE).date,
        Fulfilled: false,
      });
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
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
        if (body.action === "create") {
          let fields = body.fields || {};
          // Pictures are copied into Airtable from Pixabay only; ignore any other address.
          if (Array.isArray(fields.Image)) {
            const ok = (fields.Image as { url?: string }[]).filter((a) => {
              try {
                return new URL(a.url || "").hostname.endsWith("pixabay.com");
              } catch {
                return false;
              }
            });
            fields = { ...fields, Image: ok.map((a) => ({ url: a.url })) };
            if (!ok.length) delete fields.Image;
          }
          if (body.table === "Tasks") {
            // The base uses "Task"/"Chore" category names and may spell the field "Asignee".
            fields = { ...fields, Category: fields.Category === "chore" ? "chore" : "task" };
            try {
              return NextResponse.json(await createRecord("Tasks", fields));
            } catch (e) {
              if (e instanceof Error && /unknown field/i.test(e.message) && "Assignee" in fields) {
                const { Assignee, ...rest } = fields;
                return NextResponse.json(await createRecord("Tasks", { ...rest, Asignee: Assignee }));
              }
              throw e;
            }
          }
          return NextResponse.json(await createRecord(body.table, fields));
        }
        if (!body.recordId) return fail("recordId required");
        if (body.action === "update") {
          return NextResponse.json(await patchRecord(body.table, body.recordId, body.fields || {}));
        }
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
