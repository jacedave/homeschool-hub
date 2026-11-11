import { NextRequest, NextResponse } from "next/server";

const FAMILY_PIN = process.env.FAMILY_PIN;

interface OpenverseResult {
  id: string;
  title?: string;
  thumbnail?: string;
  url?: string;
}

/** Picture search for rewards and tasks, via Openverse (free, no API key, family-safe filter on). */
export async function GET(req: NextRequest) {
  const pin = req.headers.get("x-family-pin");
  if (!FAMILY_PIN || pin !== FAMILY_PIN) {
    return NextResponse.json({ error: "Unlock live mode to search pictures." }, { status: 401 });
  }

  const q = (req.nextUrl.searchParams.get("q") || "").trim().slice(0, 80);
  const kind = req.nextUrl.searchParams.get("kind") === "photo" ? "photograph" : "illustration";
  if (!q) return NextResponse.json({ results: [] });

  const url =
    `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}` +
    `&category=${kind}&page_size=18&mature=false&extension=jpg,png&aspect_ratio=square,wide,tall`;

  try {
    const res = await fetch(url, { next: { revalidate: 86400 }, headers: { Accept: "application/json" } });
    if (res.status === 429) {
      return NextResponse.json({ error: "Picture search is busy. Try again in a minute." }, { status: 429 });
    }
    if (!res.ok) return NextResponse.json({ error: "Picture search is unavailable right now." }, { status: 502 });
    const data = (await res.json()) as { results?: OpenverseResult[] };
    const results = (data.results || [])
      .filter((r) => r.thumbnail)
      .map((r) => ({ id: r.id, title: r.title || "", url: r.thumbnail as string }));
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "Picture search is unavailable right now." }, { status: 502 });
  }
}
