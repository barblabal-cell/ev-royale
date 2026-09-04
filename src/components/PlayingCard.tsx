import type { CardT, Suit } from "../lib/poker";
import { RANK_LABEL } from "../lib/poker";

/* Hand-drawn suit paths (24×24 viewBox) — no emoji, pure SVG */
export const SUIT_PATHS: Record<Suit, string> = {
  s: "M12 2C9.4 6.6 4 9.9 4 13.7c0 2.5 2 4.3 4.3 4.3 1.5 0 2.8-.8 3.4-1.9-.3 2.4-1.2 4.3-2.6 5.4h5.8c-1.4-1.1-2.3-3-2.6-5.4.6 1.1 1.9 1.9 3.4 1.9 2.3 0 4.3-1.8 4.3-4.3C20 9.9 14.6 6.6 12 2z",
  h: "M12 21.3C7.2 17 2 13.1 2 8.7 2 5.7 4.4 3.5 7.1 3.5c2 0 3.8 1.1 4.9 3 1.1-1.9 2.9-3 4.9-3C19.6 3.5 22 5.7 22 8.7c0 4.4-5.2 8.3-10 12.6z",
  d: "M12 1.8C9.2 6.9 6.2 10.4 3.4 12c2.8 1.6 5.8 5.1 8.6 10.2C14.8 17.1 17.8 13.6 20.6 12 17.8 10.4 14.8 6.9 12 1.8z",
  c: "M12 2a4.1 4.1 0 0 0-3.6 6.1 4.1 4.1 0 1 0 3 6.7c-.3 2.3-1.1 4.1-2.4 5.6h6c-1.3-1.5-2.1-3.3-2.4-5.6a4.1 4.1 0 1 0 3-6.7A4.1 4.1 0 0 0 12 2z",
};

export function SuitIcon({ suit, className = "", size = 16 }: { suit: Suit; className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d={SUIT_PATHS[suit]} />
    </svg>
  );
}

const RED: Suit[] = ["h", "d"];

export function PlayingCard({
  card,
  w = 62,
  tilt = 0,
  delay = 0,
  hero = false,
  variant = "deal",
}: {
  card: CardT;
  w?: number;
  tilt?: number;
  delay?: number;
  hero?: boolean;
  variant?: "deal" | "board";
}) {
  const red = RED.includes(card.suit);
  const h = Math.round(w * 1.42);
  const rank = RANK_LABEL[card.rank];
  const color = red ? "#b3232f" : "#232838";
  const cornerSize = Math.max(9, Math.round(w * 0.19));

  return (
    <div
      className={variant === "deal" ? "card-deal relative shrink-0" : "card-board relative shrink-0"}
      style={{ width: w, height: h, animationDelay: `${delay}ms`, ["--tilt" as string]: `${tilt}deg` }}
    >
      <div className={`playing-card absolute inset-0 rounded-[9%] ${hero ? "ring-2 ring-brass-400/80" : ""}`}>
        {/* corners */}
        <div
          className="absolute flex flex-col items-center leading-none font-bold"
          style={{ top: "5%", left: "7%", color, fontSize: cornerSize, fontFamily: "var(--font-display)" }}
        >
          <span>{rank}</span>
          <SuitIcon suit={card.suit} size={Math.max(7, Math.round(w * 0.13))} className="mt-[2px]" />
        </div>
        <div
          className="absolute flex rotate-180 flex-col items-center leading-none font-bold"
          style={{ bottom: "5%", right: "7%", color, fontSize: cornerSize, fontFamily: "var(--font-display)" }}
        >
          <span>{rank}</span>
          <SuitIcon suit={card.suit} size={Math.max(7, Math.round(w * 0.13))} className="mt-[2px]" />
        </div>
        {/* center pip / court */}
        <div className="absolute inset-0 flex items-center justify-center">
          {card.rank >= 11 ? (
            <div
              className="flex h-[62%] w-[62%] flex-col items-center justify-center rounded-[10%] border-2"
              style={{ borderColor: color, color }}
            >
              <span
                className="font-black leading-none"
                style={{ fontFamily: "var(--font-display)", fontSize: Math.round(w * 0.42) }}
              >
                {rank}
              </span>
              <SuitIcon suit={card.suit} size={Math.round(w * 0.2)} className="mt-1 opacity-80" />
            </div>
          ) : (
            <SuitIcon suit={card.suit} size={Math.round(w * 0.46)} className="opacity-90" />
          )}
        </div>
      </div>
    </div>
  );
}

export function CardBack({ w = 62, tilt = 0, delay = 0 }: { w?: number; tilt?: number; delay?: number }) {
  const h = Math.round(w * 1.42);
  return (
    <div
      className="card-deal relative shrink-0"
      style={{ width: w, height: h, animationDelay: `${delay}ms`, ["--tilt" as string]: `${tilt}deg` }}
    >
      <div className="card-back absolute inset-0 flex items-center justify-center rounded-[9%]">
        <div className="flex h-[82%] w-[80%] items-center justify-center rounded-[8%] border border-brass-400/50">
          <SuitIcon suit="s" size={Math.round(w * 0.3)} className="text-brass-400/80" />
        </div>
      </div>
    </div>
  );
}
