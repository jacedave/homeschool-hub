import type { CalendarComponent, VEvent } from "node-ical";

export interface ExpandedEvent {
  id: string;
  title: string;
  start: string;
  end: string | null;
  location: string;
  allDay: boolean;
}

type Param = string | { val?: string } | undefined;
const text = (v: Param): string => (typeof v === "string" ? v : v?.val || "");

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Turns a parsed iCal feed into a flat list of event instances inside [from, to],
 * expanding RRULE recurrences and honouring EXDATE removals and RECURRENCE-ID overrides.
 */
export function expandEvents(parsed: Record<string, CalendarComponent | undefined>, from: Date, to: Date): ExpandedEvent[] {
  const out: ExpandedEvent[] = [];

  const push = (info: { summary: Param; location: Param; allDay: boolean }, start: Date, end: Date | undefined, key: string) => {
    // (start/end are reassigned below for all-day events)
    const endMs = (end ?? start).getTime();
    if (endMs < from.getTime() || start.getTime() > to.getTime()) return;
    if (info.allDay) {
      // All-day events have no real time. Pin them to noon UTC on their calendar date so the
      // device shows the right day in any timezone.
      const noon = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12));
      start = noon(start);
      end = end ? noon(end) : undefined;
    }
    out.push({
      id: `${key}-${start.toISOString()}`,
      title: text(info.summary) || "Busy",
      start: start.toISOString(),
      end: end ? end.toISOString() : null,
      location: text(info.location),
      allDay: info.allDay,
    });
  };

  for (const [k, comp] of Object.entries(parsed)) {
    if (!comp || comp.type !== "VEVENT") continue;
    const ev = comp as VEvent;
    if (!ev.start) continue;
    const key = ev.uid || k;
    const info = { summary: ev.summary as Param, location: ev.location as Param, allDay: ev.datetype === "date" };
    const start = new Date(ev.start);
    const end = ev.end ? new Date(ev.end) : undefined;

    if (!ev.rrule) {
      push(info, start, end, key);
      continue;
    }

    const duration = end ? end.getTime() - start.getTime() : 0;
    let dates: Date[] = [];
    try {
      // Look back by the event's duration so multi-day events already in progress are kept.
      dates = ev.rrule.between(new Date(from.getTime() - duration), to, true);
    } catch (e) {
      console.error("RRULE expansion failed for", key, e);
      push(info, start, end, key);
      continue;
    }

    for (const d of dates) {
      const iso = d.toISOString();
      if (ev.exdate && (ev.exdate[iso] || ev.exdate[dayKey(d)])) continue;

      const override = ev.recurrences?.[iso] || ev.recurrences?.[dayKey(d)];
      if (override?.start) {
        push(
          {
            summary: (override.summary ?? ev.summary) as Param,
            location: (override.location ?? ev.location) as Param,
            allDay: (override.datetype ?? ev.datetype) === "date",
          },
          new Date(override.start as Date),
          override.end ? new Date(override.end as Date) : undefined,
          key
        );
      } else {
        push(info, d, duration ? new Date(d.getTime() + duration) : undefined, key);
      }
    }
  }

  return out.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}
