"use client";

import React, { useState } from "react";
import { Pencil, Plus, Sparkles, Star, Users, X } from "lucide-react";
import Avatar from "./Avatar";
import RewardTracker from "./RewardTracker";
import { kidColor } from "@/lib/colors";
import { poolTotal, remainingCost } from "@/lib/rules";
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
  parentMode: boolean;
  onEditReward: (r: RewardItem) => void;
}

const BANNERS = [
  "from-amber-300 to-orange-400",
  "from-sky-300 to-indigo-400",
  "from-emerald-300 to-teal-400",
  "from-pink-300 to-rose-400",
  "from-purple-300 to-violet-400",
];

export default function RewardsTab({ kids, rewards, contributions, onDeposit, onWithdraw, onAddReward, redemptions, onFulfill, parentMode, onEditReward }: Props) {
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [view, setView] = useState<"store" | "tracker">("store");
  const pending = redemptions.filter((r) => !r.fulfilled).length;

  return (
    <div className="scroll-y h-full rounded-3xl border border-sky-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800">Rewards</h2>
          <p className="text-sm text-slate-500">Pick a name, then add stars. You can save up even if you can&apos;t afford it yet!</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-2xl bg-sky-50 p-1">
            {(["store", "tracker"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={`rounded-xl px-5 py-2.5 text-sm font-bold ${view === v ? "bg-indigo-500 text-white shadow" : "text-slate-600"}`}>
                {v === "store" ? "Rewards" : `Tracker${pending ? ` (${pending})` : ""}`}
              </button>
            ))}
          </div>
          <button onClick={onAddReward} className="flex items-center gap-1.5 rounded-2xl bg-amber-400 px-5 py-3 text-sm font-bold text-slate-900 shadow active:scale-95">
            <Plus className="h-4 w-4" /> New Reward
          </button>
        </div>
      </div>

      {view === "tracker" ? (
        <RewardTracker kids={kids} rewards={rewards} contributions={contributions} redemptions={redemptions} onFulfill={onFulfill} />
      ) : (
        <div className="grid grid-cols-2 gap-5">
          {rewards.map((r, idx) => {
            const solo = !r.combinable;
            const jar = contributions.filter((c) => c.rewardId === r.id);
            const selKid = kids.find((k) => k.id === selected[r.id]);
            const remaining = remainingCost(r, contributions, selKid?.id);
            const pooled = poolTotal(r.id, contributions);
            const maxAdd = selKid ? Math.min(selKid.stars, remaining) : 0;
            const savers = kids.filter((k) => jar.some((c) => c.kidId === k.id));

            return (
              <article key={r.id} className="overflow-hidden rounded-3xl border border-sky-100 bg-white shadow-md">
                <div className={`relative flex items-center gap-4 bg-gradient-to-r ${BANNERS[idx % BANNERS.length]} p-4`}>
                  {parentMode && (
                    <button onClick={() => onEditReward(r)} aria-label={`Edit ${r.title}`} className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-indigo-600 shadow active:scale-90">
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                  {r.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.imageUrl} alt="" referrerPolicy="no-referrer" className="h-24 w-24 shrink-0 rounded-2xl border-4 border-white object-cover shadow-lg" />
                  ) : (
                    <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border-4 border-white bg-white/80 text-6xl shadow-lg">{r.icon}</span>
                  )}
                  <div className={`min-w-0 flex-1 ${parentMode ? "pr-11" : ""}`}>
                    <h3 className="text-xl font-extrabold leading-tight text-white drop-shadow">{r.title}</h3>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-base font-extrabold text-amber-600">
                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> {r.cost}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-slate-600">
                        {solo ? <><Sparkles className="h-3.5 w-3.5 text-indigo-500" /> Everyone earns their own</> : <><Users className="h-3.5 w-3.5 text-sky-500" /> Team up!</>}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 p-4">
                  {/* Progress: one jar for shared rewards, one bar per kid for solo ones */}
                  {solo ? (
                    savers.length === 0 ? (
                      <p className="text-sm font-medium text-slate-500">Nobody has started saving yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {savers.map((k) => {
                          const got = poolTotal(r.id, contributions, k.id);
                          return (
                            <div key={k.id} className="flex items-center gap-2.5">
                              <Avatar kid={k} size={30} />
                              <div className="h-4 flex-1 overflow-hidden rounded-full bg-sky-100">
                                <div className={`${kidColor(k.color).solid} h-full rounded-full transition-all duration-500`} style={{ width: `${Math.min(100, (got / r.cost) * 100)}%` }} />
                              </div>
                              <span className="w-14 text-right text-sm font-bold text-slate-600">{got}/{r.cost}</span>
                            </div>
                          );
                        })}
                      </div>
                    )
                  ) : (
                    <div>
                      <div className="flex h-5 overflow-hidden rounded-full bg-sky-100">
                        {jar.map((c) => {
                          const k = kids.find((x) => x.id === c.kidId);
                          return <div key={c.id} className={`${kidColor(k?.color || "blue").solid} h-full transition-all duration-500`} style={{ width: `${(c.amount / r.cost) * 100}%` }} />;
                        })}
                      </div>
                      <div className="mt-1.5 flex justify-between text-sm font-semibold text-slate-500">
                        <span>{pooled > 0 ? `${pooled} saved` : "Nothing saved yet"}</span>
                        <span className="font-extrabold text-amber-600">{Math.max(0, r.cost - pooled)} to go</span>
                      </div>
                    </div>
                  )}

                  {jar.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {jar.map((c) => {
                        const k = kids.find((x) => x.id === c.kidId);
                        const st = kidColor(k?.color || "blue");
                        return (
                          <span key={c.id} className={`inline-flex items-center gap-1.5 rounded-full border ${st.border} ${st.bg} py-1 pl-3 pr-1 text-sm font-bold ${st.text}`}>
                            {k?.name || "?"} {c.amount}★
                            <button onClick={() => onWithdraw(c)} aria-label={`Take back ${c.amount} stars`} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/80 active:bg-white">
                              <X className="h-4 w-4" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Who's adding? */}
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Who&apos;s adding stars?</p>
                    <div className="grid grid-cols-2 gap-2.5">
                      {kids.map((k) => {
                        const st = kidColor(k.color);
                        const empty = k.stars < 1;
                        const done = solo && remainingCost(r, contributions, k.id) === 0;
                        const isSel = selKid?.id === k.id;
                        return (
                          <button
                            key={k.id}
                            disabled={empty || done}
                            onClick={() => setSelected((s) => ({ ...s, [r.id]: isSel ? "" : k.id }))}
                            className={`flex min-h-[4.25rem] items-center gap-3 rounded-2xl border-2 px-3 py-2 text-left transition active:scale-95 disabled:opacity-40 ${
                              isSel ? `${st.solid} border-transparent text-white shadow-lg` : `${st.border} ${st.bg} ${st.text}`
                            }`}
                          >
                            <Avatar kid={k} size={44} />
                            <span className="min-w-0">
                              <span className="block truncate text-base font-extrabold">{k.name}</span>
                              <span className="flex items-center gap-1 text-sm font-bold"><Star className="h-4 w-4 fill-amber-400 text-amber-400" />{k.stars}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {selKid && (
                    <div className="grid grid-cols-4 gap-2.5">
                      {[1, 5, 10].map((n) => (
                        <button
                          key={n}
                          disabled={n > maxAdd}
                          onClick={() => onDeposit(selKid, r, n)}
                          className="min-h-[4rem] rounded-2xl bg-gradient-to-b from-sky-400 to-indigo-500 text-2xl font-extrabold text-white shadow-md transition active:scale-90 disabled:opacity-30 disabled:shadow-none"
                        >
                          +{n}
                        </button>
                      ))}
                      <button
                        disabled={maxAdd < 1}
                        onClick={() => onDeposit(selKid, r, maxAdd)}
                        className="min-h-[4rem] rounded-2xl bg-gradient-to-b from-amber-300 to-orange-500 text-lg font-extrabold leading-tight text-white shadow-md transition active:scale-90 disabled:opacity-30 disabled:shadow-none"
                      >
                        {selKid.stars >= remaining ? "Get it! 🎉" : `All ${maxAdd}`}
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
