export class Sfx {
  muted: boolean;
  private ac: AudioContext | null = null;

  constructor(muted: boolean) {
    this.muted = muted;
  }

  start(): void {
    this.tone(660, 0.1, "sine", 0.045);
    this.tone(880, 0.14, "sine", 0.04, undefined, 0.08);
  }

  toss(): void {
    this.tone(380, 0.16, "triangle", 0.04, 150);
  }

  hit(mult: number): void {
    const base = 523 * 1.12 ** (mult - 1);
    this.tone(base, 0.16, "sine", 0.06);
    this.tone(base * 1.5, 0.2, "sine", 0.045, undefined, 0.07);
  }

  miss(): void {
    this.tone(150, 0.14, "sine", 0.04, 80);
  }

  close(): void {
    this.tone(310, 0.12, "triangle", 0.035, 190);
  }

  tick(): void {
    this.tone(880, 0.055, "square", 0.018);
  }

  end(): void {
    [523, 659, 784, 1046].forEach((note, index) => {
      this.tone(note, 0.2, "triangle", 0.045, undefined, index * 0.09);
    });
  }

  private tone(
    freq: number,
    duration: number,
    type: OscillatorType,
    gain: number,
    slideTo?: number,
    delay = 0,
  ): void {
    const ctx = this.context();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo && slideTo > 0) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t0 + duration);
    }
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(amp);
    amp.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  private context(): AudioContext | null {
    if (this.muted) return null;
    try {
      if (!this.ac) this.ac = new AudioContext();
      if (this.ac.state === "suspended") void this.ac.resume();
      return this.ac;
    } catch {
      return null;
    }
  }
}
