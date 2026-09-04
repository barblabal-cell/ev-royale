/* ------------------------------------------------------------------ */
/*  EV Royale — scenario engine                                        */
/*  Builds training hands: hole cards + board that genuinely match     */
/*  the announced draw, clean pot/bet sizes, integer EV targets.       */
/* ------------------------------------------------------------------ */

export type Suit = "s" | "h" | "d" | "c";
export type Street = "flop" | "turn";
export type StreetMode = "flop" | "turn" | "mix";
export type Stakes = "micro" | "mid" | "high";
export type DrawKey =
  | "gutshot"
  | "overcards"
  | "oesd"
  | "flush"
  | "flushoc"
  | "flushoesd";

export interface CardT {
  rank: number; // 2..14 (14 = Ace)
  suit: Suit;
}

export interface DrawDef {
  key: DrawKey;
  label: string;
  short: string;
  outs: number;
}

export const DRAWS: DrawDef[] = [
  { key: "gutshot", label: "Gutshot straight draw", short: "Gutshot", outs: 4 },
  { key: "overcards", label: "Two overcards", short: "Overcards", outs: 6 },
  { key: "oesd", label: "Open-ended straight draw", short: "OESD", outs: 8 },
  { key: "flush", label: "Flush draw", short: "Flush draw", outs: 9 },
  { key: "flushoc", label: "Flush + gutshot straight", short: "Flush + gut", outs: 12 },
  { key: "flushoesd", label: "Combo: flush + OESD", short: "Combo draw", outs: 15 },
];

export interface Scenario {
  id: string;
  createdAt: number;
  street: Street;
  draw: DrawDef;
  hand: CardT[];
  board: CardT[]; // 3 cards (flop) or 4 (turn)
  pot: number; // pot before villain's bet
  bet: number; // villain's bet = our call amount
  equity: number; // percent, rule of 4 & 2
  actualEV: number; // integer €
}

export const RANK_LABEL: Record<number, string> = {
  2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9",
  10: "10", 11: "J", 12: "Q", 13: "K", 14: "A",
};

export const SUIT_SYMBOL: Record<Suit, string> = { s: "♠", h: "♥", d: "♦", c: "♣" };
export const SUIT_NAME: Record<Suit, string> = { s: "Spades", h: "Hearts", d: "Diamonds", c: "Clubs" };

export function cardName(c: CardT): string {
  return `${RANK_LABEL[c.rank]}${SUIT_SYMBOL[c.suit]}`;
}

const c = (rank: number, suit: Suit): CardT => ({ rank, suit });
const rnd = (n: number) => Math.floor(Math.random() * n);
const pick = <T,>(arr: T[]): T => arr[rnd(arr.length)];
const SUITS: Suit[] = ["s", "h", "d", "c"];

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/* ------------------------- outs validation ------------------------- */

function hasRun(sorted: number[]): boolean {
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    run = sorted[i] === sorted[i - 1] + 1 ? run + 1 : 1;
    if (run >= 5) return true;
  }
  return false;
}

/** every rank that would complete a straight given these cards */
function straightOutRanks(cards: CardT[]): Set<number> {
  const ranks = cards.map((cd) => cd.rank);
  const used = new Set(ranks);
  const outs = new Set<number>();
  for (let r = 2; r <= 14; r++) {
    if (used.has(r)) continue;
    const all = [...new Set([...ranks, r])].sort((a, b) => a - b);
    const wheel = [...new Set(all.map((x) => (x === 14 ? 1 : x)))].sort((a, b) => a - b);
    if (hasRun(all) || hasRun(wheel)) outs.add(r);
  }
  return outs;
}

