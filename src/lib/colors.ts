export interface KidColor {
  text: string;
  bg: string;
  border: string;
  solid: string;
  ring: string;
}

export const COLOR_MAP: Record<string, KidColor> = {
  blue: { text: "text-blue-700", bg: "bg-blue-500/10", border: "border-blue-300/70", solid: "bg-blue-500", ring: "ring-blue-400/60" },
  emerald: { text: "text-emerald-700", bg: "bg-emerald-500/10", border: "border-emerald-300/70", solid: "bg-emerald-500", ring: "ring-emerald-400/60" },
  amber: { text: "text-amber-700", bg: "bg-amber-500/10", border: "border-amber-300/70", solid: "bg-amber-500", ring: "ring-amber-400/60" },
  purple: { text: "text-purple-700", bg: "bg-purple-500/10", border: "border-purple-300/70", solid: "bg-purple-500", ring: "ring-purple-400/60" },
  pink: { text: "text-pink-700", bg: "bg-pink-500/10", border: "border-pink-300/70", solid: "bg-pink-500", ring: "ring-pink-400/60" },
  red: { text: "text-red-700", bg: "bg-red-500/10", border: "border-red-300/70", solid: "bg-red-500", ring: "ring-red-400/60" },
};

export const kidColor = (c: string): KidColor => COLOR_MAP[c] || COLOR_MAP.blue;
