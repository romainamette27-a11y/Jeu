export class Engine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private low: OscillatorNode | null = null;
  private high: OscillatorNode | null = null;
  private unlocked = false;

  unlock(): void {
    if (!this.unlocked) {
      this.ensureContext();
      this.unlocked = true;
    }
    void this.ctx?.resume().catch(() => {});
  }

  setLevel(speedRatio: number, active: boolean): void {
    if (!this.ctx || !this.master || !this.low || !this.high) return;
    if (this.ctx.state !== 'running') return;

    const t = this.ctx.currentTime;
    const ratio = Math.max(0, Math.min(1, speedRatio));
    const freq = 45 + ratio * 105;

    this.low.frequency.setTargetAtTime(freq, t, 0.12);
    this.high.frequency.setTargetAtTime(freq * 2.51, t, 0.12);
    const target = active ? (0.028 + ratio * 0.05) * (ratio > 0.02 ? 1.15 : 1) : 0.028;
    this.master.gain.setTargetAtTime(active ? target : 0, t, active ? 0.25 : 0.4);
  }

  suspend(): void {
    void this.ctx?.suspend().catch(() => {});
  }

  resume(): void {
    void this.ctx?.resume().catch(() => {});
  }

  dispose(): void {
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.master = null;
    this.low = null;
    this.high = null;
    this.unlocked = false;
  }

  private ensureContext(): void {
    if (this.ctx) return;

    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;

    const ctx = new Ctor();
    const master = ctx.createGain();
    master.gain.value = 0;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    filter.Q.value = 0.8;

    const low = ctx.createOscillator();
    low.type = 'sawtooth';
    low.frequency.value = 45;

    const high = ctx.createOscillator();
    high.type = 'square';
    high.frequency.value = 113;
    const highGain = ctx.createGain();
    highGain.gain.value = 0.14;
    high.connect(highGain);

    low.connect(filter);
    highGain.connect(filter);
    filter.connect(master);
    master.connect(ctx.destination);

    low.start();
    high.start();

    this.ctx = ctx;
    this.master = master;
    this.low = low;
    this.high = high;
  }
}
