import { sound } from "../lib/audio";

export type KeyAction =
  | { kind: "digit"; d: string }
  | { kind: "sign" }
  | { kind: "back" }
  | { kind: "clear" }
  | { kind: "submit" };

const BackspaceIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 5H8L2 12l6 7h13a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z" />
    <path d="M12 9l6 6M18 9l-6 6" />
  </svg>
);

const PlusMinusIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
    <path d="M5 8h10M10 3v10" />
    <path d="M9 18h10" />
  </svg>
);

export function Keypad({
  onAction,
  disabled,
  canSubmit,
}: {
  onAction: (a: KeyAction) => void;
  disabled: boolean;
  canSubmit: boolean;
}) {
  const press = (a: KeyAction, gold = false) => {
    if (disabled) return;
    if (gold) sound.keyGold();
    else sound.keyTap();
    onAction(a);
  };

  const digitBtn = (d: string) => (
    <button
      key={d}
      type="button"
      disabled={disabled}
      onClick={() => press({ kind: "digit", d })}
      className="key h-14 rounded-lg text-2xl font-semibold disabled:opacity-40"
      aria-label={`digit ${d}`}
    >
      {d}
    </button>
  );

  return (
    <div className="select-none">
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => press({ kind: "sign" })}
          className="key h-12 rounded-lg text-brass-300 disabled:opacity-40"
          aria-label="toggle sign"
          title="Toggle + / −"
        >
          <span className="flex items-center justify-center"><PlusMinusIcon /></span>
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => press({ kind: "clear" })}
          className="key key-rouge h-12 rounded-lg text-lg font-bold disabled:opacity-40"
          aria-label="clear entry"
        >
          C
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => press({ kind: "back" })}
          className="key h-12 rounded-lg text-brass-300 disabled:opacity-40"
          aria-label="backspace"
        >
          <span className="flex items-center justify-center"><BackspaceIcon /></span>
        </button>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        {["7", "8", "9", "4", "5", "6", "1", "2", "3"].map(digitBtn)}
        <button
          type="button"
          disabled={disabled}
          onClick={() => press({ kind: "digit", d: "0" })}
          className="key col-span-3 h-14 rounded-lg text-2xl font-semibold disabled:opacity-40"
          aria-label="digit 0"
        >
          0
        </button>
      </div>

      <button
        type="button"
        disabled={disabled || !canSubmit}
        onClick={() => press({ kind: "submit" }, true)}
        className="key key-gold gold-pulse mt-3 h-14 w-full rounded-lg text-lg font-extrabold tracking-[0.18em] disabled:opacity-40 disabled:saturate-50"
      >
        LOCK IN EV
      </button>
      <p className="mt-2 text-center font-mono text-[11px] tracking-wide text-cream-600">
        ⏎ enter locks in · ± minus toggles sign · ⌫ deletes
      </p>
    </div>
  );
}
