"use client";

import React from "react";
import { CheckCircle2, Circle } from "lucide-react";
import type { CalendarEvent, ShoppingItem, WeatherData } from "@/lib/types";

const panel = "rounded-3xl border border-sky-100 bg-white shadow-sm p-5";

export function CalendarTab({ events, weather }: { events: CalendarEvent[]; weather: WeatherData | null }) {
  return (
    <div className="grid h-full grid-cols-3 gap-4">
      <div className={`${panel} scroll-y col-span-2`}>
        <h2 className="mb-3 text-xl font-bold text-slate-800">Upcoming</h2>
        <div className="space-y-2.5">
          {events.length === 0 ? (
            <p className="text-sm text-slate-500">No upcoming events found.</p>
          ) : (
            events.map((ev) => (
              <div key={ev.id} className="flex items-center justify-between rounded-2xl bg-sky-50 p-3.5">
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-slate-800">{ev.title}</p>
                  {ev.location && <p className="mt-0.5 truncate text-xs text-slate-500">{ev.location}</p>}
                </div>
                <span className="ml-3 shrink-0 rounded-lg bg-indigo-500/20 px-2.5 py-1 text-xs font-semibold text-indigo-600">
                  {new Date(ev.start).toLocaleDateString(
                    "en-US",
                    ev.allDay
                      ? { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }
                      : { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
                  )}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className={panel}>
        <h2 className="mb-3 text-xl font-bold text-slate-800">Forecast</h2>
        <div className="space-y-3">
          {weather?.daily?.time?.slice(0, 3).map((dayStr, idx) => (
            <div key={dayStr} className="flex items-center justify-between rounded-2xl bg-sky-50 p-3.5">
              <span className="text-sm font-medium text-slate-700">
                {idx === 0 ? "Today" : new Date(dayStr + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" })}
              </span>
              <span className="text-sm font-bold text-sky-600">
                {Math.round(weather.daily?.temperature_2m_max[idx] ?? 70)}°{" "}
                <span className="text-slate-500">/ {Math.round(weather.daily?.temperature_2m_min[idx] ?? 50)}°</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface ShoppingProps {
  items: ShoppingItem[];
  newItem: string;
  setNewItem: (v: string) => void;
  onAdd: (e: React.FormEvent) => void;
  onToggle: (item: ShoppingItem) => void;
}

export function ShoppingTab({ items, newItem, setNewItem, onAdd, onToggle }: ShoppingProps) {
  return (
    <div className="grid h-full grid-cols-3 gap-4">
      <div className={`${panel} scroll-y col-span-2`}>
        <h2 className="mb-3 text-xl font-bold text-slate-800">Grocery List</h2>
        <div className="grid grid-cols-2 gap-2.5">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => onToggle(item)}
              className={`flex items-center gap-3 rounded-2xl p-3.5 text-left active:scale-[0.97] ${
                item.checked ? "bg-sky-50 opacity-50" : "bg-sky-50"
              }`}
            >
              {item.checked ? (
                <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-400" />
              ) : (
                <Circle className="h-6 w-6 shrink-0 text-slate-500" />
              )}
              <span className={`text-sm font-medium text-slate-800 ${item.checked ? "line-through" : ""}`}>{item.item}</span>
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={onAdd} className={`${panel} flex flex-col gap-3`}>
        <h3 className="text-base font-bold text-slate-800">Add to list</h3>
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Eggs, butter, apples…"
          className="w-full rounded-xl border border-sky-100 bg-sky-50 px-3.5 py-3 text-slate-800"
        />
        <button type="submit" className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-bold text-slate-950 active:scale-95">
          + Add item
        </button>
      </form>
    </div>
  );
}
