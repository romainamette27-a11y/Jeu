export class Siren {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = false;

  setEnabled(enabled: boolean): void {
    if (enabled === this.enabled) return;
    if (enabled) {
      this.start();
    } else {
      this.stop();
    }
  }

  suspend(): void {
    void this.ctx?.suspend().catch(() => {});
  }

  resume(): void {
    if (this.enabled) void this.ctx?.resume().catch(() => {});
  }

  private start(): void {
    this.ensureContext();
    if (!this.ctx || !this.master) return;
    void this.ctx.resume();
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.setTargetAtTime(0.055, this.ctx.currentTime, 0.15);
    this.enabled = true;
  }

  private stop(): void {
    if (!this.ctx || !this.master) return;
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
    this.enabled = false;
  }

  dispose(): void {
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
  }

  private ensureContext(): void {
    if (this.ctx) return;

    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;

    const ctx = new Ctor();
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    const base = ctx.createOscillator();
    base.type = 'triangle';
    base.frequency.value = 880;

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.42;

    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 360;
    lfo.connect(lfoGain);
    lfoGain.connect(base.frequency);

    const overtone = ctx.createOscillator();
    overtone.type = 'sawtooth';
    overtone.frequency.value = 880;

    const overtoneGain = ctx.createGain();
    overtoneGain.gain.value = 0.25;
    overtone.connect(overtoneGain);
    overtoneGain.connect(master);

    const lfoGain2 = ctx.createGain();
    lfoGain2.gain.value = 180;
    lfo.connect(lfoGain2);
    lfoGain2.connect(overtone.frequency);

    base.connect(master);
    base.start();
    overtone.start();
    lfo.start();

    this.ctx = ctx;
    this.master = master;
  }
}
