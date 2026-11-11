export interface KidColor {
  text: string;
  bg: string;
  border: string;
  solid: string;
  ring: string;
}

export const COLOR_MAP: Record<string, KidColor> = {
  blue: { text: "text-blue-300", bg: "bg-blue-500/10", border: "border-blue-400/30", solid: "bg-blue-500", ring: "ring-blue-400/60" },
  emerald: { text: "text-emerald-300", bg: "bg-emerald-500/10", border: "border-emerald-400/30", solid: "bg-emerald-500", ring: "ring-emerald-400/60" },
  amber: { text: "text-amber-300", bg: "bg-amber-500/10", border: "border-amber-400/30", solid: "bg-amber-500", ring: "ring-amber-400/60" },
  purple: { text: "text-purple-300", bg: "bg-purple-500/10", border: "border-purple-400/30", solid: "bg-purple-500", ring: "ring-purple-400/60" },
  pink: { text: "text-pink-300", bg: "bg-pink-500/10", border: "border-pink-400/30", solid: "bg-pink-500", ring: "ring-pink-400/60" },
  red: { text: "text-red-300", bg: "bg-red-500/10", border: "border-red-400/30", solid: "bg-red-500", ring: "ring-red-400/60" },
};

export const kidColor = (c: string): KidColor => COLOR_MAP[c] || COLOR_MAP.blue;
