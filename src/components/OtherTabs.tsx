"use client";

import React from "react";
import { CheckCircle2, Circle } from "lucide-react";
import type { CalendarEvent, MealItem, ShoppingItem, WeatherData } from "@/lib/types";

const panel = "rounded-3xl border border-slate-700/60 bg-slate-800/50 p-5";

export function CalendarTab({ events, weather }: { events: CalendarEvent[]; weather: WeatherData | null }) {
  return (
    <div className="grid h-full grid-cols-3 gap-4">
      <div className={`${panel} scroll-y col-span-2`}>
        <h2 className="mb-3 text-xl font-bold text-white">Upcoming</h2>
        <div className="space-y-2.5">
          {events.length === 0 ? (
            <p className="text-sm text-slate-400">No upcoming events found.</p>
          ) : (
            events.map((ev) => (
              <div key={ev.id} className="flex items-center justify-between rounded-2xl bg-slate-900/70 p-3.5">
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-white">{ev.title}</p>
                  {ev.location && <p className="mt-0.5 truncate text-xs text-slate-400">{ev.location}</p>}
                </div>
                <span className="ml-3 shrink-0 rounded-lg bg-indigo-500/20 px-2.5 py-1 text-xs font-semibold text-indigo-200">
                  {new Date(ev.start).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className={panel}>
        <h2 className="mb-3 text-xl font-bold text-white">Forecast</h2>
        <div className="space-y-3">
          {weather?.daily?.time?.slice(0, 3).map((dayStr, idx) => (
            <div key={dayStr} className="flex items-center justify-between rounded-2xl bg-slate-900/60 p-3.5">
              <span className="text-sm font-medium text-slate-200">
                {idx === 0 ? "Today" : new Date(dayStr + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" })}
              </span>
              <span className="text-sm font-bold text-sky-300">
                {Math.round(weather.daily?.temperature_2m_max[idx] ?? 70)}°{" "}
                <span className="text-slate-400">/ {Math.round(weather.daily?.temperature_2m_min[idx] ?? 50)}°</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MealsTab({ meals, todayName }: { meals: MealItem[]; todayName: string }) {
  return (
    <div className="grid h-full gap-2.5" style={{ gridTemplateColumns: `repeat(${Math.max(meals.length, 1)}, minmax(0, 1fr))` }}>
      {meals.map((m) => {
        const isToday = m.day.toLowerCase() === todayName.toLowerCase();
        return (
          <div
            key={m.id}
            className={`scroll-y rounded-3xl border p-3 ${isToday ? "border-emerald-400/70 bg-emerald-500/10" : "border-slate-700/60 bg-slate-800/50"}`}
          >
            <h3 className={`mb-3 text-sm font-extrabold uppercase tracking-wider ${isToday ? "text-emerald-300" : "text-slate-300"}`}>
              {m.day}
            </h3>
            <div className="space-y-2.5">
              {(
                [
                  ["Breakfast", m.breakfast],
                  ["Lunch", m.lunch],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-slate-900/70 p-2.5">
                  <span className="block text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
                  <p className="mt-0.5 text-xs font-semibold text-white">{value}</p>
                </div>
              ))}
              <div className="rounded-2xl bg-slate-900/70 p-2.5 ring-1 ring-emerald-400/30">
                <span className="block text-[10px] uppercase tracking-wider text-emerald-300">Dinner</span>
                <p className="mt-0.5 text-sm font-bold text-white">{m.dinner}</p>
              </div>
            </div>
          </div>
        );
      })}
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
        <h2 className="mb-3 text-xl font-bold text-white">Grocery List</h2>
        <div className="grid grid-cols-2 gap-2.5">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => onToggle(item)}
              className={`flex items-center gap-3 rounded-2xl p-3.5 text-left active:scale-[0.97] ${
                item.checked ? "bg-slate-900/30 opacity-50" : "bg-slate-900/80"
              }`}
            >
              {item.checked ? (
                <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-400" />
              ) : (
                <Circle className="h-6 w-6 shrink-0 text-slate-400" />
              )}
              <span className={`text-sm font-medium text-white ${item.checked ? "line-through" : ""}`}>{item.item}</span>
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={onAdd} className={`${panel} flex flex-col gap-3`}>
        <h3 className="text-base font-bold text-white">Add to list</h3>
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Eggs, butter, apples…"
          className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-3 text-white"
        />
        <button type="submit" className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-bold text-slate-950 active:scale-95">
          + Add item
        </button>
      </form>
    </div>
  );
}
