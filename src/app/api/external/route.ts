import { NextRequest, NextResponse } from "next/server";
import * as ical from "node-ical";
import { FAMILY_TZ } from "@/lib/config";
import { authorizePin, lockedMessage } from "@/lib/auth";
import { expandEvents, ExpandedEvent } from "@/lib/icalExpand";
import { zonedStartOfDay } from "@/lib/rules";

/** Google Photos escapes characters inside the page's JSON, e.g. \\u003d for "=". */
const unescapeUrl = (s: string) => s.replace(/\\u003d/g, "=").replace(/\\u0026/g, "&").replace(/\\\//g, "/");

export async function GET(req: NextRequest) {
  const auth = await authorizePin(req);
  if (auth.status === "locked") return NextResponse.json({ error: lockedMessage(auth.minutes) }, { status: 429 });
  const isAuth = auth.status === "ok";

  const lat = process.env.WEATHER_LAT || "37.0965";
  const lon = process.env.WEATHER_LON || "-113.5684";
  let weather: unknown = null;

  try {
    const wRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,weathercode&temperature_unit=fahrenheit&timezone=${encodeURIComponent(FAMILY_TZ)}`,
      { next: { revalidate: 1800 } }
    );
    if (wRes.ok) weather = await wRes.json();
  } catch (e) {
    console.error("Weather error:", e);
  }

  if (!isAuth) {
    return NextResponse.json({
      weather,
      events: [
        { id: "d1", title: "Homeschool Co-op", start: new Date().toISOString(), allDay: false },
        { id: "d2", title: "Music Practice", start: new Date(Date.now() + 86400000).toISOString(), allDay: false },
        { id: "d3", title: "Park Day & Disc Golf", start: new Date(Date.now() + 172800000).toISOString(), allDay: false },
      ],
      photos: [
        "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1600&q=80",
        "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1600&q=80",
        "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=1600&q=80",
      ],
    });
  }

  const icalUrls = (process.env.ICAL_URLS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const rangeStart = zonedStartOfDay(FAMILY_TZ);
  const rangeEnd = new Date(rangeStart.getTime() + 14 * 24 * 60 * 60 * 1000);
  const events: ExpandedEvent[] = [];

  for (const url of icalUrls) {
    try {
      const parsed = await ical.async.fromURL(url);
      events.push(...expandEvents(parsed, rangeStart, rangeEnd));
    } catch (e) {
      console.error("iCal parse error:", e);
    }
  }
  events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  let photos: string[] = [];
  const albumUrl = process.env.GOOGLE_PHOTOS_ALBUM_URL;
  if (albumUrl) {
    try {
      const pRes = await fetch(albumUrl, { redirect: "follow", cache: "no-store" });
      const html = await pRes.text();
      const regex = /"(https:\/\/lh3\.googleusercontent\.com\/pw\/[^"]+)"/g;
      const matches = new Set<string>();
      let match: RegExpExecArray | null;
      while ((match = regex.exec(html)) !== null) {
        const base = unescapeUrl(match[1]).split("=")[0];
        matches.add(`${base}=w1600-h1200`);
      }
      photos = Array.from(matches).slice(0, 40);
    } catch (e) {
      console.error("Google Photos scrape error:", e);
    }
  }

  return NextResponse.json({ weather, events: events.slice(0, 40), photos });
}
