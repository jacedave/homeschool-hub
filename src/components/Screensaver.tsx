"use client";

import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const SLIDE_SECONDS = 12;

/** While a full-screen overlay is up, make the page itself dark so no light strip can show at the screen edge (home-screen app). */
function useDarkBackdrop() {
  useEffect(() => {
    const els = [document.documentElement, document.body];
    const prev = els.map((el) => el.style.backgroundColor);
    els.forEach((el) => (el.style.backgroundColor = "#020617"));
    return () => els.forEach((el, i) => (el.style.backgroundColor = prev[i]));
  }, []);
}

interface PhotoProps {
  photos: string[];
  time: string;
  date: string;
  temp: string;
  onClose: () => void;
}

/** Photo-frame screensaver. Skips photos that fail to load and falls back to a clock. */
export function PhotoFrame({ photos, time, date, temp, onClose }: PhotoProps) {
  useDarkBackdrop();
  // Start on a random photo each time the slideshow opens, then play in order.
  const [index, setIndex] = useState(() => (photos.length ? Math.floor(Math.random() * photos.length) : 0));
  const [failed, setFailed] = useState<Set<string>>(new Set());

  const usable = photos.filter((p) => !failed.has(p));
  const current = usable.length ? usable[index % usable.length] : undefined;

  // Depending on `index` restarts the timer whenever a photo changes, including manual taps.
  useEffect(() => {
    if (usable.length < 2) return;
    const t = setTimeout(() => setIndex((i) => i + 1), SLIDE_SECONDS * 1000);
    return () => clearTimeout(t);
  }, [usable.length, index]);

  const step = (dir: 1 | -1) => setIndex((i) => (i + dir + usable.length * 1000) % Math.max(usable.length, 1));
  const arrow = (dir: 1 | -1) => (
    <button
      aria-label={dir === 1 ? "Next photo" : "Previous photo"}
      onClick={(e) => {
        e.stopPropagation();
        step(dir);
      }}
      onTouchStart={(e) => e.stopPropagation()}
      className={`absolute top-1/2 z-20 -mt-8 flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white active:bg-black/70 ${dir === 1 ? "right-6" : "left-6"}`}
    >
      {dir === 1 ? <ChevronRight className="h-9 w-9" /> : <ChevronLeft className="h-9 w-9" />}
    </button>
  );

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      className="overlay-full fixed z-50 flex cursor-pointer items-end justify-between bg-slate-950 p-10"
    >
      {current && (
        <>
          {/* Blurred copy fills the sides; the sharp photo is fitted on top, never cropped. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={`bg-${current}`} src={current} alt="" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-80 blur-2xl" />
          <div className="absolute inset-0 bg-black/25" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={current}
            src={current}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setFailed((f) => new Set(f).add(current))}
            className="absolute inset-0 h-full w-full object-contain"
          />
        </>
      )}
      {usable.length > 1 && (
        <>
          {arrow(-1)}
          {arrow(1)}
        </>
      )}
      <div className="relative z-10 rounded-2xl border border-white/15 bg-black/55 px-6 py-4">
        <div className="text-5xl font-bold tracking-tight text-white">{time}</div>
        <div className="mt-1 text-lg text-slate-200">
          {date}
          {temp && ` • ${temp}`}
        </div>
      </div>
      <div className="relative z-10 rounded-2xl border border-white/15 bg-black/55 px-5 py-3 text-sm text-slate-300">
        {photos.length && !current ? "Couldn't load photos · " : ""}Tap anywhere to open Family Hub
      </div>
    </div>
  );
}

/** Pure black screen for overnight. Tap to wake for a while. */
export function SleepScreen({ onWake }: { onWake: () => void }) {
  useDarkBackdrop();
  return <div onClick={(e) => { e.stopPropagation(); onWake(); }} className="overlay-full fixed z-[80] cursor-pointer bg-black" aria-label="Sleeping. Tap to wake." />;
}
