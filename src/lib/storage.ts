import type { Stakes, Street, StreetMode } from "./poker";

/* ------------------------------------------------------------------ */
/*  Records & settings persistence (localStorage, failure-safe)        */
/* ------------------------------------------------------------------ */

export interface HandRecord {
  t: number; // timestamp ms
  street: Street;
  outs: number;
  drawLabel: string;
  pot: number;
  bet: number;
  actual: number;
  entered: number;
  correct: boolean;
  signOk: boolean; // got the +EV / −EV direction right
  ms: number; // thinking time
  tolerance: number;
}

export interface Settings {
  streetMode: StreetMode;
  stakes: Stakes;
  tolerance: number; // 5 | 20 | 50
  music: boolean;
  sfx: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  streetMode: "mix",
  stakes: "mid",
  tolerance: 20,
  music: true,
  sfx: true,
};

const HIST_KEY = "evroyale.history.v1";
const SET_KEY = "evroyale.settings.v1";

export function loadHistory(): HandRecord[] {
  try {
    const raw = localStorage.getItem(HIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HandRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveHistory(h: HandRecord[]): void {
  try {
    localStorage.setItem(HIST_KEY, JSON.stringify(h.slice(-5000)));
  } catch {
    /* storage full / unavailable — play on */
  }
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SET_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(SET_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/*  Rank ladder                                                        */
/* ------------------------------------------------------------------ */

export interface Rank {
  name: string;
  es: string;
  min: number; // correct answers needed
}

export const RANKS: Rank[] = [
  { name: "The Fish", es: "El Pez", min: 0 },
  { name: "Grinder", es: "El Currito", min: 25 },
  { name: "The Regular", es: "El Habitual", min: 75 },
  { name: "The Shark", es: "El Tiburón", min: 200 },
  { name: "High Roller", es: "Alto Voltaje", min: 450 },
  { name: "Casino Boss", es: "El Jefe del Casino", min: 900 },
];

export function rankFor(correctTotal: number): { current: Rank; next: Rank | null; progress: number } {
  let current = RANKS[0];
  let next: Rank | null = null;
  for (let i = 0; i < RANKS.length; i++) {
    if (correctTotal >= RANKS[i].min) {
      current = RANKS[i];
      next = RANKS[i + 1] ?? null;
    }
  }
  const progress = next
    ? (correctTotal - current.min) / (next.min - current.min)
    : 1;
  return { current, next, progress: Math.max(0, Math.min(1, progress)) };
}

/* ------------------------------------------------------------------ */
/*  Range statistics                                                   */
/* ------------------------------------------------------------------ */

export type RangeKey = "week" | "month" | "year" | "all";

export interface Bucket {
  label: string;
  attempts: number;
  correct: number;
}

export interface RangeStats {
  range: RangeKey;
  attempts: number;
  correct: number;
  accuracy: number; // 0..100
  signAccuracy: number;
  avgDev: number; // mean |entered − actual|
  avgMs: number;
  bestStreak: number;
  netEV: number; // sum of actual EVs faced (context)
  buckets: Bucket[];
}

const DAY = 86_400_000;
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function inRange(t: number, range: RangeKey, now: number): boolean {
  if (range === "all") return true;
  const d = new Date(now);
  if (range === "week") return t >= now - 7 * DAY && t <= now + DAY;
  if (range === "month") return t >= now - 30 * DAY && t <= now + DAY;
  // year
  return t >= now - 365 * DAY && t <= now + DAY && new Date(t).getFullYear() >= d.getFullYear() - 1;
}

function bucketKey(t: number, range: RangeKey): string {
  const d = new Date(t);
  if (range === "week" || range === "month") {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function bucketLabels(range: RangeKey, now: number): Bucket[] {
  const out: Bucket[] = [];
  if (range === "week") {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * DAY);
      out.push({
        label: `${DAY_NAMES[d.getDay()]} ${d.getDate()}`,
        attempts: 0,
        correct: 0,
      });
    }
  } else if (range === "month") {
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * DAY);
      out.push({
        label: i % 5 === 0 ? `${d.getDate()}/${d.getMonth() + 1}` : "",
        attempts: 0,
        correct: 0,
      });
    }
  } else if (range === "year") {
    const d = new Date(now);
    for (let i = 11; i >= 0; i--) {
      const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
      out.push({ label: `${MONTH_NAMES[m.getMonth()]}`, attempts: 0, correct: 0 });
    }
  } else {
    // all time: from first record (max 24 months back)
    return out; // filled by caller
  }
  return out;
}

export function computeStats(history: HandRecord[], range: RangeKey, now = Date.now()): RangeStats {
  const recs = history.filter((r) => inRange(r.t, range, now)).sort((a, b) => a.t - b.t);

  let buckets = bucketLabels(range, now);
  if (range === "all") {
    const map = new Map<string, Bucket>();
    recs.forEach((r) => {
      const k = bucketKey(r.t, range);
      if (!map.has(k)) {
        const d = new Date(r.t);
        map.set(k, { label: `${MONTH_NAMES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, attempts: 0, correct: 0 });
      }
      const b = map.get(k)!;
      b.attempts++;
      if (r.correct) b.correct++;
    });
    buckets = [...map.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([, v]) => v)
      .slice(-24);
  } else {
    const idx = new Map<string, number>();
    buckets.forEach((b, i) => {
      // rebuild the key the same way bucketKey does
      const d = new Date(now - (range === "week" ? 6 - i : range === "month" ? 29 - i : 0) * DAY);
      if (range === "week" || range === "month") idx.set(bucketKey(d.getTime(), range), i);
      else idx.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, i);
    });
    recs.forEach((r) => {
      const i = idx.get(bucketKey(r.t, range));
      if (i !== undefined) {
        buckets[i].attempts++;
        if (r.correct) buckets[i].correct++;
      }
    });
  }

  const attempts = recs.length;
  const correct = recs.filter((r) => r.correct).length;
  const signOk = recs.filter((r) => r.signOk).length;
  const avgDev = attempts ? recs.reduce((s, r) => s + Math.abs(r.entered - r.actual), 0) / attempts : 0;
  const avgMs = attempts ? recs.reduce((s, r) => s + r.ms, 0) / attempts : 0;

  let bestStreak = 0;
  let cur = 0;
  recs.forEach((r) => {
    cur = r.correct ? cur + 1 : 0;
    if (cur > bestStreak) bestStreak = cur;
  });

  return {
    range,
    attempts,
    correct,
    accuracy: attempts ? (correct / attempts) * 100 : 0,
    signAccuracy: attempts ? (signOk / attempts) * 100 : 0,
    avgDev,
    avgMs,
    bestStreak,
    netEV: recs.reduce((s, r) => s + r.actual, 0),
    buckets,
  };
}

/** stats of the period immediately before the given range (for deltas) */
export function computePreviousStats(history: HandRecord[], range: RangeKey, now = Date.now()): RangeStats | null {
  if (range === "all") return null;
  const span = range === "week" ? 7 * DAY : range === "month" ? 30 * DAY : 365 * DAY;
  const shifted = history.filter((r) => r.t >= now - 2 * span && r.t < now - span);
  if (!shifted.length) return null;
  return computeStats(shifted.map((r) => ({ ...r, t: r.t + span })), range, now);
}

export function currentStreak(history: HandRecord[]): number {
  let s = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].correct) s++;
    else break;
  }
  return s;
}

export function bestStreakEver(history: HandRecord[]): number {
  let best = 0;
  let cur = 0;
  history.forEach((r) => {
    cur = r.correct ? cur + 1 : 0;
    if (cur > best) best = cur;
  });
  return best;
}
