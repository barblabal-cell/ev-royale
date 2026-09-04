import { DRAWS } from "../lib/poker";
import { SuitIcon } from "./PlayingCard";

export function HelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/85 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="How to play"
    >
      <div
        className="verdict-in max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-brass-500/40 bg-gradient-to-b from-felt-950 to-ink-950 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.7)] sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brass-500">La academia</p>
            <h2 className="font-display text-3xl font-bold text-cream-100">How the table works</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-brass-500/30 px-3 py-1.5 text-sm font-bold text-cream-400 transition hover:border-brass-500/70 hover:text-cream-100"
            aria-label="close help"
          >
            ✕
          </button>
        </div>

        <div className="mt-6 space-y-6 text-sm leading-relaxed text-cream-200">
          <section>
            <h3 className="font-display text-lg font-semibold text-brass-300">1 · Read the table</h3>
            <p className="mt-1.5 text-cream-400">
              Every hand you are the <em className="text-cream-200">Hero</em> with a known draw. The placard names it and its{" "}
              <strong className="text-cream-100">outs</strong>. The villain has bet into the pot — you must decide about the{" "}
              <strong className="text-cream-100">call</strong>.
            </p>
          </section>

          <section>
            <h3 className="font-display text-lg font-semibold text-brass-300">2 · Estimate equity — Rule of 4 & 2</h3>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-felt-600/50 bg-felt-900/60 p-4">
                <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-felt-400">On the flop</p>
                <p className="mt-1 font-mono text-xl font-bold text-cream-100">equity ≈ outs × 4</p>
                <p className="mt-1 text-xs text-cream-400">two cards still to come</p>
              </div>
              <div className="rounded-xl border border-nightblue-600/50 bg-nightblue-800/60 p-4">
                <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-cream-200">On the turn</p>
                <p className="mt-1 font-mono text-xl font-bold text-cream-100">equity ≈ outs × 2</p>
                <p className="mt-1 text-xs text-cream-400">only the river left</p>
              </div>
            </div>
          </section>

          <section>
            <h3 className="font-display text-lg font-semibold text-brass-300">3 · Compute the EV of the call</h3>
            <div className="mt-2 rounded-xl border border-brass-500/40 bg-ink-900/80 p-4 text-center">
              <p className="font-mono text-lg font-bold text-brass-300 sm:text-xl">
                EV = equity × (pot + 2 × bet) − bet
              </p>
              <p className="mt-2 text-xs text-cream-400">
                Example — flop, flush draw (9 outs → 36%), pot €120, bet €80:
                <br />
                <span className="font-mono text-cream-200">0.36 × (120 + 160) − 80 = 0.36 × 280 − 80 = 100.8 − 80 ≈ <strong className="text-felt-400">+€21</strong> → call</span>
              </p>
            </div>
            <p className="mt-2 text-xs text-cream-400">
              Same answer via pot odds: you risk €80 to win €280 → you need 80/280 ≈ 28.6% equity. You have ~36% → the call prints money.
            </p>
          </section>

          <section>
            <h3 className="font-display text-lg font-semibold text-brass-300">4 · Punch it in</h3>
            <p className="mt-1.5 text-cream-400">
              Type the EV on the keypad — <strong className="text-cream-100">sign included</strong> (+ for a profitable call, − for a losing one).
              Round to whole euros. Precision mode sets the tolerance: exact ±5, casual ±20, loose ±50. After each hand the dealer
              shows the full solution.
            </p>
          </section>

          <section>
            <h3 className="font-display text-lg font-semibold text-brass-300">The draws you'll face</h3>
            <div className="mt-2 overflow-hidden rounded-xl border border-brass-500/25">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-ink-900/80 font-mono text-[10px] uppercase tracking-widest text-brass-400">
                    <th className="px-4 py-2">Draw</th>
                    <th className="px-4 py-2">Outs</th>
                    <th className="hidden px-4 py-2 sm:table-cell">Flop equity</th>
                    <th className="px-4 py-2">Turn equity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brass-500/10">
                  {DRAWS.map((d) => (
                    <tr key={d.key} className="transition hover:bg-brass-500/5">
                      <td className="px-4 py-2 font-semibold text-cream-100">{d.label}</td>
                      <td className="px-4 py-2 font-mono font-bold text-brass-300">{d.outs}</td>
                      <td className="hidden px-4 py-2 font-mono text-cream-400 sm:table-cell">{Math.min(96, d.outs * 4)}%</td>
                      <td className="px-4 py-2 font-mono text-cream-400">{Math.min(96, d.outs * 2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="flex items-center gap-3 rounded-xl border border-brass-500/20 bg-ink-900/60 p-4">
            <SuitIcon suit="s" size={26} className="shrink-0 text-brass-400" />
            <p className="text-xs text-cream-400">
              <strong className="text-cream-200">Keyboard:</strong> digits type directly, <span className="font-mono text-brass-300">−</span> toggles sign,{" "}
              <span className="font-mono text-brass-300">⌫</span> deletes, <span className="font-mono text-brass-300">Enter</span> locks in,{" "}
              <span className="font-mono text-brass-300">N</span> deals the next hand.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
