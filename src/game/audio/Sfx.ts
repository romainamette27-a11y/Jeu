export class Sfx {
  private ctx: AudioContext | null = null;

  unlock(): void {
    this.ensure();
    void this.ctx?.resume().catch(() => {});
  }

  dispatch(): void {
    this.chirp(880, 0.09, 0);
    this.chirp(1320, 0.09, 0.14);
  }

  complete(): void {
    this.chirp(660, 0.08, 0);
    this.chirp(990, 0.14, 0.11);
  }

  private chirp(freq: number, dur: number, delay: number): void {
    this.ensure();
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;

    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.06, t0 + 0.01);
    gain.gain.linearRampToValueAtTime(0, t0 + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private ensure(): void {
    if (this.ctx) return;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctor) this.ctx = new Ctor();
  }
}
