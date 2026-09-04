import { useMemo } from "react";
import type { Scenario } from "../lib/poker";
import { decomposeChips } from "../lib/poker";
import { CardBack, PlayingCard, SuitIcon } from "./PlayingCard";

/* ---------------- chip stack (side view, painterly) ---------------- */

function Chip({ color, light, y, w }: { color: string; light: string; y: number; w: number }) {
  const h = Math.max(6, w * 0.22);
  return (
    <g transform={`translate(0 ${y})`}>
      <rect x={0} y={0} width={w} height={h} rx={h / 2} fill={color} stroke="rgba(0,0,0,0.55)" strokeWidth="1" />
      <rect x={w * 0.12} y={0} width={w * 0.1} height={h} fill={light} opacity={0.9} />
      <rect x={w * 0.45} y={0} width={w * 0.1} height={h} fill={light} opacity={0.9} />
      <rect x={w * 0.78} y={0} width={w * 0.1} height={h} fill={light} opacity={0.9} />
      <rect x={0} y={0} width={w} height={h * 0.35} rx={h / 2} fill="rgba(255,255,255,0.18)" />
    </g>
  );
}

function ChipStack({ amount, w = 40, maxChips = 6 }: { amount: number; w?: number; maxChips?: number }) {
  const denoms = decomposeChips(amount);
  const chipH = Math.max(6, w * 0.22);
  let stack: { color: string; light: string }[] = [];
  denoms.forEach((d) => {
    for (let i = 0; i < d.count; i++) stack.push({ color: d.color, light: d.light });
  });
  const total = stack.length;
  const shown = stack.slice(-maxChips);
  const h = 14 + shown.length * (chipH - 2);
  return (
    <svg width={w} height={h} aria-hidden="true" style={{ filter: "drop-shadow(0 4px 5px rgba(0,0,0,0.5))" }}>
      {shown.map((chp, i) => (
        <Chip key={i} color={chp.color} light={chp.light} y={h - 8 - i * (chipH - 2)} w={w} />
      ))}
      {total > maxChips && (
        <text x={w / 2} y={7} textAnchor="middle" fontSize={9} fill="#e9c46a" fontFamily="var(--font-mono)">
          ×{total}
        </text>
      )}
    </svg>
  );
}

