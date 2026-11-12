"use client";

import React, { useEffect, useState } from "react";
import { CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, addMonths, label, mealFor, monthGrid, monthStart } from "@/lib/dates";
import type { MealItem } from "@/lib/types";

type View = "1" | "3" | "7" | "month";
const VIEWS: [View, string][] = [["1", "1 day"], ["3", "3 days"], ["7", "7 days"], ["month", "Month"]];
const STORAGE_KEY = "family_hub_meal_view";

interface Props {
  meals: MealItem[];
  today: string;
  onEditDay: (date: string) => void;
  onPlan: (monthYmd: string) => void;
}

const ROWS = [
  { key: "breakfast", title: "Breakfast", letter: "B" },
  { key: "lunch", title: "Lunch", letter: "L" },
  { key: "dinner", title: "Dinner", letter: "D" },
] as const;

function DayCard({ date, meal, isToday, size, onClick }: { date: string; meal?: MealItem; isToday: boolean; size: "lg" | "md" | "sm"; onClick: () => void }) {
  const text = size === "lg" ? "text-2xl" : size === "md" ? "text-base" : "text-xs";
  const dinnerText = size === "lg" ? "text-3xl" : size === "md" ? "text-lg" : "text-sm";
  return (
    <button
      onClick={onClick}
      className={`scroll-y flex min-h-0 flex-col rounded-3xl border p-3 text-left active:scale-[0.98] ${isToday ? "border-emerald-400 bg-emerald-50" : "border-sky-100 bg-white shadow-sm"}`}
    >
      <div className="mb-2.5">
        <h3 className={`font-extrabold uppercase tracking-wider ${isToday ? "text-emerald-600" : "text-slate-600"} ${size === "lg" ? "text-xl" : "text-sm"}`}>
          {label(date, { weekday: size === "sm" ? "short" : "long" })}
        </h3>
        <p className="text-xs text-slate-500">{label(date, { month: "short", day: "numeric" })}</p>
      </div>
      <div className="space-y-2">
        {ROWS.map((r) => {
          const value = meal?.[r.key];
          const isDinner = r.key === "dinner";
          return (
            <div key={r.key} className={`rounded-2xl p-2.5 ${isDinner ? "bg-white ring-1 ring-emerald-200" : "bg-sky-50"}`}>
              <span className={`block text-[10px] font-semibold uppercase tracking-wider ${isDinner ? "text-emerald-600" : "text-slate-400"}`}>{r.title}</span>
              <p className={`mt-0.5 font-semibold ${isDinner ? dinnerText : text} ${value ? "text-slate-800" : "text-slate-300"}`}>{value || "+ add"}</p>
            </div>
          );
        })}
      </div>
    </button>
  );
}

export default function MealsTab({ meals, today, onEditDay, onPlan }: Props) {
  const [view, setView] = useState<View>("7");
  const [anchorState, setAnchor] = useState("");
  const anchor = anchorState || today;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as View | null;
      if (saved && VIEWS.some(([v]) => v === saved)) setView(saved);
    } catch {
      // storage unavailable
    }
  }, []);

  const chooseView = (v: View) => {
    setView(v);
    if (v === "month") setAnchor((a) => monthStart(a || today));
    try {
      localStorage.setItem(STORAGE_KEY, v);
    } catch {
      // ignore
    }
  };

  if (!anchor) return null;
  const span = view === "month" ? 0 : Number(view);
  const step = (dir: 1 | -1) => setAnchor(view === "month" ? addMonths(anchor, dir) : addDays(anchor, dir * span));

  const days = span ? Array.from({ length: span }, (_, i) => addDays(anchor, i)) : [];
  const title =
    view === "month"
      ? label(anchor, { month: "long", year: "numeric" })
      : span === 1
        ? label(anchor, { weekday: "long", month: "long", day: "numeric" })
        : `${label(days[0], { month: "short", day: "numeric" })} – ${label(days[days.length - 1], { month: "short", day: "numeric" })}`;

  const btn = "flex items-center justify-center rounded-2xl bg-white px-3.5 py-2.5 text-sm font-bold text-slate-700 shadow-sm active:scale-95";

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-2xl bg-white p-1 shadow-sm">
          {VIEWS.map(([v, text]) => (
            <button key={v} onClick={() => chooseView(v)} className={`rounded-xl px-4 py-2.5 text-sm font-bold ${view === v ? "bg-indigo-500 text-white" : "text-slate-600"}`}>
              {text}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => step(-1)} aria-label="Previous" className={btn}><ChevronLeft className="h-5 w-5" /></button>
          <span className="min-w-[11rem] text-center text-lg font-extrabold text-slate-800">{title}</span>
          <button onClick={() => step(1)} aria-label="Next" className={btn}><ChevronRight className="h-5 w-5" /></button>
          <button onClick={() => setAnchor(view === "month" ? monthStart(today) : today)} className={btn}>Today</button>
        </div>
        <button onClick={() => onPlan(monthStart(anchor))} className="flex items-center gap-1.5 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950 shadow active:scale-95">
          <CalendarPlus className="h-4 w-4" /> Plan month
        </button>
      </div>

      {view === "month" ? (
        <div className="flex min-h-0 flex-1 flex-col gap-1.5">
          <div className="grid shrink-0 grid-cols-7 gap-1.5">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="text-center text-xs font-bold uppercase tracking-wider text-slate-500">{d}</div>
            ))}
          </div>
          <div className="grid min-h-0 flex-1 gap-1.5" style={{ gridTemplateRows: `repeat(${monthGrid(anchor).length}, minmax(0, 1fr))` }}>
            {monthGrid(anchor).map((week, wi) => (
              <div key={wi} className="grid min-h-0 grid-cols-7 gap-1.5">
                {week.map((date) => {
                  const inMonth = date.slice(0, 7) === anchor.slice(0, 7);
                  const meal = mealFor(meals, date);
                  const isToday = date === today;
                  return (
                    <button
                      key={date}
                      onClick={() => onEditDay(date)}
                      className={`flex min-h-0 flex-col overflow-hidden rounded-xl border p-1.5 text-left active:scale-95 ${
                        isToday ? "border-emerald-400 bg-emerald-50" : inMonth ? "border-sky-100 bg-white" : "border-transparent bg-white/40 opacity-60"
                      }`}
                    >
                      <span className={`text-xs font-extrabold ${isToday ? "text-emerald-600" : "text-slate-500"}`}>{Number(date.slice(8))}</span>
                      {ROWS.map((r) => {
                        const v = meal?.[r.key];
                        return v ? (
                          <span key={r.key} className={`truncate text-[11px] leading-tight ${r.key === "dinner" ? "font-bold text-slate-800" : "text-slate-500"}`}>
                            {r.letter}: {v}
                          </span>
                        ) : null;
                      })}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-3" style={{ gridTemplateColumns: `repeat(${span}, minmax(0, 1fr))` }}>
          {days.map((date) => (
            <DayCard key={date} date={date} meal={mealFor(meals, date)} isToday={date === today} size={span === 1 ? "lg" : span === 3 ? "md" : "sm"} onClick={() => onEditDay(date)} />
          ))}
        </div>
      )}
    </div>
  );
}
