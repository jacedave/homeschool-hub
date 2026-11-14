"use client";

import React, { useState } from "react";
import { Trash2, X } from "lucide-react";
import Avatar from "./Avatar";
import ImagePicker from "./ImagePicker";
import { kidColor } from "@/lib/colors";
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

/** Two-step delete button so a stray tap can't remove something. */
function DeleteButton({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  const [asking, setAsking] = useState(false);
  if (!asking)
    return (
      <button type="button" onClick={() => setAsking(true)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-50 py-3 text-sm font-bold text-rose-600 active:scale-95">
        <Trash2 className="h-4 w-4" /> {label}
      </button>
    );
  return (
    <div className="rounded-xl bg-rose-50 p-3">
      <p className="text-sm text-rose-700">Are you sure? This can&apos;t be undone.</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setAsking(false)} className="rounded-xl bg-white py-2.5 text-sm font-bold text-slate-600">Keep it</button>
        <button type="button" onClick={onConfirm} className="rounded-xl bg-rose-500 py-2.5 text-sm font-bold text-white">Delete</button>
      </div>
    </div>
  );
}

/**
 * Whole-number field. It is a text box that only accepts digits, so backspace can empty it
 * (a real number input turns an empty box into 0). Leave it empty and the form asks for a value.
 */
function NumberField({ label, value, onChange, placeholder, invalid, tone }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; invalid: boolean; tone: string }) {
  return (
    <label className={`flex items-center justify-between rounded-xl border px-3.5 py-2 ${invalid ? "border-rose-400 bg-rose-50" : "border-sky-100 bg-sky-50"}`}>
      <span className="text-sm text-slate-600">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
        placeholder={placeholder}
        className={`w-24 bg-transparent text-right text-lg font-bold placeholder:font-normal placeholder:text-slate-300 ${tone}`}
      />
    </label>
  );
}

export type NewTask = Omit<TaskItem, "id" | "completed" | "dueToday" | "lastCompletedDate">;

