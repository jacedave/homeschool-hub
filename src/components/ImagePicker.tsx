"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ImageIcon, Search, X } from "lucide-react";

const EMOJI = [
  "🎮","🍨","🍿","🌙","🥏","🎁","🏆","⭐","🍕","🍦","🍩","🍪","🎬","📚","🎨","🎵",
  "🚲","🛴","⚽","🏀","🏊","🎢","🎡","🎪","🧸","🎲","🧩","🚀","🦖","🦄","🐶","🐱",
  "🏕️","🎣","🛝","🛍️","💵","📱","🎧","🍫","🧁","🥞","🍔","🌮","☕","🎂","🎈","🎉",
];

interface EmojiData {
  groups: string[];
  emoji: [string, string, number][];
}

/** Kid-friendly words that don't appear in the official emoji names. */
const SYNONYMS: Record<string, string[]> = {
  movie: ["clapper", "film", "popcorn"], tv: ["television"], game: ["video game", "joystick", "game die"], bike: ["bicycle"],
  swim: ["swimmer", "swimming"], dog: ["dog face", "puppy"], cat: ["cat face", "kitten"], clean: ["broom", "soap", "sponge", "bucket"],
  dishes: ["fork", "plate", "cooking"], laundry: ["socks", "shirt", "jeans"], trash: ["wastebasket", "recycling"], homework: ["pencil", "memo", "books"],
  read: ["book", "books"], teeth: ["tooth", "toothbrush"], bed: ["bed", "sleeping"], dress: ["shirt", "jeans", "dress"], feed: ["bone", "fish", "chicken"],
  math: ["abacus", "heavy plus", "input numbers"], music: ["musical", "guitar", "piano", "saxophone", "violin"], art: ["artist palette", "paintbrush"],
  science: ["microscope", "test tube", "telescope", "dna"], money: ["money", "dollar", "coin"], sleep: ["zzz", "sleeping", "crescent"], bath: ["bathtub", "shower"],
};

const SUGGESTIONS = ["ice cream", "movie night", "pizza", "video game", "playground", "swimming", "bike", "party", "toy", "book", "star", "trophy"];

interface Props {
  pin: string;
  /** Currently chosen picture URL, if any. */
  imageUrl?: string;
  /** Currently chosen emoji, if any (shown when there is no picture). */
  emoji?: string;
  onPickImage: (url: string) => void;
  onPickEmoji: (emoji: string) => void;
  onClear: () => void;
}

/** Search clip art or photos (Pixabay), or pick an emoji instead. */
export default function ImagePicker({ pin, imageUrl, emoji, onPickImage, onPickEmoji, onClear }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"clipart" | "photo" | "emoji">("clipart");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; title: string; thumb: string; url: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [emojiQuery, setEmojiQuery] = useState("");
  const [emojiGroup, setEmojiGroup] = useState<number | null>(null);
  const [emojiData, setEmojiData] = useState<EmojiData | null>(null);

  // The full emoji list (about 1,500) is only downloaded when the Emoji tab is first opened.
  useEffect(() => {
    if (tab === "emoji" && open && !emojiData) {
      import("@/lib/emojiData.json").then((m) => setEmojiData(m.default as unknown as EmojiData));
    }
  }, [tab, open, emojiData]);

  const emojiResults = useMemo(() => {
    if (!emojiData) return [];
    const words = emojiQuery.toLowerCase().split(/\s+/).filter(Boolean).flatMap((w) => [w, ...(SYNONYMS[w] || [])]);
    const base = emojiData.emoji.filter(([, , g]) => emojiGroup === null || g === emojiGroup);
    if (!words.length) return emojiGroup === null ? [] : base;
    // Every typed word (or one of its synonyms) must appear in the emoji's name.
    const typed = emojiQuery.toLowerCase().split(/\s+/).filter(Boolean);
    return base.filter(([, name]) => typed.every((w) => [w, ...(SYNONYMS[w] || [])].some((alt) => name.includes(alt))));
  }, [emojiData, emojiQuery, emojiGroup]);
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

  const tabs: ["clipart" | "photo" | "emoji", string][] = [["clipart", "Clip art"], ["photo", "Photos"], ["emoji", "Emoji"]];
  const hasChoice = !!imageUrl || !!emoji;

  return (
    <div className="rounded-2xl border border-sky-100 bg-sky-50 p-3">
      <div className="flex items-center gap-3">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="h-14 w-14 rounded-xl object-cover" />
        ) : emoji ? (
          <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-white text-4xl">{emoji}</span>
        ) : (
          <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-white text-slate-400"><ImageIcon className="h-6 w-6" /></span>
        )}
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex-1 rounded-xl bg-white py-3 text-sm font-bold text-indigo-600 shadow-sm active:scale-95">
          {open ? "Close pictures" : hasChoice ? "Change picture" : "Choose a picture"}
        </button>
        {hasChoice && (
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
            <div className="space-y-2.5">
              <input
                value={emojiQuery}
                onChange={(e) => setEmojiQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                placeholder="Search emoji (e.g. pizza, dog, soccer)"
                className="w-full rounded-xl border border-sky-100 bg-white px-3.5 py-3 text-slate-800"
              />
              <div className="flex flex-wrap gap-1.5">
                {(emojiData?.groups || ["Faces", "People", "Animals", "Food", "Activities", "Places", "Things", "Symbols"]).map((g, i) => (
                  <button
                    type="button"
                    key={g}
                    onClick={() => setEmojiGroup(emojiGroup === i ? null : i)}
                    className={`rounded-full px-3.5 py-2 text-xs font-bold ${emojiGroup === i ? "bg-indigo-500 text-white" : "bg-white text-slate-600"}`}
                  >
                    {g}
                  </button>
                ))}
              </div>
              {!emojiQuery && emojiGroup === null && <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Popular</p>}
              {emojiQuery && emojiResults.length === 0 && emojiData && <p className="text-sm text-slate-500">No emoji found. Try another word.</p>}
              <div className="grid max-h-72 grid-cols-8 gap-1.5 overflow-y-auto">
                {(!emojiQuery && emojiGroup === null ? EMOJI : emojiResults.slice(0, 160).map(([e]) => e)).map((e) => (
                  <button
                    type="button"
                    key={e}
                    onClick={() => {
                      onPickEmoji(e);
                      setOpen(false);
                    }}
                    className="rounded-xl bg-white py-2 text-3xl active:scale-90"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Not a <form>: this picker lives inside the task/reward form, and nested forms submit the outer one. */}
              <div className="flex gap-2">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      search(query);
                    }
                  }}
                  placeholder="Search (e.g. dinosaur, pizza)"
                  enterKeyHint="search"
                  className="min-w-0 flex-1 rounded-xl border border-sky-100 bg-white px-3.5 py-3 text-slate-800"
                />
                <button type="button" onClick={() => search(query)} aria-label="Search" className="rounded-xl bg-indigo-500 px-4 text-white active:scale-95">
                  <Search className="h-5 w-5" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button type="button" key={s} onClick={() => search(s)} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 active:bg-sky-100">
                    {s}
                  </button>
                ))}
              </div>
              {loading && <p className="text-sm text-slate-500">Searching…</p>}
              {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
              {results.length > 0 && <p className="text-xs text-slate-400">Pictures from Pixabay</p>}
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
                    <img src={r.thumb} alt={r.title} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
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
