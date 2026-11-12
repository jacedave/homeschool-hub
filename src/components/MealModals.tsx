"use client";

import React, { useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { addDays, addMonths, label, mealFor, monthDays, monthStart } from "@/lib/dates";
import type { MealItem } from "@/lib/types";

export interface MealFields {
  breakfast: string;
  lunch: string;
  dinner: string;
}
export interface MealDay extends MealFields {
  date: string;
}

const EMPTY: MealFields = { breakfast: "", lunch: "", dinner: "" };
const pick = (m?: MealItem): MealFields => ({ breakfast: m?.breakfast || "", lunch: m?.lunch || "", dinner: m?.dinner || "" });
const field = "w-full rounded-xl border border-sky-100 bg-sky-50 px-3.5 py-3 text-slate-800";

function Shell({ title, onClose, wide, children }: { title: string; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
      <div className={`scroll-y max-h-full ${wide ? "w-[58rem]" : "w-[28rem]"} max-w-full space-y-4 rounded-3xl border border-sky-100 bg-white p-6 shadow-sm`}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 active:bg-sky-100"><X className="h-5 w-5 text-slate-500" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Edit one day's meals. Starts from the planned meals (including an old weekly default, if that's what shows). */
export function MealEditor({ date, meals, onSave, onClose }: { date: string; meals: MealItem[]; onSave: (d: MealDay) => void; onClose: () => void }) {
  const [f, setF] = useState<MealFields>(() => pick(mealFor(meals, date)));
  const set = (k: keyof MealFields) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Shell title={label(date, { weekday: "long", month: "long", day: "numeric" })} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ date, ...f });
        }}
      >
        {(["breakfast", "lunch", "dinner"] as const).map((k, i) => (
          <label key={k} className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
            {k}
            <input autoFocus={i === 2} value={f[k]} onChange={set(k)} placeholder={k === "dinner" ? "What's for dinner?" : ""} className={`${field} mt-1.5 text-base normal-case tracking-normal`} />
          </label>
        ))}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button type="button" onClick={() => onSave({ date, ...EMPTY })} className="rounded-xl bg-sky-50 py-3 text-sm font-bold text-slate-600 active:scale-95">Clear day</button>
          <button type="submit" className="rounded-xl bg-emerald-500 py-3 text-sm font-bold text-slate-950 active:scale-95">Save</button>
        </div>
      </form>
    </Shell>
  );
}

