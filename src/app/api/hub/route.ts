import { NextRequest, NextResponse } from "next/server";

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const FAMILY_PIN = process.env.FAMILY_PIN || "1234";

function isAuthorized(req: NextRequest) {
  const pin = req.headers.get("x-family-pin");
  return pin === FAMILY_PIN && !!AIRTABLE_TOKEN && !!BASE_ID;
}

async function fetchTable(tableName: string) {
  const res = await fetch(
    `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(tableName)}`,
    {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
      cache: "no-store",
    }
  );
  if (!res.ok) throw new Error(`Failed to fetch ${tableName}`);
  const data = await res.json();
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
      kids: kids.map((r: any) => ({
        id: r.id,
        name: r.fields.Name || "Kid",
        stars: r.fields.Stars || 0,
        color: r.fields.Color || "blue",
      })),
      tasks: tasks.map((r: any) => ({
        id: r.id,
        title: r.fields.Title || "",
        assignee: r.fields.Assignee || "",
        category: r.fields.Category || "chore",
        points: r.fields.Points || 1,
        completed: !!r.fields.Completed,
      })),
      rewards: rewards.map((r: any) => ({
        id: r.id,
        title: r.fields.Title || "",
        cost: r.fields.Cost || 10,
        icon: r.fields.Icon || "🏆",
      })),
      meals: meals.map((r: any) => ({
        id: r.id,
        day: r.fields.Day || "",
        breakfast: r.fields.Breakfast || "",
        lunch: r.fields.Lunch || "",
        dinner: r.fields.Dinner || "",
      })),
      shopping: shopping.map((r: any) => ({
        id: r.id,
        item: r.fields.Item || "",
        category: r.fields.Category || "General",
        checked: !!r.fields.Checked,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { action, table, recordId, fields } = body;

  try {
    let url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(table)}`;
    let method = "POST";
    let payload: any = { fields };

    if (action === "update") {
      url = `${url}/${recordId}`;
      method = "PATCH";
    } else if (action === "delete") {
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

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}