/** Add a task, or edit one when `task` is given. */
export function TaskModal({ kids, pin, task, onSave, onDelete, onClose }: { kids: Kid[]; pin: string; task?: TaskItem; onSave: (t: NewTask, imageChanged: boolean, assigneeIds: string[]) => void; onDelete?: () => void; onClose: () => void }) {
  const [title, setTitle] = useState(task?.title ?? "");
  // When adding, one or more children can be picked and the task is copied to each.
  const [selected, setSelected] = useState<string[]>(kids[0] ? [kids[0].id] : []);
  const [noKid, setNoKid] = useState(false);
  const [assignee, setAssignee] = useState(task?.assigneeId ?? kids[0]?.id ?? "");
  const [category, setCategory] = useState<TaskCategory>(task?.category ?? "school");
  const [points, setPoints] = useState(task ? String(task.points) : "");
  const [pointsMissing, setPointsMissing] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>(task?.repeat ?? "none");
  const [days, setDays] = useState<string[]>(task?.repeatDays ?? []);
  const [imageUrl, setImageUrl] = useState(task?.imageUrl ?? "");
  const [icon, setIcon] = useState(task?.icon ?? "");
  const [imageChanged, setImageChanged] = useState(false);

  const repeatOptions: [RepeatMode, string][] = [
    ["none", "Once"],
    ["daily", "Every day"],
    ["weekdays", "Weekdays"],
    ["custom", "Pick days"],
  ];

  return (
    <Shell title={task ? "Edit Task" : "Add Schoolwork or Chore"} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          const stars = parseInt(points, 10);
          if (!task && selected.length === 0) return setNoKid(true);
          if (!stars || stars < 1) return setPointsMissing(true);
          onSave({
            title: title.trim(),
            assigneeId: task ? assignee : selected[0],
            assignee: kids.find((k) => k.id === (task ? assignee : selected[0]))?.name ?? "",
            category,
            points: stars,
            repeat,
            repeatDays: repeat === "custom" ? days : [],
            imageUrl: imageUrl || undefined,
            icon: !imageUrl && icon ? icon : undefined,
          }, imageChanged, task ? [assignee] : selected);
        }}
      >
        <input required autoFocus placeholder="Task title (e.g., Practice Piano)" value={title} onChange={(e) => setTitle(e.target.value)} className={input} />
        {task ? (
          <div className="grid grid-cols-2 gap-2">
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={input}>
              {kids.map((k) => (
                <option key={k.id} value={k.id}>{k.name}</option>
              ))}
            </select>
            <select value={category} onChange={(e) => setCategory(e.target.value as TaskCategory)} className={input}>
              <option value="school">Schoolwork</option>
              <option value="chore">Chore</option>
            </select>
          </div>
        ) : (
          <>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Who is it for?</p>
              <div className="flex flex-wrap gap-2">
                {kids.map((k) => {
                  const on = selected.includes(k.id);
                  const st = kidColor(k.color);
                  return (
                    <button
                      type="button"
                      key={k.id}
                      onClick={() => {
                        setNoKid(false);
                        setSelected((cur) => (on ? cur.filter((id) => id !== k.id) : [...cur, k.id]));
                      }}
                      className={`flex items-center gap-2 rounded-full border-2 py-1.5 pl-1.5 pr-4 text-sm font-bold active:scale-95 ${on ? `${st.solid} border-transparent text-white` : `${st.border} ${st.bg} ${st.text}`}`}
                    >
                      <Avatar kid={k} size={30} />
                      {k.name}
                    </button>
                  );
                })}
                {kids.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setNoKid(false);
                      setSelected(selected.length === kids.length ? [] : kids.map((k) => k.id));
                    }}
                    className="rounded-full bg-sky-50 px-4 py-2.5 text-sm font-bold text-indigo-600 active:scale-95"
                  >
                    {selected.length === kids.length ? "Clear" : "Everyone"}
                  </button>
                )}
              </div>
              {noKid && <p className="mt-1.5 text-sm font-semibold text-rose-600">Choose at least one child.</p>}
              {selected.length > 1 && <p className="mt-1.5 text-xs text-slate-500">A copy of this task will be added for each of them.</p>}
            </div>
            <select value={category} onChange={(e) => setCategory(e.target.value as TaskCategory)} className={input}>
              <option value="school">Schoolwork</option>
              <option value="chore">Chore</option>
            </select>
          </>
        )}

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

        <NumberField label="Star points" value={points} onChange={(v) => { setPoints(v); setPointsMissing(false); }} placeholder="How many?" invalid={pointsMissing} tone="text-amber-600" />
        {pointsMissing && <p className="-mt-2 text-sm font-semibold text-rose-600">Enter how many stars this is worth.</p>}

        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Picture or emoji (optional)</p>
          <ImagePicker pin={pin} imageUrl={imageUrl} emoji={icon} onPickImage={(u) => { setImageUrl(u); setIcon(""); setImageChanged(true); }} onPickEmoji={(e) => { setIcon(e); setImageUrl(""); setImageChanged(true); }} onClear={() => { setImageUrl(""); setIcon(""); setImageChanged(true); }} />
        </div>

        <button type="submit" className="w-full rounded-xl bg-indigo-500 py-3 text-sm font-bold text-white active:scale-95">{task ? "Save changes" : "Save Task"}</button>
        {task && onDelete && <DeleteButton label="Delete task" onConfirm={onDelete} />}
      </form>
    </Shell>
  );
}

export type NewReward = Omit<RewardItem, "id">;

/** Add a reward, or edit one when `reward` is given. */
export function RewardModal({ pin, reward, onSave, onDelete, onClose }: { pin: string; reward?: RewardItem; onSave: (r: NewReward, imageChanged: boolean) => void; onDelete?: () => void; onClose: () => void }) {
  const [title, setTitle] = useState(reward?.title ?? "");
  const [cost, setCost] = useState(reward ? String(reward.cost) : "");
  const [costMissing, setCostMissing] = useState(false);
  const [icon, setIcon] = useState(reward?.icon ?? "🎁");
  const [imageUrl, setImageUrl] = useState(reward?.imageUrl ?? "");
  const [combinable, setCombinable] = useState(reward?.combinable ?? true);
  const [imageChanged, setImageChanged] = useState(false);

  return (
    <Shell title={reward ? "Edit Reward" : "New Reward"} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          const stars = parseInt(cost, 10);
          if (!stars || stars < 1) return setCostMissing(true);
          onSave({ title: title.trim(), cost: stars, icon: icon || "🎁", imageUrl: imageUrl || undefined, combinable }, imageChanged);
        }}
      >
        <input required autoFocus placeholder="Reward (e.g., Trip to the Trampoline Park)" value={title} onChange={(e) => setTitle(e.target.value)} className={input} />
        <NumberField label="Cost (stars)" value={cost} onChange={(v) => { setCost(v); setCostMissing(false); }} placeholder="How many?" invalid={costMissing} tone="text-amber-600" />
        {costMissing && <p className="-mt-2 text-sm font-semibold text-rose-600">Enter how many stars this costs.</p>}
        <ImagePicker
          pin={pin}
          imageUrl={imageUrl}
          emoji={icon}
          onPickImage={(u) => {
            setImageUrl(u);
            setImageChanged(true);
          }}
          onPickEmoji={(e) => {
            setIcon(e);
            setImageUrl("");
            setImageChanged(true);
          }}
          onClear={() => {
            setImageUrl("");
            setIcon("🎁");
            setImageChanged(true);
          }}
        />

        <div className="grid grid-cols-2 gap-2">
          {[
            { v: true, label: "Shared", hint: "Kids pool stars into one jar" },
            { v: false, label: "Solo", hint: "Each kid earns their own" },
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

        <button type="submit" className="w-full rounded-xl bg-amber-400 py-3 text-sm font-bold text-slate-900 active:scale-95">{reward ? "Save changes" : "Save Reward"}</button>
        {reward && onDelete && <DeleteButton label="Delete reward" onConfirm={onDelete} />}
      </form>
    </Shell>
  );
}

