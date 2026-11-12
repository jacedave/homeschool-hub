import { NextRequest, NextResponse } from "next/server";

const FAMILY_PIN = process.env.FAMILY_PIN;
const PIXABAY_KEY = process.env.PIXABAY_API_KEY;

interface PixabayHit {
  id: number;
  tags?: string;
  webformatURL?: string;
  largeImageURL?: string;
}

/**
 * Picture search for tasks and rewards, using Pixabay with its safe-search filter on.
 * The chosen picture is later copied into Airtable (see the "Image" attachment field), so the app
 * never depends on Pixabay's servers after that.
 */
export async function GET(req: NextRequest) {
  const pin = req.headers.get("x-family-pin");
  if (!FAMILY_PIN || pin !== FAMILY_PIN) {
    return NextResponse.json({ error: "Unlock live mode to search pictures." }, { status: 401 });
  }
  if (!PIXABAY_KEY) {
    return NextResponse.json({ error: "Picture search isn't set up yet. A parent needs to add a free Pixabay key (PIXABAY_API_KEY) to the app's settings." }, { status: 501 });
  }

  const q = (req.nextUrl.searchParams.get("q") || "").trim().slice(0, 100);
  const kind = req.nextUrl.searchParams.get("kind") === "photo" ? "photo" : "illustration";
  if (!q) return NextResponse.json({ results: [] });

  const url =
    `https://pixabay.com/api/?key=${encodeURIComponent(PIXABAY_KEY)}&q=${encodeURIComponent(q)}` +
    `&image_type=${kind}&safesearch=true&per_page=18&orientation=all`;

  try {
    // Pixabay allows caching results for 24 hours.
    const res = await fetch(url, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(8000) });
    if (res.status === 429) return NextResponse.json({ error: "Picture search is busy. Try again in a minute." }, { status: 429 });
    if (!res.ok) {
      console.error("Pixabay error", res.status);
      return NextResponse.json({ error: "Picture search is unavailable right now." }, { status: 502 });
    }
    const data = (await res.json()) as { hits?: PixabayHit[] };
    const results = (data.hits || [])
      .filter((h) => h.webformatURL && h.largeImageURL)
      .map((h) => ({
        id: String(h.id),
        title: h.tags || "",
        // Pixabay lets you swap the size suffix: _340 is a small preview, largeImageURL is ~1280px.
        thumb: (h.webformatURL as string).replace("_640", "_340"),
        url: h.largeImageURL as string,
      }));
    return NextResponse.json({ results });
  } catch (e) {
    console.error("Pixabay request failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Picture search is unavailable right now." }, { status: 502 });
  }
}
