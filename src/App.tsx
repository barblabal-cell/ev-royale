import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HelpModal } from "./components/HelpModal";
import { Keypad, type KeyAction } from "./components/Keypad";
import { StatsPanel } from "./components/StatsPanel";
import { TableScene } from "./components/TableScene";
import { sound } from "./lib/audio";
import { generateScenario, requiredEquity, type Scenario, type Stakes, type StreetMode } from "./lib/poker";
import {
  currentStreak,
  loadHistory,
  loadSettings,
  saveHistory,
  saveSettings,
  type HandRecord,
  type Settings,
} from "./lib/storage";

/* ---------------- tiny inline icons ---------------- */

const FlameIcon = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M12 2c.6 3.4-.8 5.2-2.4 6.9C7.9 10.7 6 12.7 6 16a6 6 0 0 0 12 0c0-2.6-1.2-4.6-2.5-6.3-.4 1.2-1 2-2 2.6.3-3.3-.6-7.4-1.5-10.3z" />
  </svg>
);

const NoteIcon = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 18V6l10-2v12" />
    <circle cx="6.5" cy="18" r="2.5" />
    <circle cx="16.5" cy="16" r="2.5" />
  </svg>
);

const WaveIcon = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4" />
  </svg>
);

const ChipLogo = () => (
  <svg viewBox="0 0 48 48" className="h-10 w-10" aria-hidden="true">
    <circle cx="24" cy="24" r="22" fill="#0d3a2c" stroke="#d9a441" strokeWidth="3" />
    <circle cx="24" cy="24" r="14" fill="none" stroke="#e9c46a" strokeWidth="1.5" strokeDasharray="5 4" />
    <path d="M24 10c-3.4 6.2-11 10.6-11 16.2 0 3.4 2.8 5.8 5.8 5.8 2.1 0 3.9-1.1 4.7-2.6-.4 3.2-1.6 5.9-3.6 7.6h8.2c-2-1.7-3.2-4.4-3.6-7.6.8 1.5 2.6 2.6 4.7 2.6 3 0 5.8-2.4 5.8-5.8C35 20.6 27.4 16.2 24 10z" fill="#e9c46a" />
  </svg>
);

/* ---------------- segmented control ---------------- */