/** Connect to the family's live data. After too many wrong tries the app stays in demo mode for a while. */
export function PinModal({ onTry, lockedMinutes, onClose }: { onTry: (pin: string) => Promise<{ status: "ok" | "wrong" | "locked" | "error"; triesLeft?: number }>; lockedMinutes: number; onClose: () => void }) {
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const locked = lockedMinutes > 0;

  return (
    <Shell title="Unlock Family Mode" onClose={onClose} width="w-80">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (locked || busy || !pin) return;
          setBusy(true);
          const result = await onTry(pin);
          setBusy(false);
          setPin("");
          if (result.status === "ok") onClose();
          else if (result.status === "wrong") {
            const left = result.triesLeft;
            setMessage(`That PIN isn't right.${left ? ` ${left} ${left === 1 ? "try" : "tries"} left.` : ""}`);
          } else if (result.status === "error") setMessage("Couldn't reach the server. Check the connection and try again.");
          else setMessage("");
        }}
      >
        <input
          type="password"
          autoFocus
          disabled={locked}
          placeholder="Family PIN"
          value={pin}
          onChange={(e) => {
            setPin(e.target.value);
            setMessage("");
          }}
          className={`${input} text-center text-lg tracking-widest disabled:opacity-50`}
        />
        {locked ? (
          <p className="rounded-xl bg-rose-50 p-3 text-center text-sm font-semibold text-rose-700">
            Too many wrong tries. Demo mode is locked in for about {lockedMinutes} more minute{lockedMinutes === 1 ? "" : "s"}.
          </p>
        ) : (
          message && <p className="text-center text-sm font-semibold text-rose-600">{message}</p>
        )}
        <button type="submit" disabled={locked || busy} className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-bold text-slate-950 active:scale-95 disabled:opacity-40">
          {busy ? "Checking…" : "Connect"}
        </button>
      </form>
    </Shell>
  );
}

/** Asks for the family PIN before a parent-only action. `onSubmit` returns true when the PIN is right. */
export function ParentPinModal({ expectedLength, numeric, onSubmit, onClose }: { expectedLength: number; numeric: boolean; onSubmit: (pin: string) => boolean; onClose: () => void }) {
  const [pin, setPin] = useState("");
  const [wrong, setWrong] = useState(false);

  const attempt = (value: string) => {
    if (onSubmit(value)) return;
    setWrong(true);
    setPin("");
  };

  return (
    <div className="fixed inset-0 z-[58] flex items-center justify-center bg-slate-900/50 p-4">
      <form
        className="w-80 max-w-full space-y-4 rounded-3xl bg-white p-6 shadow-xl"
        onSubmit={(e) => {
          e.preventDefault();
          attempt(pin);
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Parents only</h3>
            <p className="text-sm text-slate-500">Enter the family PIN to continue.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 active:bg-sky-100">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>
        <input
          type="password"
          inputMode={numeric ? "numeric" : "text"}
          autoFocus
          autoComplete="off"
          value={pin}
          onChange={(e) => {
            setWrong(false);
            setPin(e.target.value);
            // PINs with a known length unlock as soon as the last digit is typed.
            if (expectedLength && e.target.value.length >= expectedLength) attempt(e.target.value);
          }}
          placeholder="PIN"
          className={`${input} text-center text-2xl tracking-[0.5em] ${wrong ? "border-rose-400 bg-rose-50" : ""}`}
        />
        {wrong && <p className="text-center text-sm font-semibold text-rose-600">That PIN isn&apos;t right. Try again.</p>}
        <button type="submit" className="w-full rounded-xl bg-indigo-500 py-3 text-sm font-bold text-white active:scale-95">Unlock</button>
      </form>
    </div>
  );
}
