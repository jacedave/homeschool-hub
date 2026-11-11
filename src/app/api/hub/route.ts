import { NextRequest, NextResponse } from "next/server";

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const FAMILY_PIN = process.env.FAMILY_PIN || "1234";

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

function isAuthorized(req: NextRequest) {
  const pin = req.headers.get("x-family-pin");
  return pin === FAMILY_PIN && !!AIRTABLE_TOKEN && !!BASE_ID;
}

async function fetchTable(tableName: string): Promise<AirtableRecord[]> {
  const res = await fetch(
    `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(tableName)}`,
    {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
      cache: "no-store",
    }
  );
  if (!res.ok) throw new Error(`Failed to fetch ${tableName}`);
  const data = (await res.json()) as { records: AirtableRecord[] };
  return data.records;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ mode: "demo" }, { status: 401 });
  }

  try {
    const [kids, tasks, rewards, meals, shopping] = await Promise.all([
      fetchTable("Kids"),
      fetchTable("Tasks"),
      fetchTable("Rewards"),
      fetchTable("Meals"),
      fetchTable("Shopping"),
    ]);

    return NextResponse.json({
      mode: "live",
      kids: kids.map((r) => ({
        id: r.id,
        name: String(r.fields.Name || "Kid"),
        stars: Number(r.fields.Stars || 0),
        color: String(r.fields.Color || "blue"),
      })),
      tasks: tasks.map((r) => ({
        id: r.id,
        title: String(r.fields.Title || ""),
        assignee: String(r.fields.Assignee || ""),
        category: r.fields.Category === "school" ? "school" : "chore",
        points: Number(r.fields.Points || 1),
        completed: Boolean(r.fields.Completed),
      })),
      rewards: rewards.map((r) => ({
        id: r.id,
        title: String(r.fields.Title || ""),
        cost: Number(r.fields.Cost || 10),
        icon: String(r.fields.Icon || "🏆"),
      })),
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

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    action: string;
    table: string;
    recordId?: string;
    fields?: Record<string, unknown>;
  };
  const { action, table, recordId, fields } = body;

  try {
    let url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(table)}`;
    let method = "POST";
    let payload: { fields?: Record<string, unknown> } | undefined = { fields };

    if (action === "update" && recordId) {
      url = `${url}/${recordId}`;
      method = "PATCH";
    } else if (action === "delete" && recordId) {
      url = `${url}/${recordId}`;
      method = "DELETE";
      payload = undefined;
    }

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: payload ? JSON.stringify(payload) : undefined,
    });

    const data: unknown = await res.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}