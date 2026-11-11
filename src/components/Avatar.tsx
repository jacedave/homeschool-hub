import React from "react";
import { kidColor } from "@/lib/colors";
import type { Kid } from "@/lib/types";

/** Profile picture if the kid has one, otherwise their initial on their color. */
export default function Avatar({ kid, size = 40, className = "" }: { kid: Pick<Kid, "name" | "color" | "photo">; size?: number; className?: string }) {
  const st = kidColor(kid.color);
  const box = { width: size, height: size };
  return kid.photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={kid.photo} alt={kid.name} style={box} className={`shrink-0 rounded-full object-cover ring-2 ring-white ${className}`} />
  ) : (
    <span
      style={{ ...box, fontSize: size * 0.45 }}
      className={`flex shrink-0 items-center justify-center rounded-full ${st.solid} font-extrabold text-white ring-2 ring-white ${className}`}
    >
      {kid.name.charAt(0).toUpperCase()}
    </span>
  );
}
