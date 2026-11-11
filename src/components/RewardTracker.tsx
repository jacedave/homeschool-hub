"use client";

import React from "react";
import { CheckCircle2, Gift, PiggyBank } from "lucide-react";
import { kidColor } from "@/lib/colors";
import { poolTotal } from "@/lib/rules";
import type { Contribution, Kid, Redemption, RewardItem } from "@/lib/types";

interface Props {
  kids: Kid[];
  rewards: RewardItem[];
  contributions: Contribution[];
  redemptions: Redemption[];
  onFulfill: (r: Redemption) => void;
}

const fmt = (d: string) => (d ? new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");

/** Parents' view: what's been earned and needs giving out, what's being saved for, and past rewards. */
export default function RewardTracker({ kids, rewards, contributions, redemptions, onFulfill }: Props) {
  const toGive = redemptions.filter((r) => !r.fulfilled);
  const given = redemptions.filter((r) => r.fulfilled);
  const saving = rewards.filter((r) => poolTotal(r.id, contributions) > 0);

  return (
    <div className="grid grid-cols-3 gap-4">
      <section className="rounded-3xl border border-sky-100 bg-sky-50 p-4">
        <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-800">
          <Gift className="h-5 w-5 text-amber-600" /> Ready to give ({toGive.length})
        </h3>
        <div className="space-y-2">
          {toGive.length === 0 && <p className="text-sm text-slate-500">Nothing waiting right now.</p>}
          {toGive.map((r) => (
            <div key={r.id} className="rounded-2xl bg-white shadow-sm p-3">
              <p className="text-sm font-bold text-slate-800">{r.reward}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {r.kids} · {fmt(r.date)}
                {r.details && ` · ${r.details}`}
              </p>
              <button onClick={() => onFulfill(r)} className="mt-2 w-full rounded-xl bg-emerald-500 py-2 text-xs font-bold text-slate-950 active:scale-95">
                Mark as given
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-sky-100 bg-sky-50 p-4">
        <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-800">
          <PiggyBank className="h-5 w-5 text-sky-600" /> Saving up ({saving.length})
        </h3>
        <div className="space-y-2">
          {saving.length === 0 && <p className="text-sm text-slate-500">No one is saving yet.</p>}
          {saving.map((r) => {
            const jar = contributions.filter((c) => c.rewardId === r.id);
            const pooled = poolTotal(r.id, contributions);
            return (
              <div key={r.id} className="rounded-2xl bg-white shadow-sm p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-slate-800">{r.icon} {r.title}</p>
                  <span className="shrink-0 text-xs font-bold text-amber-600">{pooled}/{r.cost}★</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {jar.map((c) => {
                    const k = kids.find((x) => x.id === c.kidId);
                    const st = kidColor(k?.color || "blue");
                    return (
                      <span key={c.id} className={`rounded-full border ${st.border} ${st.bg} px-2.5 py-0.5 text-xs font-semibold ${st.text}`}>
                        {k?.name || "?"} {c.amount}★
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-sky-100 bg-sky-50 p-4">
        <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-800">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" /> History ({given.length})
        </h3>
        <div className="space-y-2">
          {given.length === 0 && <p className="text-sm text-slate-500">Rewards you&apos;ve given out will show here.</p>}
          {given.map((r) => (
            <div key={r.id} className="rounded-2xl bg-white shadow-sm p-3">
              <p className="text-sm font-semibold text-slate-700">{r.reward}</p>
              <p className="mt-0.5 text-xs text-slate-500">{r.kids} · {r.cost}★ · {fmt(r.date)}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