/** visible cards must produce exactly the declared outs — no hidden extras, no missing ones */
function cardsAreClean(hand: CardT[], board: CardT[], outsRanks: number[], flushKey: boolean): boolean {
  const suitCount: Record<string, number> = {};
  [...hand, ...board].forEach((cd) => (suitCount[cd.suit] = (suitCount[cd.suit] ?? 0) + 1));
  // flush draws intentionally hold 4 of a suit; everything else must stay ≤ 3 (no accidental 4-flush)
  const maxSuit = flushKey ? 4 : 3;
  if (Object.values(suitCount).some((n) => n > maxSuit)) return false;

  const actual = straightOutRanks([...hand, ...board]);
  const declared = new Set(outsRanks);
  if (actual.size !== declared.size) return false;
  for (const r of actual) if (!declared.has(r)) return false;
  return true;
}

/* ----------- card construction per draw (declares its outs) ---------- */

interface BuiltCards {
  hand: CardT[];
  board: CardT[];
  outsRanks: number[]; // ranks that complete the announced draw
}

function buildCards(draw: DrawKey, street: Street): BuiltCards {
  switch (draw) {
    case "gutshot": {
      // hand r,r+1 · board r+3,r+4,k → only r+2 completes (4 outs)
      const r = 2 + rnd(8); // 2..9
      const k = r <= 4 ? 10 : 3;
      const fs = shuffle(SUITS);
      const hand = [c(r, fs[0]), c(r + 1, fs[1])];
      const board = [c(r + 3, fs[2]), c(r + 4, fs[3]), c(k, fs[0])];
      const outsRanks = [r + 2];
      return { hand, outsRanks, board: withTurn(board, street, [...usedOf(hand, board), ...outsRanks], [fs[1]]) };
    }
    case "overcards": {
      // A-K over a low scattered board (6 outs: three aces, three kings)
      const boards = [
        [2, 7, 9], [2, 5, 8], [3, 7, 9], [2, 6, 9], [3, 6, 8], [2, 7, 5],
      ];
      const ranks = pick(boards);
      const hand = [c(14, "s"), c(13, "h")];
      const board = [c(ranks[0], "d"), c(ranks[1], "c"), c(ranks[2], "s")];
      return { hand, outsRanks: [], board: withTurn(board, street, [...usedOf(hand, board)], ["h"]) };
    }
    case "oesd": {
      // hand r,r+1 · board r+2,r+3,k → r-1 and r+4 complete (8 outs)
      const r = 4 + rnd(6); // 4..9
      const k = r <= 5 ? 13 : 2;
      const fs = shuffle(SUITS);
      const hand = [c(r, fs[0]), c(r + 1, fs[1])];
      const board = [c(r + 2, fs[2]), c(r + 3, fs[3]), c(k, fs[0])];
      const outsRanks = [r - 1, r + 4];
      return { hand, outsRanks, board: withTurn(board, street, [...usedOf(hand, board), ...outsRanks], [fs[1]]) };
    }
    case "flush": {
      const fs = pick(SUITS);
      const off = pick(SUITS.filter((x) => x !== fs));
      const hand = [c(9, fs), c(8, fs)];
      const board = [c(13, fs), c(5, fs), c(2, off)];
      return { hand, outsRanks: [], board: withTurn(board, street, usedOf(hand, board), []) };
    }
    case "flushoc": {
      // suited Q-J over A-K of the same suit + low card: 9 flush + 4 gutshot − 1 overlap = 12
      const fs = pick(SUITS);
      const off = pick(SUITS.filter((x) => x !== fs));
      const hand = [c(12, fs), c(11, fs)];
      const board = [c(14, fs), c(13, fs), c(2 + rnd(3), off)];
      const outsRanks = [10];
      return { hand, outsRanks, board: withTurn(board, street, [...usedOf(hand, board), ...outsRanks], []) };
    }
    case "flushoesd": {
      // suited J-T on 9-8 two-flush board: 9 flush + 8 straight − 2 overlap = 15
      const fs = pick(SUITS);
      const off = pick(SUITS.filter((x) => x !== fs));
      const hand = [c(11, fs), c(10, fs)];
      const board = [c(9, fs), c(8, fs), c(2, off)];
      const outsRanks = [7, 12];
      return { hand, outsRanks, board: withTurn(board, street, [...usedOf(hand, board), ...outsRanks], []) };
    }
  }
}

