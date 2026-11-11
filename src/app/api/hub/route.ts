import { NextRequest, NextResponse } from "next/server";
import { isDueOn, parseRepeat, parseRepeatDays, todayIn, validateDeposit } from "@/lib/rules";
import type { Contribution, Kid, RewardItem } from "@/lib/types";

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const FAMILY_PIN = process.env.FAMILY_PIN;
const TIME_ZONE = process.env.FAMILY_TIMEZONE || "America/Denver";

const WRITABLE_TABLES = ["Kids", "Tasks", "Rewards", "Meals", "Shopping"];

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

function isAuthorized(req: NextRequest) {
  const pin = req.headers.get("x-family-pin");
  return !!FAMILY_PIN && pin === FAMILY_PIN && !!AIRTABLE_TOKEN && !!BASE_ID;
}

const tableUrl = (table: string) =>
  `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(table)}`;

const authHeaders = {
  Authorization: `Bearer ${AIRTABLE_TOKEN}`,
  "Content-Type": "application/json",
};

async function airtable<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: authHeaders, cache: "no-store" });
  const data = (await res.json()) as T & { error?: { message?: string } | string };
  if (!res.ok) {
    const err = data.error;
    throw new Error(typeof err === "string" ? err : err?.message || `Airtable error ${res.status}`);
  }
  return data;
}

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
});

const toReward = (r: AirtableRecord): RewardItem => ({
  id: r.id,
  title: String(r.fields.Title || ""),
  cost: Number(r.fields.Cost || 10),
  icon: String(r.fields.Icon || "🏆"),
  imageUrl: r.fields.ImageUrl ? String(r.fields.ImageUrl) : undefined,
  combinable: Boolean(r.fields.Combinable),
});

/** Unclaimed ledger rows. The Contributions table is optional until pooling is set up. */
async function fetchContributions(): Promise<Contribution[]> {
  try {
    const rows = await fetchTable("Contributions");
    return rows
      .filter((r) => !r.fields.Claimed)
      .map((r) => ({
        id: r.id,
        rewardId: String(r.fields.Reward || ""),
        kidId: String(r.fields.Kid || ""),
        amount: Number(r.fields.Amount || 0),
      }));
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ mode: "demo" }, { status: 401 });
  }

  try {
    const [kids, tasks, rewards, meals, shopping, contributions] = await Promise.all([
      fetchTable("Kids"),
      fetchTable("Tasks"),
      fetchTable("Rewards"),
      fetchTable("Meals"),
      fetchTable("Shopping"),
      fetchContributions(),
    ]);

    const { date: today, dayIndex } = todayIn(TIME_ZONE);

    // Daily reset: repeating tasks completed on an earlier day become available again.
    const toReset = tasks.filter(
      (r) =>
        r.fields.Completed &&
        parseRepeat(r.fields.Repeat) !== "none" &&
        String(r.fields.LastCompletedDate || "") < today
    );
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
      kids: kids.map(toKid),
      tasks: tasks.map((r) => {
        const repeat = parseRepeat(r.fields.Repeat);
        const repeatDays = parseRepeatDays(r.fields.RepeatDays);
        return {
          id: r.id,
          title: String(r.fields.Title || ""),
          assignee: String(r.fields.Assignee || ""),
          category: r.fields.Category === "school" ? "school" : "chore",
          points: Number(r.fields.Points || 1),
          completed: Boolean(r.fields.Completed),
          repeat,
          repeatDays,
          lastCompletedDate: r.fields.LastCompletedDate ? String(r.fields.LastCompletedDate) : undefined,
          imageUrl: r.fields.ImageUrl ? String(r.fields.ImageUrl) : undefined,
          dueToday: isDueOn(repeat, repeatDays, dayIndex),
        };
      }),
      rewards: rewards.map(toReward),
      contributions,
      meals: meals.map((r) => ({
        id: r.id,
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

interface PostBody {
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
  const task = await getRecord("Tasks", taskId);
  if (Boolean(task.fields.Completed) === completed) return { ok: true, unchanged: true };

  const points = Number(task.fields.Points || 1);
  const assignee = String(task.fields.Assignee || "");
  const kids = (await fetchTable("Kids")).map(toKid);
  const kid = kids.find((k) => k.name === assignee);

  const { date } = todayIn(TIME_ZONE);
  await patchRecord("Tasks", taskId, {
    Completed: completed,
    LastCompletedDate: completed ? date : null,
  });
  if (kid) {
    await patchRecord("Kids", kid.id, { Stars: kid.stars + (completed ? points : -points) });
  }
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

  await patchRecord("Kids", kid.id, { Stars: kid.stars - amount });
  await createRecord("Contributions", {
    Reward: rewardId,
    Kid: kidId,
    Amount: amount,
    Claimed: false,
  });

  const total = contribs.filter((c) => c.rewardId === rewardId).reduce((s, c) => s + c.amount, 0) + amount;
  if (total >= reward.cost) {
    // Re-read so the row we just created is included, then mark the whole jar as claimed.
    const jar = (await fetchContributions()).filter((c) => c.rewardId === rewardId);
    await patchMany(
      "Contributions",
      jar.map((c) => ({ id: c.id, fields: { Claimed: true } }))
    );
    return { ok: true, claimed: true };
  }
  return { ok: true, claimed: false };
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
          return NextResponse.json(await createRecord(body.table, body.fields || {}));
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