function Seg<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { v: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-cream-600">{label}</span>
      <div className="flex rounded-lg border border-brass-500/20 bg-ink-950/80 p-0.5">
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            className={`seg-btn rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${value === o.v ? "seg-on" : "text-cream-600"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------- verdict panel ---------------- */

interface Result {
  entered: number;
  actual: number;
  correct: boolean;
  signOk: boolean;
  dev: number;
}

function Verdict({ s, r, tolerance, onNext }: { s: Scenario; r: Result; tolerance: number; onNext: () => void }) {
  const req = requiredEquity(s.pot, s.bet);
  const plusEV = s.actualEV > 0;
  const fmt = (n: number) => (n > 0 ? `+€${n.toLocaleString("en-US")}` : `−€${Math.abs(n).toLocaleString("en-US")}`);
  return (
    <div className="verdict-in mt-4 overflow-hidden rounded-xl border border-brass-500/30 bg-ink-950/85">
      <div className={`flex items-center justify-between px-4 py-3 ${r.correct ? "bg-felt-800" : "bg-rouge-950"}`}>
        <div>
          <p className={`font-display text-xl font-bold ${r.correct ? "text-brass-300" : "text-rouge-400"}`}>
            {r.correct ? "¡Correcto! Bien jugado" : "Not quite, amigo"}
          </p>
          <p className="text-xs text-cream-400">
            actual EV of the call: <span className="font-mono font-bold text-cream-100">{fmt(r.actual)}</span>
          </p>
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 ${r.correct ? "border-brass-400 text-brass-300" : "border-rouge-400 text-rouge-400"}`}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            {r.correct ? <path d="M4 12.5l5.5 5.5L20 6.5" /> : <path d="M6 6l12 12M18 6L6 18" />}
          </svg>
        </div>
      </div>

      <div className="grid grid-cols-3 divide-x divide-brass-500/10 text-center">
        <div className="px-2 py-2.5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-cream-600">Your EV</p>
          <p className={`font-mono text-sm font-bold ${r.correct ? "text-felt-400" : "text-rouge-400"}`}>{fmt(r.entered)}</p>
        </div>
        <div className="px-2 py-2.5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-cream-600">Deviation</p>
          <p className="font-mono text-sm font-bold text-cream-100">€{r.dev}</p>
        </div>
        <div className="px-2 py-2.5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-cream-600">{plusEV ? "+EV read" : "−EV read"}</p>
          <p className={`font-mono text-sm font-bold ${r.signOk ? "text-felt-400" : "text-rouge-400"}`}>{r.signOk ? "correct" : "missed"}</p>
        </div>
      </div>

      <div className="border-t border-brass-500/15 bg-felt-950/60 px-4 py-3 font-mono text-[11.5px] leading-relaxed text-cream-400">
        <p>
          <span className="text-brass-300">equity</span> = {s.draw.outs} outs × {s.street === "flop" ? "4" : "2"} = {s.equity}%
          <span className="text-cream-600"> · needs {req.toFixed(1)}%</span>
        </p>
        <p>
          <span className="text-brass-300">EV</span> = {s.equity}% × (€{s.pot} + 2×€{s.bet}) − €{s.bet} ={" "}
          <span className="font-bold text-cream-100">{fmt(s.actualEV)}</span> → {plusEV ? "call, +EV" : "fold, −EV"}
        </p>
        <p className="mt-1 text-[10.5px] text-cream-600">tolerance ±€{tolerance} · sign {r.signOk ? "✓" : "✗"} · magnitude {Math.abs(r.dev) <= tolerance ? "✓" : "✗"}</p>
      </div>

      <button
        type="button"
        onClick={onNext}
        className="key key-gold h-12 w-full text-base font-extrabold tracking-[0.2em]"
      >
        NEXT HAND · N
      </button>
    </div>
  );
}

/* ================================ APP ================================ */