const usedOf = (hand: CardT[], board: CardT[]): number[] => [...hand, ...board].map((cd) => cd.rank);

/** Adds a safe turn card (never completes nor counterfeits the draw). */
function withTurn(board: CardT[], street: Street, excludedRanks: number[], avoidSuits: Suit[]): CardT[] {
  if (street !== "turn") return board;
  const excluded = new Set(excludedRanks);
  const pool: number[] = [];
  for (let r = 2; r <= 14; r++) if (!excluded.has(r)) pool.push(r);
  const rank = pick(pool);
  // never create a 4-flush: count suits already in play
  const counts: Record<string, number> = { s: 0, h: 0, d: 0, c: 0 };
  board.forEach((cd) => counts[cd.suit]++);
  const legal = SUITS.filter((s) => !avoidSuits.includes(s) && counts[s] < 3);
  const suit = pick(legal.length ? legal : SUITS.filter((s) => counts[s] < 3));
  return [...board, c(rank, suit)];
}

/* --------------------------- sizing & EV --------------------------- */

const STAKES_RANGE: Record<Stakes, { potMin: number; potMax: number; potStep: number; minBet: number; minMag: number }> = {
  micro: { potMin: 40, potMax: 180, potStep: 10, minBet: 10, minMag: 30 },
  mid: { potMin: 150, potMax: 750, potStep: 25, minBet: 25, minMag: 60 },
  high: { potMin: 600, potMax: 2600, potStep: 50, minBet: 50, minMag: 150 },
};

/** equity via the Rule of 4 (flop) and Rule of 2 (turn) */
export function equityFor(outs: number, street: Street): number {
  return Math.min(96, outs * (street === "flop" ? 4 : 2));
}

/** EV of a call = equity × (pot + 2·bet) − bet, rounded to whole €. */
export function callEV(equity: number, pot: number, bet: number): number {
  return Math.round((equity / 100) * (pot + 2 * bet) - bet);
}

/** Pot-odds breakeven equity, in %. */
export function requiredEquity(pot: number, bet: number): number {
  return (bet / (pot + 2 * bet)) * 100;
}

/** exact hitting chance: two cards to come on the flop, one on the turn */
export function exactEquity(outs: number, street: Street): number {
  const miss = street === "flop"
    ? ((47 - outs) * (46 - outs)) / (47 * 46)
    : (47 - outs) / 47;
  return (1 - miss) * 100;
}

/* ------------- outs breakdown for the coach explanation ------------- */

export interface OutsGroup {
  label: string;
  cards: CardT[];
  note?: string;
}

