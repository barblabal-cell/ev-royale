/* ------------------------------------------------------------------ */
/*  EV Royale — sound engine                                           */
/*  Generative bossa-lounge loop (upbeat but laid-back) + table SFX.   */
/*  Everything is synthesized with WebAudio: no assets, no requests.   */
/* ------------------------------------------------------------------ */

type Ctx = AudioContext;

const BPM = 76;
const EIGHTH = 60 / BPM / 2; // seconds per 8th note
const SWING = 0.16;

// Fmaj7 → Dm9 → Gm7 → C9 : bright, warm, resolved
const CHORDS: number[][] = [
  [174.61, 220.0, 261.63, 329.63], // Fmaj7  (F3 A3 C4 E4)
  [146.83, 174.61, 220.0, 261.63, 329.63], // Dm9
  [196.0, 233.08, 293.66, 349.23], // Gm7
  [164.81, 196.0, 233.08, 293.66], // C9
];
const BASS_ROOTS = [87.31, 73.42, 98.0, 65.41]; // F2 D2 G2 C2
const BASS_FIFTHS = [130.81, 110.0, 146.83, 98.0];

class SoundEngine {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private timer: number | null = null;
  private nextBarTime = 0;
  private barIdx = 0;
  private volume = 0.7;
  private musicOn = false;

