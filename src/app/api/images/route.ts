import { NextRequest, NextResponse } from "next/server";
import { authorizePin, lockedMessage } from "@/lib/auth";
import { fetchJsonCached } from "@/lib/cachedFetch";

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
  const auth = await authorizePin(req);
  if (auth.status === "locked") return NextResponse.json({ error: lockedMessage(auth.minutes) }, { status: 429 });
  if (auth.status !== "ok") {
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
    const data = await fetchJsonCached<{ hits?: PixabayHit[] }>(url, { ttlMs: 24 * 60 * 60 * 1000, timeoutMs: 8000 });

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
    if ((e as { status?: number }).status === 429) return NextResponse.json({ error: "Picture search is busy. Try again in a minute." }, { status: 429 });
    return NextResponse.json({ error: "Picture search is unavailable right now." }, { status: 502 });
  }
}
