import { CONFIG } from '../config';

export class HUD {
  private shiftValue: HTMLElement;
  private speedValue: HTMLElement;
  private gearValue: HTMLElement;
  private hint: HTMLElement;
  private sirenBtn: HTMLButtonElement;
  private sirenHandler: ((on: boolean) => void) | null = null;
  private hintTimer: number | null = null;
  private minutes = CONFIG.shift.startMinutes;

  constructor() {
    const hud = document.createElement('div');
    hud.id = 'hud';

    const topLeft = document.createElement('div');
    topLeft.className = 'hud-top-left';

    const shift = document.createElement('div');
    shift.id = 'hud-shift';
    shift.className = 'hud-chip';
    shift.innerHTML = `<span class="label">SHIFT</span><span class="value">08:00</span>`;

    topLeft.appendChild(shift);

    const topRight = document.createElement('div');
    topRight.className = 'hud-top-right';

    const sirenBtn = document.createElement('button');
    sirenBtn.id = 'hud-siren';
    sirenBtn.className = 'hud-btn';
    sirenBtn.textContent = '🚨';
    sirenBtn.addEventListener('click', () => {
      sirenBtn.classList.toggle('pressed');
      this.sirenHandler?.(sirenBtn.classList.contains('pressed'));
    });
    this.sirenBtn = sirenBtn;

    const fsBtn = document.createElement('button');
    fsBtn.className = 'hud-btn';
    fsBtn.textContent = '⛶';
    fsBtn.addEventListener('click', () => {
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => {});
      } else {
        void document.documentElement.requestFullscreen().catch(() => {});
      }
    });
    topRight.append(sirenBtn, fsBtn);

    const speed = document.createElement('div');
    speed.id = 'hud-speed';
    speed.innerHTML = `
      <div class="speed-value">0</div>
      <div class="speed-unit">KM/H</div>
      <div id="hud-gear">D</div>
    `;

    hud.append(topLeft, topRight, speed);

    this.hint = document.createElement('div');
    this.hint.id = 'hint';

    document.body.append(hud, this.hint);

    this.shiftValue = shift.querySelector('.value')!;
    this.speedValue = speed.querySelector('.speed-value')!;
    this.gearValue = speed.querySelector('#hud-gear')!;
  }

  setSirenHandler(handler: (on: boolean) => void): void {
    this.sirenHandler = handler;
  }

  setSirenVisual(on: boolean): void {
    this.sirenBtn.classList.toggle('pressed', on);
  }

  update(dt: number, speedMs: number, reverse: boolean): void {
    this.minutes = (this.minutes + dt * CONFIG.shift.minutesPerSecond) % (24 * 60);
    const h = Math.floor(this.minutes / 60);
    const m = Math.floor(this.minutes % 60);
    this.shiftValue.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    this.speedValue.textContent = String(Math.round(Math.abs(speedMs) * 3.6));
    this.gearValue.textContent = reverse ? 'R' : 'D';
  }

  showHint(text: string, durationMs = 6000): void {
    this.hint.textContent = text;
    this.hint.classList.add('visible');
    if (this.hintTimer !== null) window.clearTimeout(this.hintTimer);
    this.hintTimer = window.setTimeout(() => this.hint.classList.remove('visible'), durationMs);
  }
}
