"use client";

import React, { useState } from "react";
import { ImageIcon, Search, X } from "lucide-react";

const EMOJI = [
  "🎮","🍨","🍿","🌙","🥏","🎁","🏆","⭐","🍕","🍦","🍩","🍪","🎬","📚","🎨","🎵",
  "🚲","🛴","⚽","🏀","🏊","🎢","🎡","🎪","🧸","🎲","🧩","🚀","🦖","🦄","🐶","🐱",
  "🏕️","🎣","🛝","🛍️","💵","📱","🎧","🍫","🧁","🥞","🍔","🌮","☕","🎂","🎈","🎉",
];

const SUGGESTIONS = ["ice cream", "movie night", "pizza", "video game", "playground", "swimming", "bike", "party", "toy", "book", "star", "trophy"];

interface Props {
  pin: string;
  /** Currently chosen image URL, if any. */
  imageUrl?: string;
  onPickImage: (url: string) => void;
  /** If provided, an Emoji tab is shown and the chosen emoji is reported here. */
  onPickEmoji?: (emoji: string) => void;
  onClear: () => void;
}

/** Search clip art / photos or pick an emoji instead of pasting a URL. */
export default function ImagePicker({ pin, imageUrl, onPickImage, onPickEmoji, onClear }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"clipart" | "photo" | "emoji">("clipart");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; title: string; url: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const search = async (q: string, kind = tab) => {
    if (!q.trim() || kind === "emoji") return;
    setQuery(q);
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/images?q=${encodeURIComponent(q)}&kind=${kind === "photo" ? "photo" : "clipart"}`, {
        headers: { "x-family-pin": pin },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed.");
      setResults(data.results);
      if (!data.results.length) setError("No pictures found. Try another word.");
    } catch (e) {
      setResults([]);
      setError(e instanceof Error ? e.message : "Search failed.");
    } finally {
      setLoading(false);
    }
  };

  const tabs: ["clipart" | "photo" | "emoji", string][] = [["clipart", "Clip art"], ["photo", "Photos"]];
  if (onPickEmoji) tabs.push(["emoji", "Emoji"]);

  return (
    <div className="rounded-2xl border border-sky-100 bg-sky-50 p-3">
      <div className="flex items-center gap-3">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="h-14 w-14 rounded-xl object-cover" />
        ) : (
          <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-white text-slate-400"><ImageIcon className="h-6 w-6" /></span>
        )}
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex-1 rounded-xl bg-white py-3 text-sm font-bold text-indigo-600 shadow-sm active:scale-95">
          {open ? "Close pictures" : imageUrl ? "Change picture" : "Choose a picture"}
        </button>
        {imageUrl && (
          <button type="button" onClick={onClear} aria-label="Remove picture" className="rounded-full p-2 text-slate-500 active:bg-sky-100">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
            {tabs.map(([id, label]) => (
              <button
                type="button"
                key={id}
                onClick={() => {
                  setTab(id);
                  setResults([]);
                  setError("");
                  if (id !== "emoji" && query) search(query, id);
                }}
                className={`rounded-xl py-2.5 text-sm font-bold ${tab === id ? "bg-indigo-500 text-white" : "bg-white text-slate-600"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "emoji" ? (
            <div className="grid grid-cols-8 gap-1.5">
              {EMOJI.map((e) => (
                <button
                  type="button"
                  key={e}
                  onClick={() => {
                    onPickEmoji?.(e);
                    setOpen(false);
                  }}
                  className="rounded-xl bg-white py-2 text-3xl active:scale-90"
                >
                  {e}
                </button>
              ))}
            </div>
          ) : (
            <>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  search(query);
                }}
                className="flex gap-2"
              >
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search (e.g. dinosaur, pizza)"
                  className="min-w-0 flex-1 rounded-xl border border-sky-100 bg-white px-3.5 py-3 text-slate-800"
                />
                <button type="submit" aria-label="Search" className="rounded-xl bg-indigo-500 px-4 text-white active:scale-95">
                  <Search className="h-5 w-5" />
                </button>
              </form>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button type="button" key={s} onClick={() => search(s)} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 active:bg-sky-100">
                    {s}
                  </button>
                ))}
              </div>
              {loading && <p className="text-sm text-slate-500">Searching…</p>}
              {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
              <div className="grid grid-cols-4 gap-2">
                {results.map((r) => (
                  <button
                    type="button"
                    key={r.id}
                    onClick={() => {
                      onPickImage(r.url);
                      setOpen(false);
                    }}
                    className="aspect-square overflow-hidden rounded-xl bg-white active:scale-95"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.url} alt={r.title} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