export default function App() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [history, setHistory] = useState<HandRecord[]>(() => loadHistory());
  const [scenario, setScenario] = useState<Scenario>(() => {
    const st = loadSettings();
    return generateScenario(st.streetMode, st.stakes, st.tolerance);
  });
  const [phase, setPhase] = useState<"deal" | "revealed">("deal");
  const [sign, setSign] = useState<"+" | "-">("+");
  const [digits, setDigits] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [shake, setShake] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const dealStart = useRef(Date.now());
  const musicArmed = useRef(false);

  const streak = useMemo(() => currentStreak(history), [history]);

  /* arm music on the very first gesture (autoplay rules) */
  useEffect(() => {
    const arm = () => {
      if (musicArmed.current) return;
      musicArmed.current = true;
      if (settings.music) sound.setMusic(true);
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("keydown", arm);
    };
    window.addEventListener("pointerdown", arm);
    window.addEventListener("keydown", arm);
    return () => {
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("keydown", arm);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* scroll reveals */
  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("reveal-in")),
      { threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const newHand = useCallback(
    (st: Settings = settings) => {
      setScenario(generateScenario(st.streetMode, st.stakes, st.tolerance));
      setPhase("deal");
      setSign("+");
      setDigits("");
      setResult(null);
      dealStart.current = Date.now();
      sound.cardDeal();
    },
    [settings]
  );

  const submit = useCallback(() => {
    if (phase !== "deal" || digits.length === 0) return;
    const n = parseInt(digits, 10);
    const entered = sign === "-" && n !== 0 ? -n : n;
    const actual = scenario.actualEV;
    const dev = Math.abs(entered - actual);
    const correct = dev <= settings.tolerance;
    const signOk = entered === 0 ? actual === 0 : Math.sign(entered) === Math.sign(actual);

    const rec: HandRecord = {
      t: Date.now(),
      street: scenario.street,
      outs: scenario.draw.outs,
      drawLabel: `${scenario.draw.label} (${scenario.draw.outs} outs)`,
      pot: scenario.pot,
      bet: scenario.bet,
      actual,
      entered,
      correct,
      signOk,
      ms: Date.now() - dealStart.current,
      tolerance: settings.tolerance,
    };
    setHistory((h) => {
      const nh = [...h, rec];
      saveHistory(nh);
      return nh;
    });
    setResult({ entered, actual, correct, signOk, dev });
    setPhase("revealed");
    sound.submit();
    window.setTimeout(() => (correct ? sound.correct() : sound.wrong()), 240);
    if (!correct) setShake((x) => x + 1);
  }, [phase, digits, sign, scenario, settings.tolerance]);

  const onKey = useCallback(
    (a: KeyAction) => {
      if (phase !== "deal") return;
      switch (a.kind) {
        case "digit":
          setDigits((d) => (d.length >= 6 ? d : d + a.d));
          break;
        case "sign":
          setSign((s) => (s === "+" ? "-" : "+"));
          break;
        case "back":
          setDigits((d) => d.slice(0, -1));
          break;
        case "clear":
          setDigits("");
          setSign("+");
          break;
        case "submit":
          submit();
          break;
      }
    },
    [phase, submit]
  );

  /* physical keyboard */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (helpOpen) {
        if (e.key === "Escape") setHelpOpen(false);
        return;
      }
      if (phase === "revealed" && (e.key.toLowerCase() === "n" || e.key === "Enter")) {
        e.preventDefault();
        newHand();
        return;
      }
      if (/^[0-9]$/.test(e.key)) onKey({ kind: "digit", d: e.key });
      else if (e.key === "Backspace") onKey({ kind: "back" });
      else if (e.key === "-" || e.key === "+") onKey({ kind: "sign" });
      else if (e.key === "Enter") {
        e.preventDefault();
        onKey({ kind: "submit" });
      } else if (e.key === "Escape") onKey({ kind: "clear" });
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [helpOpen, phase, onKey, newHand]);

  const updateSettings = (patch: Partial<Settings>, regen = false) => {
    const next = { ...settings, ...patch };
    saveSettings(next);
    setSettings(next);
    if (regen) newHand(next);
  };

  const toggleMusic = () => {
    const next = !settings.music;
    sound.setMusic(next);
    updateSettings({ music: next });
    sound.uiToggle(next);
  };
  const toggleSfx = () => {
    const next = !settings.sfx;
    updateSettings({ sfx: next });
    sound.uiToggle(next);
  };

  const allTimeAcc = useMemo(() => {
    if (!history.length) return null;
    return (history.filter((r) => r.correct).length / history.length) * 100;
  }, [history]);

  const displayValue = `${sign === "-" ? "−" : "+"}€${digits || "0"}`;

  return (
    <div className="vignette relative min-h-screen overflow-x-hidden">
      {/* ambient layers */}
      <div className="tile-pattern pointer-events-none fixed inset-0 opacity-[0.05]" />
      <div className="pointer-events-none fixed -right-24 -top-24 z-0 opacity-[0.07]">
        <svg viewBox="0 0 200 200" className="spin-slow h-80 w-80 text-brass-400" fill="none" stroke="currentColor">
          <circle cx="100" cy="100" r="96" strokeWidth="2" strokeDasharray="14 10" />
          <circle cx="100" cy="100" r="62" strokeWidth="1.5" />
          <circle cx="100" cy="100" r="30" strokeWidth="1.5" strokeDasharray="4 6" />
        </svg>
      </div>
      <div className="pointer-events-none fixed -bottom-28 -left-28 z-0 opacity-[0.06]">
        <svg viewBox="0 0 200 200" className="spin-slower h-96 w-96 text-rouge-400" fill="none" stroke="currentColor">
          <circle cx="100" cy="100" r="96" strokeWidth="2" strokeDasharray="14 10" />
          <circle cx="100" cy="100" r="62" strokeWidth="1.5" />
        </svg>
      </div>

      {/* header */}
      <header className="relative z-20 border-b border-brass-500/20 bg-ink-950/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <ChipLogo />
            <div>
              <h1 className="font-display text-xl font-black leading-none tracking-wide text-cream-100 sm:text-2xl">
                EV <span className="text-brass-400">Royale</span>
              </h1>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-cream-600">
                Casino de Barcelona · EV training room
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-1.5 rounded-full border border-brass-500/25 bg-ink-950/80 px-3 py-1.5 sm:flex" title="current streak">
              <FlameIcon className={`h-4 w-4 ${streak >= 3 ? "flame-pulse text-brass-400" : "text-cream-600"}`} />
              <span className="font-mono text-sm font-bold text-cream-100">{streak}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-cream-600">streak</span>
            </div>
            {allTimeAcc !== null && (
              <div className="hidden rounded-full border border-brass-500/25 bg-ink-950/80 px-3 py-1.5 md:block">
                <span className="font-mono text-sm font-bold text-brass-300">{allTimeAcc.toFixed(0)}%</span>
                <span className="ml-1.5 text-[10px] font-bold uppercase tracking-widest text-cream-600">all-time</span>
              </div>
            )}
            <button
              type="button"
              onClick={toggleMusic}
              className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-bold uppercase tracking-wider transition ${
                settings.music
                  ? "border-brass-500/60 bg-brass-500/10 text-brass-300"
                  : "border-brass-500/20 text-cream-600 hover:text-cream-200"
              }`}
              aria-pressed={settings.music}
              title="lounge music"
            >
              <NoteIcon className="h-4 w-4" />
              {settings.music && (
                <span className="flex h-4 items-end gap-[2px]">
                  <span className="eq-bar1 w-[3px] rounded-sm bg-brass-400" />
                  <span className="eq-bar2 w-[3px] rounded-sm bg-brass-400" />
                  <span className="eq-bar3 w-[3px] rounded-sm bg-brass-400" />
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={toggleSfx}
              className={`hidden h-9 items-center rounded-lg border px-3 text-xs font-bold uppercase tracking-wider transition sm:flex ${
                settings.sfx
                  ? "border-brass-500/60 bg-brass-500/10 text-brass-300"
                  : "border-brass-500/20 text-cream-600 hover:text-cream-200"
              }`}
              aria-pressed={settings.sfx}
              title="table sounds"
            >
              <WaveIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-brass-500/25 font-display text-lg font-bold text-brass-300 transition hover:border-brass-500/70 hover:bg-brass-500/10"
              title="how to play"
              aria-label="how to play"
            >
              ?
            </button>
          </div>
        </div>
      </header>

      {/* main floor */}
      <main className="relative z-10 mx-auto grid max-w-7xl gap-6 px-4 pt-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:pt-8">
        {/* left: settings + table */}
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-brass-500/15 bg-ink-950/60 px-4 py-2.5">
            <Seg
              label="Street"
              value={settings.streetMode}
              onChange={(v) => updateSettings({ streetMode: v as StreetMode }, true)}
              options={[
                { v: "flop", label: "Flop" },
                { v: "turn", label: "Turn" },
                { v: "mix", label: "Mix" },
              ]}
            />
            <Seg
              label="Stakes"
              value={settings.stakes}
              onChange={(v) => updateSettings({ stakes: v as Stakes }, true)}
              options={[
                { v: "micro", label: "€" },
                { v: "mid", label: "€€" },
                { v: "high", label: "€€€" },
              ]}
            />
            <Seg
              label="Precision"
              value={String(settings.tolerance) as "5" | "20" | "50"}
              onChange={(v) => updateSettings({ tolerance: parseInt(v, 10) }, true)}
              options={[
                { v: "5", label: "±5 exact" },
                { v: "20", label: "±20" },
                { v: "50", label: "±50 loose" },
              ]}
            />
          </div>

          <TableScene scenario={scenario} revealed={result ? { correct: result.correct } : null} />

          <p className="mt-4 text-center text-sm text-cream-400">
            Villain bets <strong className="font-mono text-brass-300">€{scenario.bet.toLocaleString("en-US")}</strong> into{" "}
            <strong className="font-mono text-brass-300">€{scenario.pot.toLocaleString("en-US")}</strong> — is your call{" "}
            <span className="font-semibold text-felt-400">+EV</span> or <span className="font-semibold text-rouge-400">−EV</span>? Compute it,
            then lock in the number.
          </p>
        </div>

        {/* right: betting terminal */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div key={shake} className={`rounded-2xl border border-brass-500/25 bg-gradient-to-b from-ink-800 to-ink-950 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.55)] sm:p-5 ${shake ? "shake" : ""}`}>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brass-500">Betting terminal</p>
              <div className="flex gap-1.5">
                <span className="h-2 w-2 rounded-full bg-rouge-500/80" />
                <span className="h-2 w-2 rounded-full bg-brass-500/80" />
                <span className="h-2 w-2 rounded-full bg-felt-400/80" />
              </div>
            </div>

            <div className="terminal-screen mt-3 rounded-xl px-4 py-4">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-brass-500">call EV — your number</p>
                <p className="font-mono text-[10px] text-cream-600">±€{settings.tolerance} tol.</p>
              </div>
              <div className="mt-1 flex items-baseline justify-center gap-1" aria-live="polite">
                <span key={displayValue} className="ticker-up font-mono text-4xl font-bold tracking-tight text-brass-300 sm:text-[42px]">
                  {displayValue}
                </span>
                {phase === "deal" && <span className="cursor-blink -ml-1 inline-block h-8 w-[3px] rounded bg-brass-400" />}
              </div>
              <p className="mt-1 text-center font-mono text-[10.5px] text-cream-600">
                {phase === "deal" ? "positive = profitable call · negative = losing call" : "locked in — the dealer checks your math"}
              </p>
            </div>

            <div className="mt-4">
              <Keypad onAction={onKey} disabled={phase !== "deal"} canSubmit={digits.length > 0} />
            </div>

            {phase === "revealed" && result && (
              <Verdict s={scenario} r={result} tolerance={settings.tolerance} onNext={() => newHand()} />
            )}
          </div>

          {/* mini session strip */}
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-brass-500/15 bg-ink-950/60 py-2">
              <p className="font-mono text-lg font-bold text-cream-100">{history.length}</p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-cream-600">hands</p>
            </div>
            <div className="rounded-lg border border-brass-500/15 bg-ink-950/60 py-2">
              <p className="font-mono text-lg font-bold text-brass-300">{streak}</p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-cream-600">streak</p>
            </div>
            <div className="rounded-lg border border-brass-500/15 bg-ink-950/60 py-2">
              <p className="font-mono text-lg font-bold text-cream-100">
                {(() => {
                  const last = history.slice(-10);
                  if (!last.length) return "—";
                  return `${((last.filter((r) => r.correct).length / last.length) * 100).toFixed(0)}%`;
                })()}
              </p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-cream-600">last 10</p>
            </div>
          </div>
        </aside>
      </main>

      <StatsPanel
        history={history}
        onClear={() => {
          setHistory([]);
          saveHistory([]);
        }}
      />

      <footer className="relative z-10 mt-16 border-t border-brass-500/15 bg-ink-950/60 py-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 text-xs text-cream-600 sm:px-6">
          <p>
            <span className="font-display font-bold text-brass-400">EV Royale</span> — train the math, trust the math. Records live in your
            browser only.
          </p>
          <p className="flex items-center gap-2 font-mono">
            <span className="text-brass-500">♠</span> suerte y disciplina <span className="text-brass-500">♥</span> Barcelona
            <span className="text-brass-500">♦</span>
          </p>
        </div>
      </footer>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