/** Enter a whole month at once: a grid of every day, plus pasting a list from notes or a spreadsheet. */
export function MealPlanner({ month, meals, onSave, onClose }: { month: string; meals: MealItem[]; onSave: (days: MealDay[]) => void; onClose: () => void }) {
  const [shown, setShown] = useState(monthStart(month));
  const [draft, setDraft] = useState<Record<string, MealFields>>({});
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteMode, setPasteMode] = useState<"dinner" | "all">("dinner");
  const [pasteStart, setPasteStart] = useState(monthStart(month));

  const existing = (date: string) => pick(meals.find((m) => m.date === date));
  const value = (date: string) => draft[date] ?? existing(date);
  const changed = Object.keys(draft).length;

  const setCell = (date: string, k: keyof MealFields, v: string) => setDraft((d) => ({ ...d, [date]: { ...value(date), ...(d[date] ?? {}), [k]: v } }));

  const applyPaste = () => {
    const lines = pasteText.replace(/\r/g, "").split("\n");
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    setDraft((d) => {
      const next = { ...d };
      lines.forEach((line, i) => {
        if (!line.trim()) return; // a blank line skips that day
        const date = addDays(pasteStart, i);
        const base = next[date] ?? existing(date);
        if (pasteMode === "dinner") {
          next[date] = { ...base, dinner: line.trim() };
        } else {
          const parts = (line.includes("\t") ? line.split("\t") : line.split("|")).map((p) => p.trim());
          next[date] = { breakfast: parts[0] || "", lunch: parts[1] || "", dinner: parts[2] || "" };
        }
      });
      return next;
    });
    setPasteOpen(false);
    setPasteText("");
    setShown(monthStart(pasteStart));
  };

  const save = () => {
    const days = Object.entries(draft)
      .filter(([date, f]) => {
        const old = existing(date);
        return f.breakfast !== old.breakfast || f.lunch !== old.lunch || f.dinner !== old.dinner;
      })
      .map(([date, f]) => ({ date, ...f }));
    if (days.length) onSave(days);
    else onClose();
  };

  const navBtn = "rounded-xl bg-sky-50 p-2.5 text-slate-600 active:scale-90";

  return (
    <Shell title="Plan meals" onClose={onClose} wide>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setShown(addMonths(shown, -1))} aria-label="Previous month" className={navBtn}><ChevronLeft className="h-5 w-5" /></button>
          <span className="min-w-[10rem] text-center text-lg font-extrabold text-slate-800">{label(shown, { month: "long", year: "numeric" })}</span>
          <button onClick={() => setShown(addMonths(shown, 1))} aria-label="Next month" className={navBtn}><ChevronRight className="h-5 w-5" /></button>
        </div>
        <button onClick={() => setPasteOpen((o) => !o)} className="rounded-xl bg-sky-50 px-4 py-2.5 text-sm font-bold text-indigo-600 active:scale-95">
          {pasteOpen ? "Hide paste" : "Paste a list"}
        </button>
      </div>

      {pasteOpen && (
        <div className="space-y-2.5 rounded-2xl border border-sky-100 bg-sky-50 p-3">
          <p className="text-sm text-slate-600">One line per day, starting on the date below. Leave a line blank to skip a day.</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Start date
              <input type="date" value={pasteStart} onChange={(e) => e.target.value && setPasteStart(e.target.value)} className={`${field} mt-1 bg-white`} />
            </label>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Each line is
              <select value={pasteMode} onChange={(e) => setPasteMode(e.target.value as "dinner" | "all")} className={`${field} mt-1 bg-white`}>
                <option value="dinner">A dinner</option>
                <option value="all">Breakfast | Lunch | Dinner</option>
              </select>
            </label>
          </div>
          <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={6} placeholder={pasteMode === "dinner" ? "Tacos\nBaked ziti\nSoup & bread" : "Oatmeal | Wraps | Tacos\nEggs | Quesadillas | Ziti"} className={`${field} bg-white`} />
          <p className="text-xs text-slate-500">Pasting from a spreadsheet works too (columns become Breakfast, Lunch, Dinner).</p>
          <button onClick={applyPaste} disabled={!pasteText.trim()} className="w-full rounded-xl bg-indigo-500 py-3 text-sm font-bold text-white active:scale-95 disabled:opacity-40">Fill the days</button>
        </div>
      )}

      <div className="space-y-1.5">
        <div className="grid grid-cols-[5.5rem_1fr_1fr_1fr] gap-2 px-1 text-xs font-bold uppercase tracking-wider text-slate-400">
          <span /> <span>Breakfast</span> <span>Lunch</span> <span>Dinner</span>
        </div>
        {monthDays(shown).map((date) => {
          const v = value(date);
          const template = mealFor(meals, date);
          const isEdited = !!draft[date];
          return (
            <div key={date} className="grid grid-cols-[5.5rem_1fr_1fr_1fr] items-center gap-2">
              <span className={`text-sm font-bold ${isEdited ? "text-indigo-600" : "text-slate-600"}`}>{label(date, { weekday: "short", day: "numeric" })}</span>
              {(["breakfast", "lunch", "dinner"] as const).map((k) => (
                <input
                  key={k}
                  value={v[k]}
                  onChange={(e) => setCell(date, k, e.target.value)}
                  placeholder={!meals.some((m) => m.date === date) ? template?.[k] || "" : ""}
                  className="w-full min-w-0 rounded-lg border border-sky-100 bg-sky-50 px-2.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-300"
                />
              ))}
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-0 -mx-1 flex items-center justify-between gap-3 rounded-2xl bg-white/95 p-1 pt-3">
        <span className="text-sm text-slate-500">{changed ? `${changed} day${changed === 1 ? "" : "s"} edited` : "No changes yet"}</span>
        <button onClick={save} className="rounded-xl bg-emerald-500 px-8 py-3 text-sm font-bold text-slate-950 active:scale-95">Save</button>
      </div>
    </Shell>
  );
}
