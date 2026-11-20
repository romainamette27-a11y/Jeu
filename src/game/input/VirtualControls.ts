import type { DriveInput, InputManager } from './InputManager';

export class VirtualControls {
  private root: HTMLElement;
  private input: InputManager;
  private knob: HTMLElement;
  private track: HTMLElement;

  private state: Partial<DriveInput> = { steer: 0, throttle: 0, brake: 0, handbrake: false };
  private steerPointer: number | null = null;
  private trackCenter = 0;
  private trackHalf = 1;

  constructor(input: InputManager) {
    this.input = input;
    this.root = document.createElement('div');
    this.root.id = 'controls';

    this.track = document.createElement('div');
    this.track.id = 'steer-track';
    this.knob = document.createElement('div');
    this.knob.id = 'steer-knob';
    this.track.appendChild(this.knob);

    const pedals = document.createElement('div');
    pedals.id = 'pedals';
    const handbrake = this.makePedal('pedal-handbrake', 'FREIN À MAIN');
    const brake = this.makePedal('pedal-brake', 'FREIN');
    const gas = this.makePedal('pedal-gas', 'GAZ');
    pedals.append(handbrake, brake, gas);

    this.root.append(this.track, pedals);
    document.body.appendChild(this.root);
    this.root.classList.add('active');

    this.track.addEventListener('pointerdown', (e) => this.onSteerDown(e));
    this.track.addEventListener('pointermove', (e) => this.onSteerMove(e));
    this.track.addEventListener('pointerup', () => this.onSteerEnd());
    this.track.addEventListener('pointercancel', () => this.onSteerEnd());

    this.bindPedal(gas, 'throttle');
    this.bindPedal(brake, 'brake');
    this.bindToggle(handbrake, 'handbrake');

    window.addEventListener('resize', () => this.measure());
    window.addEventListener('orientationchange', () => window.setTimeout(() => this.measure(), 250));
    this.measure();
  }

  private makePedal(id: string, label: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.id = id;
    btn.className = 'pedal';
    btn.textContent = label;
    return btn;
  }

  private measure(): void {
    const rect = this.track.getBoundingClientRect();
    this.trackCenter = rect.left + rect.width / 2;
    this.trackHalf = Math.max(1, rect.width / 2 - 34);
  }

  private onSteerDown(e: PointerEvent): void {
    this.steerPointer = e.pointerId;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    this.measure();
    this.onSteerMove(e);
  }

  private onSteerMove(e: PointerEvent): void {
    if (e.pointerId !== this.steerPointer) return;
    const dx = e.clientX - this.trackCenter;
    const steer = clamp(dx / this.trackHalf, -1, 1);
    this.state.steer = steer;
    this.knob.style.left = `calc(50% + ${steer * this.trackHalf}px)`;
  }

  private onSteerEnd(): void {
    this.steerPointer = null;
    this.state.steer = 0;
    this.knob.style.left = '50%';
  }

  private bindPedal(el: HTMLButtonElement, key: 'throttle' | 'brake'): void {
    el.addEventListener('pointerdown', (e) => {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      this.state[key] = 1;
      el.classList.add('pressed');
    });
    const release = () => {
      this.state[key] = 0;
      el.classList.remove('pressed');
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
  }

  private bindToggle(el: HTMLButtonElement, key: 'handbrake'): void {
    el.addEventListener('pointerdown', (e) => {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      this.state[key] = !this.state[key];
      el.classList.toggle('pressed', Boolean(this.state[key]));
    });
  }

  sync(): void {
    this.input.setVirtual(this.state);
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
