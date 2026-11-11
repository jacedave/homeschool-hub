import { NextRequest, NextResponse } from "next/server";
import * as ical from "node-ical";

const FAMILY_PIN = process.env.FAMILY_PIN || "1234";

export async function GET(req: NextRequest) {
  const pin = req.headers.get("x-family-pin");
  const isAuth = pin === FAMILY_PIN;

  // 1. Fetch 3-Day Weather (Open-Meteo - Free, No Key Needed)
  const lat = process.env.WEATHER_LAT || "37.0965";
  const lon = process.env.WEATHER_LON || "-113.5684";
  let weather = null;

  try {
    const wRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,weathercode&temperature_unit=fahrenheit&timezone=auto`,
      { next: { revalidate: 1800 } }
    );
    if (wRes.ok) {
      weather = await wRes.json();
    }
  } catch (e) {
    console.error("Weather error:", e);
  }

  // If in Demo Mode, return sample calendar & sample nature photos
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

  // 2. Parse Live Google Calendar .ics URLs
  const icalUrls = (process.env.ICAL_URLS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const events: any[] = [];
  const now = new Date();
  const twoWeeksOut = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  for (const url of icalUrls) {
    try {
      const parsed = await ical.async.fromURL(url);
      for (const k in parsed) {
        const ev: any = parsed[k];
        if (ev.type === "VEVENT" && ev.start) {
          const startDate = new Date(ev.start);
          if (startDate >= new Date(now.setHours(0, 0, 0, 0)) && startDate <= twoWeeksOut) {
            events.push({
              id: ev.uid || k,
              title: ev.summary || "Busy",
              start: startDate.toISOString(),
              end: ev.end ? new Date(ev.end).toISOString() : null,
              location: ev.location || "",
            });
          }
        }
      }
    } catch (e) {
      console.error("iCal parse error:", e);
    }
  }
  events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  // 3. Scrape Google Photos Shared Album for Screensaver
  let photos: string[] = [];
  const albumUrl = process.env.GOOGLE_PHOTOS_ALBUM_URL;
  if (albumUrl) {
    try {
      const pRes = await fetch(albumUrl, { redirect: "follow", cache: "no-store" });
      const html = await pRes.text();
      const regex = /"(https:\/\/lh3\.googleusercontent\.com\/pw\/[^"]+)"/g;
      const matches = new Set<string>();
      let match;
      while ((match = regex.exec(html)) !== null) {
        matches.add(`${match[1]}=w1400-h1050-no`);
      }
      photos = Array.from(matches).slice(0, 40);
    } catch (e) {
      console.error("Google Photos scrape error:", e);
    }
  }

  return NextResponse.json({ weather, events: events.slice(0, 25), photos });
}