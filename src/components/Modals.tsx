"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import { DAY_ABBRS, Kid, RepeatMode, RewardItem, TaskCategory, TaskItem } from "@/lib/types";

const input = "w-full rounded-xl border border-sky-100 bg-sky-50 px-3.5 py-3 text-slate-800";

function Shell({ title, onClose, children, width = "w-[28rem]" }: { title: string; onClose: () => void; children: React.ReactNode; width?: string }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
      <div className={`scroll-y max-h-full ${width} max-w-full space-y-4 rounded-3xl border border-sky-100 bg-white shadow-sm p-6`}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 active:bg-sky-100">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export type NewTask = Omit<TaskItem, "id" | "completed" | "dueToday" | "lastCompletedDate">;

export function AddTaskModal({ kids, onSave, onClose }: { kids: Kid[]; onSave: (t: NewTask) => void; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState(kids[0]?.name || "");
  const [category, setCategory] = useState<TaskCategory>("school");
  const [points, setPoints] = useState(1);
  const [repeat, setRepeat] = useState<RepeatMode>("none");
  const [days, setDays] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState("");

  const repeatOptions: [RepeatMode, string][] = [
    ["none", "Once"],
    ["daily", "Every day"],
    ["weekdays", "Weekdays"],
    ["custom", "Pick days"],
  ];

  return (
    <Shell title="Add Schoolwork or Chore" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          onSave({
            title: title.trim(),
            assignee,
            category,
            points: Math.max(1, points),
            repeat,
            repeatDays: repeat === "custom" ? days : [],
            imageUrl: imageUrl.trim() || undefined,
          });
        }}
      >
        <input required autoFocus placeholder="Task title (e.g., Practice Piano)" value={title} onChange={(e) => setTitle(e.target.value)} className={input} />
        <div className="grid grid-cols-2 gap-2">
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={input}>
            {kids.map((k) => (
              <option key={k.id} value={k.name}>{k.name}</option>
            ))}
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value as TaskCategory)} className={input}>
            <option value="school">Schoolwork</option>
            <option value="chore">Chore</option>
          </select>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Repeat</p>
          <div className="grid grid-cols-4 gap-1.5">
            {repeatOptions.map(([value, label]) => (
              <button
                type="button"
                key={value}
                onClick={() => setRepeat(value)}
                className={`rounded-xl py-2.5 text-xs font-bold ${repeat === value ? "bg-indigo-500 text-white" : "bg-sky-50 text-slate-600"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {repeat === "custom" && (
            <div className="mt-2 grid grid-cols-7 gap-1">
              {DAY_ABBRS.map((d) => {
                const on = days.includes(d);
                return (
                  <button
                    type="button"
                    key={d}
                    onClick={() => setDays((cur) => (on ? cur.filter((x) => x !== d) : [...cur, d]))}
                    className={`rounded-lg py-2 text-xs font-bold ${on ? "bg-sky-500 text-white" : "bg-sky-50 text-slate-500"}`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          )}
          {repeat !== "none" && <p className="mt-1.5 text-xs text-slate-500">Resets automatically each day after it&apos;s completed.</p>}
        </div>

        <div className="flex items-center justify-between rounded-xl border border-sky-100 bg-sky-50 px-3.5 py-2">
          <span className="text-sm text-slate-600">Star points</span>
          <input type="number" min={1} max={50} value={points} onChange={(e) => setPoints(Number(e.target.value))} className="w-20 bg-transparent text-right text-lg font-bold text-amber-600" />
        </div>

        <input type="url" placeholder="Celebration picture URL (optional)" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className={input} />

        <button type="submit" className="w-full rounded-xl bg-indigo-500 py-3 text-sm font-bold text-white active:scale-95">Save Task</button>
      </form>
    </Shell>
  );
}

export type NewReward = Omit<RewardItem, "id">;

export function AddRewardModal({ onSave, onClose }: { onSave: (r: NewReward) => void; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [cost, setCost] = useState(20);
  const [icon, setIcon] = useState("🎁");
  const [imageUrl, setImageUrl] = useState("");
  const [combinable, setCombinable] = useState(true);

  return (
    <Shell title="New Reward" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          onSave({ title: title.trim(), cost: Math.max(1, cost), icon: icon || "🎁", imageUrl: imageUrl.trim() || undefined, combinable });
        }}
      >
        <input required autoFocus placeholder="Reward (e.g., Trip to the Trampoline Park)" value={title} onChange={(e) => setTitle(e.target.value)} className={input} />
        <div className="grid grid-cols-[1fr_5rem] gap-2">
          <div className="flex items-center justify-between rounded-xl border border-sky-100 bg-sky-50 px-3.5 py-2">
            <span className="text-sm text-slate-600">Cost (stars)</span>
            <input type="number" min={1} value={cost} onChange={(e) => setCost(Number(e.target.value))} className="w-20 bg-transparent text-right text-lg font-bold text-amber-600" />
          </div>
          <input value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={4} className={`${input} text-center text-2xl`} aria-label="Emoji" />
        </div>
        <input type="url" placeholder="Picture URL for the celebration (optional)" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className={input} />

        <div className="grid grid-cols-2 gap-2">
          {[
            { v: true, label: "Shared", hint: "Kids can pool stars" },
            { v: false, label: "Solo", hint: "One kid at a time" },
          ].map((o) => (
            <button
              type="button"
              key={o.label}
              onClick={() => setCombinable(o.v)}
              className={`rounded-xl p-3 text-left ${combinable === o.v ? "bg-sky-500 text-white" : "bg-sky-50 text-slate-600"}`}
            >
              <span className="block text-sm font-bold">{o.label}</span>
              <span className="block text-xs opacity-80">{o.hint}</span>
            </button>
          ))}
        </div>

        <button type="submit" className="w-full rounded-xl bg-amber-400 py-3 text-sm font-bold text-slate-900 active:scale-95">Save Reward</button>
      </form>
    </Shell>
  );
}

export function PinModal({ onSave, onClose }: { onSave: (pin: string) => void; onClose: () => void }) {
  const [pin, setPin] = useState("");
  return (
    <Shell title="Unlock Family Mode" onClose={onClose} width="w-80">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(pin);
        }}
      >
        <input type="password" autoFocus placeholder="Family PIN" value={pin} onChange={(e) => setPin(e.target.value)} className={`${input} text-center text-lg tracking-widest`} />
        <button type="submit" className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-bold text-slate-950 active:scale-95">Connect</button>
      </form>
    </Shell>
  );
}
