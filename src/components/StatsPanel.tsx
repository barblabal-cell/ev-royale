import { useMemo, useState } from "react";
import type { HandRecord, RangeKey, RangeStats } from "../lib/storage";
import { RANKS, bestStreakEver, computePreviousStats, computeStats, rankFor } from "../lib/storage";

/* ------------------------------ chart ------------------------------ */

function StatsChart({ stats }: { stats: RangeStats }) {
  const W = 660;
  const H = 250;
  const padL = 40;
  const padR = 42;
  const padT = 16;
  const padB = 34;
  const iw = W - padL - padR;
  const ih = H - padT - padB;
  const buckets = stats.buckets;
  const n = Math.max(1, buckets.length);
  const maxAtt = Math.max(4, ...buckets.map((b) => b.attempts));
  const bw = Math.min(34, (iw / n) * 0.55);

  const pts = buckets
    .map((b, i) => {
      if (!b.attempts) return null;
      const x = padL + (i + 0.5) * (iw / n);
      const y = padT + ih - (b.correct / b.attempts) * ih;
      return { x, y, acc: (b.correct / b.attempts) * 100 };
    })
    .filter(Boolean) as { x: number; y: number; acc: number }[];

  // build line segments across consecutive non-null points
  const segs: string[] = [];
  let seg: string[] = [];
  buckets.forEach((b, i) => {
    if (!b.attempts) {
      if (seg.length > 1) segs.push(seg.join(" "));
      seg = [];
      return;
    }
    const x = padL + (i + 0.5) * (iw / n);
    const y = padT + ih - (b.correct / b.attempts) * ih;
    seg.push(`${i === 0 || seg.length === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
  });
  if (seg.length > 1) segs.push(seg.join(" "));

  const thin = buckets.length > 16;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="accuracy chart">
      {/* grid */}
      {[0, 25, 50, 75, 100].map((v) => {
        const y = padT + ih - (v / 100) * ih;
        return (
          <g key={v}>
            <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="rgba(233,196,106,0.12)" strokeDasharray={v === 0 ? "" : "3 5"} />
            <text x={W - padR + 8} y={y + 4} fontSize="10" fill="#a8976f" fontFamily="var(--font-mono)">
              {v}%
            </text>
          </g>
        );
      })}
      {/* attempt bars */}
      {buckets.map((b, i) => {
        const x = padL + (i + 0.5) * (iw / n) - bw / 2;
        const h = (b.attempts / maxAtt) * ih * 0.92;
        return (
          <g key={i}>
            <rect x={x} y={padT + ih - h} width={bw} height={Math.max(h, b.attempts ? 3 : 0)} rx={3}
              fill={b.attempts ? "rgba(233,196,106,0.28)" : "transparent"}>
              <title>{`${b.label || "—"} · ${b.attempts} hands · ${b.correct} correct`}</title>
            </rect>
            {(!thin || i % Math.ceil(n / 12) === 0) && (
              <text x={padL + (i + 0.5) * (iw / n)} y={H - 12} fontSize="10" textAnchor="middle" fill="#a8976f" fontFamily="var(--font-mono)">
                {b.label}
              </text>
            )}
          </g>
        );
      })}
      {/* accuracy line */}
      {segs.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#e9c46a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ filter: "drop-shadow(0 0 6px rgba(233,196,106,0.5))" }} />
      ))}
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3.4} fill="#0d3a2c" stroke="#f0d48a" strokeWidth="2">
          <title>{`accuracy ${p.acc.toFixed(0)}%`}</title>
        </circle>
      ))}
      {pts.length === 0 && (
        <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="14" fill="#a8976f" fontFamily="var(--font-body)">
          No hands in this period — the felt is waiting.
        </text>
      )}
      {/* axis labels */}
      <text x={padL - 28} y={padT + 4} fontSize="10" fill="#a8976f" fontFamily="var(--font-mono)">hands</text>
    </svg>
  );
}

/* ------------------------------ KPI tile ------------------------------ */

function Tile({ label, value, sub, wide, delta }: { label: string; value: string; sub?: string; wide?: boolean; delta?: number | null }) {
  return (
    <div className={`reveal rounded-xl border border-brass-500/20 bg-ink-950/70 px-4 py-3.5 ${wide ? "col-span-2" : ""}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-cream-600">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-mono text-2xl font-bold text-cream-100 sm:text-[27px]">{value}</span>
        {delta !== undefined && delta !== null && (
          <span className={`font-mono text-xs font-bold ${delta >= 0 ? "text-felt-400" : "text-rouge-400"}`}>
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
      {sub && <p className="mt-0.5 text-xs text-cream-600">{sub}</p>}
    </div>
  );
}

/* ------------------------------ panel ------------------------------ */

const RANGE_LABELS: Record<RangeKey, { en: string; es: string }> = {
  week: { en: "This week", es: "Semana" },
  month: { en: "Last 30 days", es: "Mes" },
  year: { en: "Last 12 months", es: "Año" },
  all: { en: "All time", es: "Siempre" },
};

export function StatsPanel({ history, onClear }: { history: HandRecord[]; onClear: () => void }) {
  const [range, setRange] = useState<RangeKey>("week");
  const [confirmClear, setConfirmClear] = useState(false);

  const stats = useMemo(() => computeStats(history, range), [history, range]);
  const prev = useMemo(() => computePreviousStats(history, range), [history, range]);
  const allTime = useMemo(() => computeStats(history, "all"), [history]);
  const rank = rankFor(allTime.correct);
  const bestEver = useMemo(() => bestStreakEver(history), [history]);

  const delta = prev && prev.attempts > 0 && stats.attempts > 0 ? stats.accuracy - prev.accuracy : null;
  const recent = useMemo(() => [...history].slice(-9).reverse(), [history]);

  const fmtTime = (ms: number) => (ms >= 60000 ? `${(ms / 60000).toFixed(1)}m` : `${(ms / 1000).toFixed(1)}s`);

  return (
    <section id="ledger" className="relative z-10 mx-auto mt-14 w-full max-w-6xl px-4 sm:px-6">
      {/* rank header */}
      <div className="reveal flex flex-col gap-5 rounded-2xl border border-brass-500/25 bg-gradient-to-r from-ink-950/90 via-felt-950/80 to-ink-950/90 p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="flex items-center gap-4">
          <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
            <svg viewBox="0 0 64 64" className="absolute inset-0 spin-slower text-brass-500/60" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="32" cy="32" r="30" strokeDasharray="4 6" />
            </svg>
            <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-brass-500 bg-felt-900 font-display text-lg font-black text-brass-300">
              {RANKS.indexOf(rank.current) + 1}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brass-500">Table rank</p>
            <p className="font-display text-2xl font-bold leading-tight text-cream-100">
              {rank.current.name} <span className="text-brass-400 italic">· {rank.current.es}</span>
            </p>
            <p className="mt-0.5 font-mono text-xs text-cream-600">
              {allTime.correct} correct calls lifetime · best streak {bestEver}
            </p>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between text-[11px] font-semibold text-cream-600">
            <span className="uppercase tracking-[0.2em]">{rank.next ? `Next: ${rank.next.name}` : "Top of the house"}</span>
            <span className="font-mono">
              {rank.next ? `${allTime.correct} / ${rank.next.min}` : "∞"}
            </span>
          </div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full border border-brass-500/25 bg-ink-900">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brass-700 via-brass-500 to-brass-300 transition-all duration-700"
              style={{ width: `${Math.max(2, rank.progress * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* range tabs */}
      <div className="reveal mt-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl font-bold text-cream-100 sm:text-4xl">
            The ledger <span className="text-brass-400 italic">· el registro</span>
          </h2>
          <p className="mt-1 text-sm text-cream-600">Your EV instinct, measured — {RANGE_LABELS[range].en.toLowerCase()}.</p>
        </div>
        <div className="flex rounded-lg border border-brass-500/25 bg-ink-950/80 p-1">
          {(Object.keys(RANGE_LABELS) as RangeKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setRange(k)}
              className={`seg-btn rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${range === k ? "seg-on" : "text-cream-600"}`}
            >
              <span className="hidden sm:inline">{RANGE_LABELS[k].en}</span>
              <span className="sm:hidden">{RANGE_LABELS[k].es}</span>
            </button>
          ))}
        </div>
      </div>

      {/* KPI tiles */}
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-6">
        <Tile label="Hands" value={String(stats.attempts)} sub={`${stats.correct} correct`} />
        <Tile label="Accuracy" value={stats.attempts ? `${stats.accuracy.toFixed(1)}%` : "—"} wide delta={delta} sub={prev ? "vs previous period" : "first period"} />
        <Tile label="Direction" value={stats.attempts ? `${stats.signAccuracy.toFixed(0)}%` : "—"} sub="+EV / −EV read" />
        <Tile label="Avg deviation" value={stats.attempts ? `€${stats.avgDev.toFixed(0)}` : "—"} sub="|yours − actual|" />
        <Tile label="Avg think time" value={stats.attempts ? fmtTime(stats.avgMs) : "—"} sub="per hand" />
      </div>

      {/* chart */}
      <div className="reveal mt-5 rounded-2xl border border-brass-500/20 bg-ink-950/70 p-4 sm:p-5">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-cream-600">
            Accuracy <span className="text-brass-400">—</span> volume <span className="text-brass-400/40">—</span> {RANGE_LABELS[range].en}
          </p>
          <div className="flex items-center gap-3 text-[11px] text-cream-600">
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-brass-400" /> accuracy</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-brass-400/30" /> hands</span>
          </div>
        </div>
        <StatsChart stats={stats} />
      </div>

      {/* recent hands + reset */}
      <div className="reveal mt-5 grid gap-5 lg:grid-cols-[1fr_290px]">
        <div className="rounded-2xl border border-brass-500/20 bg-ink-950/70 p-4 sm:p-5">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-cream-600">Last hands at the table</p>
          {recent.length === 0 ? (
            <p className="mt-6 pb-4 text-center text-sm text-cream-600">
              Nothing yet — deal your first hand above and the ledger opens.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-brass-500/10">
              {recent.map((r, i) => {
                const ok = r.correct;
                return (
                  <li key={r.t + "-" + i} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${ok ? "border-felt-400/60 text-felt-400" : "border-rouge-400/60 text-rouge-400"}`}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                        {ok ? <path d="M4 12.5l5.5 5.5L20 6.5" /> : <path d="M6 6l12 12M18 6L6 18" />}
                      </svg>
                    </span>
                    <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${r.street === "flop" ? "bg-felt-700/60 text-cream-200" : "bg-nightblue-800 text-cream-200"}`}>
                      {r.street}
                    </span>
                    <span className="hidden text-cream-400 sm:inline">{r.drawLabel}</span>
                    <span className="font-mono text-xs text-cream-600">pot €{r.pot} · bet €{r.bet}</span>
                    <span className="ml-auto font-mono text-sm">
                      <span className={ok ? "text-felt-400" : "text-rouge-400"}>{r.entered > 0 ? `+${r.entered}` : r.entered}</span>
                      <span className="text-cream-600"> → </span>
                      <span className="text-brass-300">{r.actual > 0 ? `+${r.actual}` : r.actual}</span>
                    </span>
                    <span className="hidden font-mono text-[11px] text-cream-600 md:inline">{fmtTime(r.ms)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-brass-500/20 bg-ink-950/70 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-cream-600">House rules</p>
            <ul className="mt-3 space-y-2.5 text-[13px] leading-snug text-cream-400">
              <li className="flex gap-2"><span className="text-brass-400">◆</span> Equity: outs × 4 on the flop, outs × 2 on the turn.</li>
              <li className="flex gap-2"><span className="text-brass-400">◆</span> EV(call) = equity × (pot + 2·bet) − bet.</li>
              <li className="flex gap-2"><span className="text-brass-400">◆</span> If EV &gt; 0 the call is +EV — else fold like a gentleman.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-rouge-600/30 bg-rouge-950/40 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-rouge-400">Danger zone</p>
            <p className="mt-2 text-[13px] text-cream-400">Burn the ledger and start from zero. The pit boss won't ask questions.</p>
            {confirmClear ? (
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => { onClear(); setConfirmClear(false); }}
                  className="flex-1 rounded-lg bg-rouge-600 px-3 py-2 text-xs font-bold uppercase tracking-wider text-cream-100 transition hover:bg-rouge-500">
                  Yes, burn it
                </button>
                <button type="button" onClick={() => setConfirmClear(false)}
                  className="flex-1 rounded-lg border border-brass-500/30 px-3 py-2 text-xs font-bold uppercase tracking-wider text-cream-400 transition hover:text-cream-100">
                  Keep
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmClear(true)}
                className="mt-3 w-full rounded-lg border border-rouge-400/50 px-3 py-2 text-xs font-bold uppercase tracking-wider text-rouge-400 transition hover:bg-rouge-600/20">
                Reset history
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
