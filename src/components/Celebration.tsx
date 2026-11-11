"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Star } from "lucide-react";
import type { CelebrationData } from "@/lib/types";

const CONFETTI_COLORS = ["#fbbf24", "#f472b6", "#60a5fa", "#34d399", "#a78bfa", "#fb7185"];
const DURATION_MS = 5000;

interface Props {
  data: CelebrationData;
  onClose: () => void;
}

/** Full-screen reward popup: big picture, rays, confetti, count-up. Tap anywhere to dismiss. */
export default function Celebration({ data, onClose }: Props) {
  const [imgFailed, setImgFailed] = useState(false);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const t = setTimeout(onClose, DURATION_MS);
    return () => clearTimeout(t);
  }, [onClose]);

  // Count the star total up quickly for a little extra payoff.
  useEffect(() => {
    const target = data.points ?? 0;
    if (!target) return;
    let n = 0;
    const iv = setInterval(() => {
      n += 1;
      setShown(n);
      if (n >= target) clearInterval(iv);
    }, Math.max(40, Math.min(160, 900 / target)));
    return () => clearInterval(iv);
  }, [data.points]);

  const confetti = useMemo(
    () =>
      Array.from({ length: 48 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 2.5,
        duration: 2.6 + Math.random() * 2.4,
        drift: Math.round(Math.random() * 160 - 80),
        size: 8 + Math.round(Math.random() * 10),
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        round: i % 3 === 0,
      })),
    []
  );

  const showImage = !!data.imageUrl && !imgFailed;

  return (
    <div
      onClick={onClose}
      className="cele-overlay overlay-full fixed z-[60] flex items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-700 via-fuchsia-700 to-amber-500"
    >
      <div className="cele-rays absolute left-1/2 top-1/2 h-[220vmax] w-[220vmax] -ml-[110vmax] -mt-[110vmax]" />

      {confetti.map((c, i) => (
        <span
          key={i}
          className="cele-confetti"
          style={
            {
              left: `${c.left}%`,
              width: c.size,
              height: c.round ? c.size : c.size * 0.5,
              borderRadius: c.round ? "50%" : 2,
              backgroundColor: c.color,
              animationDuration: `${c.duration}s`,
              animationDelay: `${c.delay}s`,
              "--drift": `${c.drift}px`,
            } as React.CSSProperties
          }
        />
      ))}

      <div className="relative z-10 flex w-full max-w-4xl flex-col items-center px-8 text-center">
        <div className="cele-pop">
          <div className="cele-float">
            {showImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.imageUrl}
                alt=""
                onError={() => setImgFailed(true)}
                className="max-h-[48vh] max-w-[80vw] rounded-[2rem] border-8 border-white/90 object-cover shadow-2xl"
              />
            ) : (
              <div className="text-[14rem] leading-none drop-shadow-2xl">{data.icon}</div>
            )}
          </div>
        </div>

        <h2 className="cele-rise-1 mt-6 text-5xl font-black uppercase tracking-wide text-white drop-shadow-lg">
          {data.headline}
        </h2>
        <p className="cele-rise-2 mt-2 text-2xl font-semibold text-white/95 drop-shadow">
          {data.name} · {data.title}
        </p>

        {data.points ? (
          <div className="cele-rise-3 mt-6 inline-flex items-center gap-3 rounded-full bg-white/95 px-8 py-3 shadow-xl">
            <Star className="h-9 w-9 fill-amber-400 text-amber-400" />
            <span className="text-4xl font-black text-amber-600 tabular-nums">+{shown} Stars</span>
          </div>
        ) : null}
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/20">
        <div className="cele-timer h-full bg-white/80" style={{ animationDuration: `${DURATION_MS}ms` }} />
      </div>
      <p className="absolute bottom-4 w-full text-center text-sm font-medium text-white/80">Tap anywhere to continue</p>
    </div>
  );
}
