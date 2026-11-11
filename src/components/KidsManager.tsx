"use client";

import React, { useRef, useState } from "react";
import { Camera, ChevronDown, ChevronUp, Image as ImageIcon, Plus, Trash2, X } from "lucide-react";
import Avatar from "./Avatar";
import { COLOR_MAP } from "@/lib/colors";
import { fileToAvatar } from "@/lib/photo";
import type { Contribution, Kid } from "@/lib/types";

interface Props {
  kids: Kid[];
  contributions: Contribution[];
  onAdd: (k: { name: string; color: string; photo?: string }) => Promise<void>;
  onPhoto: (kid: Kid, photo: string) => Promise<void>;
  onMove: (kid: Kid, dir: -1 | 1) => Promise<void>;
  onColor: (kid: Kid, color: string) => Promise<void>;
  onRemove: (kid: Kid) => Promise<void>;
  onClose: () => void;
}

const COLORS = Object.keys(COLOR_MAP);

/** Photo buttons: one opens the camera, one opens the photo library. */
function PhotoButtons({ onPhoto, compact }: { onPhoto: (dataUrl: string) => void; compact?: boolean }) {
  const cam = useRef<HTMLInputElement>(null);
  const lib = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState("");

  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      onPhoto(await fileToAvatar(file));
      setErr("");
    } catch (er) {
      setErr(er instanceof Error ? er.message : "Couldn't use that photo.");
    }
  };

  const btn = `flex items-center gap-1.5 rounded-xl bg-sky-50 font-bold text-indigo-600 active:scale-95 ${compact ? "px-3 py-2.5 text-xs" : "px-4 py-3 text-sm"}`;
  return (
    <div>
      <div className="flex gap-2">
        <button type="button" onClick={() => cam.current?.click()} className={btn}><Camera className="h-4 w-4" /> Take photo</button>
        <button type="button" onClick={() => lib.current?.click()} className={btn}><ImageIcon className="h-4 w-4" /> Choose</button>
      </div>
      {err && <p className="mt-1 text-xs font-medium text-rose-600">{err}</p>}
      <input ref={cam} type="file" accept="image/*" capture="user" onChange={handle} className="hidden" />
      <input ref={lib} type="file" accept="image/*" onChange={handle} className="hidden" />
    </div>
  );
}

export default function KidsManager({ kids, contributions, onAdd, onPhoto, onMove, onColor, onRemove, onClose }: Props) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[kids.length % COLORS.length]);
  const [photo, setPhoto] = useState<string | undefined>();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="scroll-y max-h-full w-[34rem] max-w-full space-y-4 rounded-3xl border border-sky-100 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800">Family Members</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 active:bg-sky-100">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <div className="space-y-2">
          {kids.map((k, i) => {
            const saved = contributions.some((c) => c.kidId === k.id);
            return (
              <div key={k.id} className="rounded-2xl bg-sky-50 p-3">
                <div className="flex items-center gap-3">
                  <Avatar kid={k} size={52} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-bold text-slate-800">{k.name}</p>
                    <p className="text-xs text-slate-500">{k.stars}★</p>
                  </div>
                  <button disabled={i === 0 || busy} onClick={() => run(() => onMove(k, -1))} aria-label="Move up" className="rounded-xl bg-white p-2.5 text-slate-600 active:scale-90 disabled:opacity-30"><ChevronUp className="h-5 w-5" /></button>
                  <button disabled={i === kids.length - 1 || busy} onClick={() => run(() => onMove(k, 1))} aria-label="Move down" className="rounded-xl bg-white p-2.5 text-slate-600 active:scale-90 disabled:opacity-30"><ChevronDown className="h-5 w-5" /></button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (saved) setError(`${k.name} has stars saved in a reward jar. Take those back on the Rewards tab first.`);
                      else {
                        setError("");
                        setConfirmId(confirmId === k.id ? null : k.id);
                      }
                    }}
                    aria-label={`Remove ${k.name}`}
                    className="rounded-xl bg-white p-2.5 text-rose-500 active:scale-90"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
                <div className="mt-2.5 flex gap-2 pl-1">
                  {COLORS.map((c) => (
                    <button key={c} type="button" onClick={() => onColor(k, c)} aria-label={`${k.name}: ${c}`} className={`h-8 w-8 rounded-full ${COLOR_MAP[c].solid} ${k.color === c ? "ring-4 ring-indigo-300" : ""}`} />
                  ))}
                </div>
                <div className="mt-2.5 pl-1"><PhotoButtons compact onPhoto={(p) => run(() => onPhoto(k, p))} /></div>
                {confirmId === k.id && (
                  <div className="mt-3 rounded-xl bg-rose-50 p-3">
                    <p className="text-sm text-rose-700">Remove {k.name}? Their stars are deleted, and their tasks will no longer show up.</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button onClick={() => setConfirmId(null)} className="rounded-xl bg-white py-2.5 text-sm font-bold text-slate-600">Keep</button>
                      <button onClick={() => run(async () => { await onRemove(k); setConfirmId(null); })} className="rounded-xl bg-rose-500 py-2.5 text-sm font-bold text-white">Remove</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
        </div>

        <form
          className="space-y-3 rounded-2xl border border-sky-100 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            run(async () => {
              await onAdd({ name: name.trim(), color, photo });
              setName("");
              setPhoto(undefined);
              setColor(COLORS[(kids.length + 1) % COLORS.length]);
            });
          }}
        >
          <p className="text-sm font-bold text-slate-700">Add someone</p>
          <div className="flex items-center gap-3">
            <Avatar kid={{ name: name || "?", color, photo }} size={52} />
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="min-w-0 flex-1 rounded-xl border border-sky-100 bg-sky-50 px-3.5 py-3 text-slate-800" />
          </div>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button type="button" key={c} onClick={() => setColor(c)} aria-label={c} className={`h-9 w-9 rounded-full ${COLOR_MAP[c].solid} ${color === c ? "ring-4 ring-indigo-300" : ""}`} />
            ))}
          </div>
          <PhotoButtons onPhoto={setPhoto} />
          <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-3 text-sm font-bold text-slate-950 active:scale-95 disabled:opacity-50">
            <Plus className="h-4 w-4" /> Add
          </button>
        </form>
      </div>
    </div>
  );
}
