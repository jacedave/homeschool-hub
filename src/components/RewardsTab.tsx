"use client";

import React, { useState } from "react";
import { Lock, Plus, Star, Users, X } from "lucide-react";
import { kidColor } from "@/lib/colors";
import { poolTotal, remainingCost } from "@/lib/rules";
import RewardTracker from "./RewardTracker";
import type { Contribution, Kid, Redemption, RewardItem } from "@/lib/types";

interface Props {
  kids: Kid[];
  rewards: RewardItem[];
  contributions: Contribution[];
  onDeposit: (kid: Kid, reward: RewardItem, amount: number) => void;
  onWithdraw: (c: Contribution) => void;
  onAddReward: () => void;
  redemptions: Redemption[];
  onFulfill: (r: Redemption) => void;
}

export default function RewardsTab({ kids, rewards, contributions, onDeposit, onWithdraw, onAddReward, redemptions, onFulfill }: Props) {
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [view, setView] = useState<"store" | "tracker">("store");
  const pending = redemptions.filter((r) => !r.fulfilled).length;

  return (
    <div className="scroll-y h-full rounded-3xl border border-sky-100 bg-white shadow-sm p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Rewards</h2>
          <p className="text-sm text-slate-500">
            Add stars to a reward even if you can&apos;t afford it yet. Shared rewards let everyone chip in!
          </p>
        </div>
        <div className="flex items-center gap-2">
        <div className="flex rounded-xl bg-sky-50 p-1">
          {(["store", "tracker"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-lg px-4 py-2 text-sm font-bold ${view === v ? "bg-indigo-500 text-white" : "text-slate-600"}`}
            >
              {v === "store" ? "Rewards" : `Tracker${pending ? ` (${pending})` : ""}`}
            </button>
          ))}
        </div>
        <button
          onClick={onAddReward}
          className="flex items-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 active:scale-95"
        >
          <Plus className="h-4 w-4" /> New Reward
        </button>
        </div>
      </div>

      {view === "tracker" ? (
        <RewardTracker kids={kids} rewards={rewards} contributions={contributions} redemptions={redemptions} onFulfill={onFulfill} />
      ) : (

      <div className="grid grid-cols-3 gap-4">
        {rewards.map((r) => {
          const jar = contributions.filter((c) => c.rewardId === r.id);
          const pooled = poolTotal(r.id, contributions);
          const remaining = remainingCost(r, contributions);
          const pct = Math.min(100, Math.round((pooled / r.cost) * 100));
          const owner = !r.combinable && jar.length ? jar[0].kidId : null;
          const selKid = kids.find((k) => k.id === selected[r.id]);
          const maxAdd = selKid ? Math.min(selKid.stars, remaining) : 0;

          return (
            <article key={r.id} className="flex flex-col rounded-3xl border border-sky-100 bg-sky-50 p-4">
              <div className="flex items-start gap-3">
                {r.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.imageUrl} alt="" className="h-16 w-16 shrink-0 rounded-2xl object-cover" />
                ) : (
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm text-4xl">{r.icon}</span>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-bold leading-snug text-slate-800">{r.title}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold">
                    <span className="inline-flex items-center gap-1 text-amber-600">
                      <Star className="h-3.5 w-3.5 fill-amber-300" /> {r.cost}
                    </span>
                    {r.combinable ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-sky-600">
                        <Users className="h-3 w-3" /> Shared
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-slate-600">
                        <Lock className="h-3 w-3" /> Solo
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Jar progress, segmented by kid colour */}
              <div className="mt-4">
                <div className="flex h-3 overflow-hidden rounded-full bg-sky-100">
                  {jar.map((c) => {
                    const k = kids.find((x) => x.id === c.kidId);
                    return (
                      <div
                        key={c.id}
                        className={`${kidColor(k?.color || "blue").solid} h-full`}
                        style={{ width: `${(c.amount / r.cost) * 100}%` }}
                      />
                    );
                  })}
                </div>
                <div className="mt-1.5 flex justify-between text-xs font-medium text-slate-500">
                  <span>{pooled > 0 ? `${pooled} saved (${pct}%)` : "Nothing saved yet"}</span>
                  <span className="font-bold text-amber-600">{remaining} to go</span>
                </div>
                {jar.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {jar.map((c) => {
                      const k = kids.find((x) => x.id === c.kidId);
                      const st = kidColor(k?.color || "blue");
                      return (
                        <span key={c.id} className={`inline-flex items-center gap-1 rounded-full border ${st.border} ${st.bg} py-0.5 pl-2.5 pr-1 text-xs font-semibold ${st.text}`}>
                          {k?.name || "?"} {c.amount}★
                          <button
                            onClick={() => onWithdraw(c)}
                            aria-label={`Take back ${c.amount} stars`}
                            className="flex h-5 w-5 items-center justify-center rounded-full bg-black/25 active:bg-black/50"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Kid picker + amounts */}
              <div className="mt-4 flex flex-wrap gap-1.5">
                {kids.map((k) => {
                  const st = kidColor(k.color);
                  const locked = owner !== null && owner !== k.id;
                  const empty = k.stars < 1;
                  const isSel = selKid?.id === k.id;
                  return (
                    <button
                      key={k.id}
                      disabled={locked || empty}
                      onClick={() => setSelected((s) => ({ ...s, [r.id]: isSel ? "" : k.id }))}
                      className={`rounded-full border px-3 py-1.5 text-xs font-bold transition active:scale-95 disabled:opacity-35 ${
                        isSel ? `${st.solid} border-transparent text-white` : `${st.border} ${st.bg} ${st.text}`
                      }`}
                    >
                      {k.name} · {k.stars}★
                    </button>
                  );
                })}
              </div>

              {selKid && (
                <div className="mt-3 grid grid-cols-4 gap-1.5">
                  {[1, 5, 10].map((n) => (
                    <button
                      key={n}
                      disabled={n > maxAdd}
                      onClick={() => onDeposit(selKid, r, n)}
                      className="rounded-xl bg-sky-100 py-2 text-sm font-bold text-slate-800 active:scale-95 disabled:opacity-30"
                    >
                      +{n}
                    </button>
                  ))}
                  <button
                    disabled={maxAdd < 1}
                    onClick={() => onDeposit(selKid, r, maxAdd)}
                    className="rounded-xl bg-amber-400 py-2 text-sm font-extrabold text-slate-900 active:scale-95 disabled:opacity-30"
                  >
                    {selKid.stars >= remaining ? "Get it!" : `All ${maxAdd}`}
                  </button>
                </div>
              )}
              {owner !== null && (
                <p className="mt-2 text-[11px] text-slate-500">
                  Solo reward: only {kids.find((k) => k.id === owner)?.name || "one kid"} can fund it right now.
                </p>
              )}
            </article>
          );
        })}
      </div>
      )}
    </div>
  );
}