/** the real, enumerable cards that complete the announced draw — grouped by category */
export function outsBreakdown(s: Scenario): { groups: OutsGroup[]; total: number } {
  const all = [...s.hand, ...s.board];
  const usedKeys = new Set(all.map((cd) => `${cd.rank}${cd.suit}`));
  const unseenWhere = (pred: (cd: CardT) => boolean): CardT[] => {
    const out: CardT[] = [];
    for (let r = 2; r <= 14; r++) {
      for (const suit of SUITS) {
        if (!usedKeys.has(`${r}${suit}`) && pred({ rank: r, suit })) out.push({ rank: r, suit });
      }
    }
    return out;
  };

  const key = s.draw.key;
  const groups: OutsGroup[] = [];
  const straightRanks = [...straightOutRanks(all)].sort((a, b) => a - b);
  const flushSuit = s.hand[0].suit === s.hand[1].suit ? s.hand[0].suit : null;
  const isFlush = key === "flush" || key === "flushoc" || key === "flushoesd";

  if (isFlush && flushSuit) {
    groups.push({
      label: `any remaining ${SUIT_NAME[flushSuit].toLowerCase()} completes the flush`,
      cards: unseenWhere((cd) => cd.suit === flushSuit),
    });
  }
  if (straightRanks.length) {
    const cards = unseenWhere((cd) => straightRanks.includes(cd.rank));
    const overlap = flushSuit && isFlush ? cards.filter((cd) => cd.suit === flushSuit) : [];
    groups.push({
      label: `a ${straightRanks.map((r) => RANK_LABEL[r]).join(" or ")} completes the straight`,
      cards,
      note: overlap.length
        ? `${overlap.map(cardName).join(" and ")} also make the flush — count them once`
        : undefined,
    });
  }
  const maxBoard = Math.max(...s.board.map((cd) => cd.rank));
  const overRanks = [...new Set(s.hand.map((cd) => cd.rank))]
    .filter((r) => r > maxBoard && !straightRanks.includes(r))
    .sort((a, b) => b - a);
  if (overRanks.length && key === "overcards") {
    groups.push({
      label: `an ${overRanks.map((r) => RANK_LABEL[r]).join(" or ")} pairs up top`,
      cards: unseenWhere((cd) => overRanks.includes(cd.rank)),
    });
  }

  const union = new Set<string>();
  groups.forEach((g) => g.cards.forEach((cd) => union.add(`${cd.rank}${cd.suit}`)));
  return { groups, total: union.size };
}

export function generateScenario(mode: StreetMode, stakes: Stakes, tolerance: number): Scenario {
  const street: Street = mode === "mix" ? (Math.random() < 0.5 ? "flop" : "turn") : mode;

  // draw + cards, regenerated until the visible outs are exactly the declared ones
  const FLUSH_KEYS: DrawKey[] = ["flush", "flushoc", "flushoesd"];
  let built: BuiltCards = buildCards("flush", street);
  let draw = DRAWS[3];
  for (let i = 0; i < 80; i++) {
    draw = pick(DRAWS);
    built = buildCards(draw.key, street);
    if (cardsAreClean(built.hand, built.board, built.outsRanks, FLUSH_KEYS.includes(draw.key))) break;
  }

  const equity = equityFor(draw.outs, street);
  const cfg = STAKES_RANGE[stakes];
  const floorMag = Math.max(cfg.minMag, tolerance * 2 + 15);

  let pot = cfg.potMin;
  let bet = cfg.minBet;
  let ev = 0;

  for (let i = 0; i < 200; i++) {
    const steps = (cfg.potMax - cfg.potMin) / cfg.potStep;
    pot = cfg.potMin + rnd(steps + 1) * cfg.potStep;
    const frac = 0.35 + Math.random() * 0.65; // bet 35%–100% of pot
    const raw = pot * frac;
    const unit = stakes === "high" ? 25 : 5;
    bet = Math.max(cfg.minBet, Math.min(pot, Math.round(raw / unit) * unit));
    ev = callEV(equity, pot, bet);
    if (Math.abs(ev) >= floorMag) break;
  }

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    street,
    draw,
    hand: built.hand,
    board: built.board,
    pot,
    bet,
    equity,
    actualEV: ev,
  };
}

/* ------------- chip decomposition for the table stacks ------------- */

export const CHIP_DENOMS = [
  { value: 500, color: "#7d3c98", light: "#a569bd" },
  { value: 100, color: "#1c2833", light: "#5d6d7e" },
  { value: 25, color: "#1e8449", light: "#52be80" },
  { value: 5, color: "#b03a2e", light: "#e74c3c" },
];

export function decomposeChips(amount: number): { value: number; count: number; color: string; light: string }[] {
  let rest = amount;
  const out: { value: number; count: number; color: string; light: string }[] = [];
  for (const d of CHIP_DENOMS) {
    if (rest <= 0) break;
    const count = Math.floor(rest / d.value);
    if (count > 0) {
      out.push({ value: d.value, count, color: d.color, light: d.light });
      rest -= count * d.value;
    }
  }
  return out;
}