  private ensure(): Ctx | null {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return this.ctx;
    }
    try {
      const AC: typeof AudioContext | undefined =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      const ctx = new AC();
      const master = ctx.createGain();
      master.gain.value = this.volume;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -20;
      comp.ratio.value = 6;
      master.connect(comp);
      comp.connect(ctx.destination);

      const musicBus = ctx.createGain();
      musicBus.gain.value = 0;
      const musicLp = ctx.createBiquadFilter();
      musicLp.type = "lowpass";
      musicLp.frequency.value = 3600;
      musicBus.connect(musicLp);
      musicLp.connect(master);

      const sfxBus = ctx.createGain();
      sfxBus.gain.value = 0.9;
      sfxBus.connect(master);

      const len = Math.floor(ctx.sampleRate * 1);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

      this.ctx = ctx;
      this.master = master;
      this.musicBus = musicBus;
      this.sfxBus = sfxBus;
      this.noiseBuf = buf;
      return ctx;
    } catch {
      return null;
    }
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
    }
  }

  /* ------------------------- music ------------------------- */

  setMusic(on: boolean): void {
    this.musicOn = on;
    if (on) {
      const ctx = this.ensure();
      if (!ctx || !this.musicBus) return;
      this.musicBus.gain.setTargetAtTime(0.5, ctx.currentTime, 0.4);
      if (this.timer === null) {
        this.nextBarTime = ctx.currentTime + 0.1;
        this.barIdx = 0;
        this.timer = window.setInterval(() => this.pump(), 40);
      }
    } else if (this.ctx && this.musicBus) {
      this.musicBus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
      if (this.timer !== null) {
        window.clearInterval(this.timer);
        this.timer = null;
      }
    }
  }

  private pump(): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicOn) return;
    while (this.nextBarTime < ctx.currentTime + 0.25) {
      this.scheduleBar(this.barIdx, this.nextBarTime);
      this.nextBarTime += EIGHTH * 8;
      this.barIdx = (this.barIdx + 1) % 8; // 2 passes of the 4-bar loop
    }
  }

  private slotTime(barStart: number, slot: number): number {
    return barStart + slot * EIGHTH + (slot % 2 === 1 ? EIGHTH * SWING : 0);
  }

  private scheduleBar(bar: number, t: number): void {
    const ci = bar % 4;
    const chord = CHORDS[ci];
    const secondPass = bar >= 4;

    // walking bossa bass: root on 1, fifth on the "and" of 2
    this.bass(this.slotTime(t, 0), BASS_ROOTS[ci], EIGHTH * 2.6);
    this.bass(this.slotTime(t, 3), BASS_FIFTHS[ci], EIGHTH * 2.2);
    if (secondPass && ci === 3) this.bass(this.slotTime(t, 6), BASS_FIFTHS[ci] * 1.5, EIGHTH * 1.6);

    // guitar-style comping, syncopated
    this.pluckChord(this.slotTime(t, 2), [chord[1 % chord.length], chord[3 % chord.length]]);
    this.pluckChord(this.slotTime(t, 5), [chord[0], chord[2 % chord.length], chord[3 % chord.length]]);
    if (ci % 2 === 1 || secondPass) {
      this.pluckChord(this.slotTime(t, 7), [chord[2 % chord.length]], 0.035);
    }

    // airy pad: root + fifth an octave up, whole bar
    this.pad(t, [BASS_ROOTS[ci] * 2, BASS_FIFTHS[ci] * 2], EIGHTH * 8);

    // shaker eighths + rim clicks on beats 2 & 4
    for (let s = 0; s < 8; s++) {
      this.shaker(this.slotTime(t, s), s % 2 === 0 ? 0.02 : 0.011);
    }
    this.rim(this.slotTime(t, 2));
    this.rim(this.slotTime(t, 6));

    // tiny sparkle on the turnaround
    if (ci === 3) this.pluck(this.slotTime(t, 7) + EIGHTH * 0.5, 1318.5, 0.5, 0.028, "sine");
  }

  /* ------------------------- voices ------------------------- */

  private pluck(t: number, freq: number, dur: number, gain: number, type: OscillatorType): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2400;
    osc.connect(lp).connect(g).connect(this.musicBus);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private pluckChord(t: number, freqs: number[], gain = 0.05): void {
    freqs.forEach((f, i) => this.pluck(t + i * 0.028, f, 0.42, gain, "triangle"));
  }

  private bass(t: number, freq: number, dur: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.13, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.musicBus);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private pad(t: number, freqs: number[], dur: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    freqs.forEach((f) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.016, t + dur * 0.3);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      osc.connect(g).connect(this.musicBus!);
      osc.start(t);
      osc.stop(t + dur + 0.1);
    });
  }

  private noiseHit(t: number, dur: number, gain: number, filterType: BiquadFilterType, freq: number, q = 1): void {
    const ctx = this.ctx;
    if (!ctx || !this.noiseBuf) return;
    const bus = this.musicBus;
    if (!bus) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(bus);
    src.start(t, Math.random() * 0.4);
    src.stop(t + dur + 0.02);
  }

  private shaker(t: number, gain: number): void {
    this.noiseHit(t, 0.05, gain, "highpass", 6800);
  }

  private rim(t: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    this.noiseHit(t, 0.04, 0.05, "bandpass", 2300, 6);
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(640, t);
    osc.frequency.exponentialRampToValueAtTime(320, t + 0.04);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.04, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    osc.connect(g).connect(this.musicBus);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  /* ------------------------- SFX ------------------------- */

  private sfxTone(freq: number, dur: number, gain: number, type: OscillatorType, when = 0, slideTo?: number): void {
    const ctx = this.ensure();
    if (!ctx || !this.sfxBus) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private sfxNoise(dur: number, gain: number, type: BiquadFilterType, freq: number, when = 0, q = 1): void {
    const ctx = this.ensure();
    if (!ctx || !this.noiseBuf || !this.sfxBus) return;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t, Math.random() * 0.3);
    src.stop(t + dur + 0.02);
  }

  keyTap(): void {
    this.sfxTone(620 + Math.random() * 140, 0.05, 0.07, "triangle");
  }
  keyGold(): void {
    this.sfxTone(520, 0.09, 0.09, "triangle");
    this.sfxTone(780, 0.12, 0.07, "triangle", 0.05);
  }
  cardDeal(): void {
    this.sfxNoise(0.1, 0.16, "bandpass", 2600, 0, 1.2);
  }
  chipStack(): void {
    this.sfxTone(2350, 0.02, 0.07, "square");
    this.sfxTone(1950, 0.02, 0.07, "square", 0.055);
    this.sfxNoise(0.04, 0.05, "highpass", 5000, 0.055);
  }
  submit(): void {
    this.sfxNoise(0.26, 0.09, "lowpass", 1200);
    this.sfxTone(392, 0.16, 0.06, "sine", 0.02);
  }
  correct(): void {
    const notes = [659.25, 880.0, 1318.5];
    notes.forEach((n, i) => this.sfxTone(n, 0.4, 0.11, "sine", i * 0.085));
    this.sfxTone(1760, 0.5, 0.05, "triangle", 0.28);
    this.chipStack();
  }
  wrong(): void {
    this.sfxTone(160, 0.3, 0.12, "sawtooth", 0, 72);
    this.sfxTone(88, 0.28, 0.1, "sine", 0.02);
  }
  uiToggle(on: boolean): void {
    this.sfxTone(on ? 700 : 440, 0.08, 0.06, "sine");
  }
}

export const sound = new SoundEngine();