function MoneyPile({ label, amount, accent = false, compact = false }: { label: string; amount: number; accent?: boolean; compact?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.22em] ${
          accent
            ? "border-rouge-400/60 bg-rouge-950/70 text-rouge-400"
            : "border-brass-500/40 bg-ink-950/60 text-brass-300"
        }`}
      >
        {label}
      </span>
      <div className={compact ? "hidden sm:block" : undefined}>
        <ChipStack amount={amount} w={42} />
      </div>
      <span className="font-mono text-sm font-bold text-cream-100 sm:text-base" style={{ textShadow: "0 2px 6px rgba(0,0,0,0.8)" }}>
        €{amount.toLocaleString("en-US")}
      </span>
    </div>
  );
}

/* ---------------- chip burst on correct ---------------- */

function ChipBurst({ show }: { show: boolean }) {
  const bits = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        dx: `${(Math.random() - 0.5) * 220}px`,
        dy: `${-40 - Math.random() * 160}px`,
        rot: `${(Math.random() - 0.5) * 540}deg`,
        color: ["#e9c46a", "#b03a2e", "#1e8449", "#7d3c98", "#f0d48a"][i % 5],
        size: 8 + Math.random() * 10,
        delay: Math.random() * 0.08,
      })),
    [show]
  );
  if (!show) return null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/3 z-30">
      {bits.map((b, i) => (
        <span
          key={i}
          className="chip-burst-bit absolute rounded-full border border-black/40"
          style={{
            width: b.size,
            height: b.size,
            background: `radial-gradient(circle at 35% 30%, ${b.color}, rgba(0,0,0,0.5))`,
            ["--dx" as string]: b.dx,
            ["--dy" as string]: b.dy,
            ["--rot" as string]: b.rot,
            animationDelay: `${b.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ---------------- the table ---------------- */

export function TableScene({
  scenario,
  revealed,
}: {
  scenario: Scenario;
  revealed: { correct: boolean } | null;
}) {
  const s = scenario;
  const isTurn = s.street === "turn";
  const flop = s.board.slice(0, 3);
  const turn = s.board[3];

  return (
    <div className="felt-rail relative rounded-[46%/50%] p-2 sm:p-3" key={s.id}>
      <div className="felt-surface relative overflow-hidden rounded-[46%/50%]" style={{ aspectRatio: "16/9.6" }}>
        <div className="table-sheen" />

        {/* arc lettering */}
        <svg className="pointer-events-none absolute inset-x-0 top-0 mx-auto w-[86%] opacity-70" viewBox="0 0 600 130" aria-hidden="true">
          <defs>
            <path id="arcTop" d="M 60 150 A 260 170 0 0 1 540 150" fill="none" />
          </defs>
          <text fontSize="17" letterSpacing="5" fill="#e9c46a" fontFamily="var(--font-display)" fontWeight={600}>
            <textPath href="#arcTop" startOffset="50%" textAnchor="middle">
              CASINO DE BARCELONA · SALA PRIVADA ·
            </textPath>
          </text>
        </svg>

        {/* betting line ring */}
        <div className="pointer-events-none absolute inset-[9%] rounded-[50%] border border-dashed border-brass-500/25" />

        {/* pot — top center */}
        <div className="absolute left-1/2 top-[11%] z-10 -translate-x-1/2 sm:top-[12%]">
          <MoneyPile label="Pot" amount={s.pot} />
        </div>

        {/* villain — top right */}
        <div className="absolute right-[4%] top-[5%] z-10 flex flex-col items-center sm:right-[7%]">
          <div className="flex gap-0.5">
            <CardBack w={30} tilt={4} delay={80} />
            <CardBack w={30} tilt={-3} delay={160} />
          </div>
          <span className="mt-1 rounded-full border border-rouge-400/40 bg-ink-950/70 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-rouge-400">
            Villain
          </span>
          <div className="mt-1.5 scale-90 sm:scale-100">
            <MoneyPile label="Bets" amount={s.bet} accent compact />
          </div>
        </div>

        {/* dealer placard */}
        <div className="absolute left-[3.5%] top-[5%] z-10 sm:left-[6%]">
          <div className="w-[132px] rounded-lg border border-brass-500/50 bg-ink-950/85 px-3 py-2 shadow-[0_8px_20px_rgba(0,0,0,0.5)] sm:w-[168px]">
            <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-brass-500 sm:text-[10px]">
              {isTurn ? "The Turn" : "The Flop"}
            </p>
            <p className="mt-0.5 font-display text-[13px] font-semibold leading-tight text-cream-100 sm:text-[15px]">
              {s.draw.label}
            </p>
            <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-brass-500/15 px-2 py-0.5 font-mono text-[11px] font-bold text-brass-300">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-brass-400" />
              {s.draw.outs} outs
            </p>
          </div>
        </div>

        {/* board */}
        <div className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-[58%] items-center gap-1.5 sm:gap-2.5">
          {flop.map((cd, i) => (
            <PlayingCard key={`f${i}`} card={cd} w={52} variant="board" delay={120 + i * 110} />
          ))}
          <div className="w-2 sm:w-4" />
          {isTurn && turn ? (
            <PlayingCard card={turn} w={52} variant="board" delay={520} hero />
          ) : (
            <div className="flex h-[74px] w-[52px] items-center justify-center rounded-[9%] border border-dashed border-brass-500/30">
              <span className="font-mono text-[9px] uppercase tracking-widest text-brass-500/50">turn</span>
            </div>
          )}
        </div>

        {/* call amount strip */}
        <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 translate-y-[26%]">
          <p className="rounded-full border border-brass-500/30 bg-ink-950/75 px-3.5 py-1 text-center font-mono text-[11px] tracking-wide text-cream-200 sm:text-xs">
            call <span className="font-bold text-brass-300">€{s.bet.toLocaleString("en-US")}</span> to win{" "}
            <span className="font-bold text-brass-300">€{(s.pot + s.bet).toLocaleString("en-US")}</span>
          </p>
        </div>

        {/* hero — bottom left */}
        <div className="absolute bottom-[3%] left-[4%] z-10 flex items-end gap-2 sm:bottom-[5%] sm:left-[7%] sm:gap-3">
          <div className="flex">
            <PlayingCard card={s.hand[0]} w={56} tilt={-7} delay={620} hero />
            <PlayingCard card={s.hand[1]} w={56} tilt={4} delay={720} hero />
          </div>
          <div className="mb-1 flex flex-col items-start">
            <span className="rounded-full border border-brass-500/40 bg-ink-950/70 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-brass-300">
              You · Hero
            </span>
            <span className="mt-1 font-mono text-[10px] text-cream-400">
              {isTurn ? "equity ≈ " + s.equity + "% (rule of 2)" : "equity ≈ " + s.equity + "% (rule of 4)"}
            </span>
          </div>
        </div>

        {/* dealer button */}
        <div className="absolute bottom-[8%] right-[9%] z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 border-cream-200 bg-cream-100 font-display text-sm font-black text-felt-900 shadow-[0_4px_10px_rgba(0,0,0,0.5)] sm:h-10 sm:w-10">
          D
        </div>

        {/* verdict glow */}
        {revealed && (
          <div
            className={`pointer-events-none absolute inset-0 z-20 rounded-[46%/50%] transition-opacity duration-700 ${
              revealed.correct ? "opacity-100" : "opacity-70"
            }`}
            style={{
              boxShadow: revealed.correct
                ? "inset 0 0 120px rgba(233,196,106,0.35)"
                : "inset 0 0 120px rgba(164,36,59,0.4)",
            }}
          />
        )}

        <ChipBurst show={!!revealed?.correct} />

        {/* corner suits, whisper-faint */}
        <SuitIcon suit="h" size={54} className="absolute bottom-[6%] right-[4%] rotate-12 text-brass-500/10" />
        <SuitIcon suit="c" size={44} className="absolute left-[2%] top-[46%] -rotate-12 text-brass-500/10" />
      </div>
    </div>
  );
}
