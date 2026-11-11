"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import type { SleepSettings } from "@/lib/types";

export default function SettingsModal({ value, onSave, onClose }: { value: SleepSettings; onSave: (s: SleepSettings) => void; onClose: () => void }) {
  const [s, setS] = useState(value);
  const field = "w-full rounded-xl border border-sky-100 bg-sky-50 px-3.5 py-3 text-slate-800";
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(s);
        }}
        className="w-[26rem] max-w-full space-y-4 rounded-3xl border border-sky-100 bg-white shadow-sm p-6"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800">Sleep &amp; Wake Schedule</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 active:bg-sky-100">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>
        <p className="text-sm text-slate-500">The screen goes completely black overnight and wakes itself in the morning. Tap it to wake it for 5 minutes. This setting is saved on this device.</p>

        <button
          type="button"
          onClick={() => setS({ ...s, enabled: !s.enabled })}
          className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-bold ${s.enabled ? "bg-indigo-500 text-white" : "bg-sky-50 text-slate-600"}`}
        >
          Sleep schedule
          <span>{s.enabled ? "On" : "Off"}</span>
        </button>

        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Sleep at
            <input type="time" value={s.sleepAt} onChange={(e) => setS({ ...s, sleepAt: e.target.value })} className={`${field} mt-1.5`} />
          </label>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Wake at
            <input type="time" value={s.wakeAt} onChange={(e) => setS({ ...s, wakeAt: e.target.value })} className={`${field} mt-1.5`} />
          </label>
        </div>

        <button type="submit" className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-bold text-slate-950 active:scale-95">Save</button>
      </form>
    </div>
  );
}
