export class HUD {
  private shiftValue: HTMLElement;
  private speedValue: HTMLElement;
  private gearValue: HTMLElement;
  private xpValue: HTMLElement;
  private callsValue: HTMLElement;
  private radioPanel: HTMLElement;
  private gps: HTMLElement;
  private gpsArrow: HTMLElement;
  private gpsDist: HTMLElement;
  private hint: HTMLElement;
  private sirenBtn: HTMLButtonElement;
  private sirenHandler: ((on: boolean) => void) | null = null;
  private hintTimer: number | null = null;
  private exitBtn: HTMLButtonElement;
  private exitHandler: (() => void) | null = null;
  private intPanel: HTMLElement;
  private intTitle: HTMLElement;
  private logEl: HTMLElement;
  private intActions: HTMLElement;
  private actionHandler: ((key: string) => void) | null = null;

  constructor() {
    const hud = document.createElement('div');
    hud.id = 'hud';

    const topLeft = document.createElement('div');
    topLeft.className = 'hud-top-left';

    const shift = document.createElement('div');
    shift.id = 'hud-shift';
    shift.className = 'hud-chip';
    shift.innerHTML = `<span class="label">SHIFT</span><span class="value">08:00</span>`;

    const xpChip = document.createElement('div');
    xpChip.className = 'hud-chip';
    xpChip.innerHTML = `<span class="label">XP</span><span class="value" id="hud-xp">0</span>`;

    const callsChip = document.createElement('div');
    callsChip.className = 'hud-chip';
    callsChip.innerHTML = `<span class="label">APPELS</span><span class="value" id="hud-calls">0</span>`;

    topLeft.append(shift, xpChip, callsChip);

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

    this.gps = document.createElement('div');
    this.gps.id = 'gps';
    this.gpsArrow = document.createElement('span');
    this.gpsArrow.id = 'gps-arrow';
    this.gpsArrow.textContent = '▲';
    this.gpsDist = document.createElement('span');
    this.gpsDist.id = 'gps-dist';

    this.gps.append(this.gpsArrow, this.gpsDist);

    this.radioPanel = document.createElement('div');
    this.radioPanel.id = 'radio';

    this.hint = document.createElement('div');
    this.hint.id = 'hint';

    this.exitBtn = document.createElement('button');
    this.exitBtn.id = 'int-exit';
    this.exitBtn.type = 'button';
    this.exitBtn.textContent = '🚨 SORTIR DU VÉHICULE';
    this.exitBtn.classList.add('hidden');
    this.exitBtn.addEventListener('click', () => this.exitHandler?.());

    this.intPanel = document.createElement('div');
    this.intPanel.id = 'intervention';
    this.intPanel.classList.add('hidden');
    this.intTitle = document.createElement('div');
    this.intTitle.className = 'int-title';
    this.logEl = document.createElement('div');
    this.logEl.className = 'int-log';
    this.intActions = document.createElement('div');
    this.intActions.className = 'int-actions';
    this.intPanel.append(this.intTitle, this.logEl, this.intActions);

    hud.append(topLeft, topRight, this.gps, speed);

    document.body.append(hud, this.radioPanel, this.hint, this.exitBtn, this.intPanel);

    this.shiftValue = shift.querySelector('.value')!;
    this.speedValue = speed.querySelector('.speed-value')!;
    this.gearValue = speed.querySelector('#hud-gear')!;
    this.xpValue = xpChip.querySelector('#hud-xp')!;
    this.callsValue = callsChip.querySelector('#hud-calls')!;
    this.gpsDist = this.gps.querySelector('#gps-dist')!;
    this.gps.classList.add('hidden');
  }

  setSirenHandler(handler: (on: boolean) => void): void {
    this.sirenHandler = handler;
  }

  setSirenVisual(on: boolean): void {
    this.sirenBtn.classList.toggle('pressed', on);
  }

  update(minutes: number, speedMs: number, reverse: boolean): void {
    const h = Math.floor(minutes / 60) % 24;
    const m = Math.floor(minutes % 60);
    this.shiftValue.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    this.speedValue.textContent = String(Math.round(Math.abs(speedMs) * 3.6));
    this.gearValue.textContent = reverse ? 'R' : 'D';
  }

  setXP(xp: number): void {
    this.xpValue.textContent = String(xp);
  }

  setCalls(count: number): void {
    this.callsValue.textContent = String(count);
  }

  setTarget(relAngle: number | null, distance: number, onsite: boolean): void {
    if (relAngle === null) {
      this.gps.classList.add('hidden');
      return;
    }
    this.gps.classList.remove('hidden');
    this.gpsArrow.style.transform = `rotate(${-relAngle * (180 / Math.PI)}deg)`;
    this.gpsDist.textContent = onsite ? 'SUR PLACE' : `${Math.round(distance / 5) * 5} m`;
  }

  radioPush(from: string, text: string): void {
    const msg = document.createElement('div');
    msg.className = 'radio-msg';

    const head = document.createElement('div');
    head.className = 'radio-head';
    head.textContent = `📻 ${from}`;
    const body = document.createElement('div');
    body.className = 'radio-body';
    body.textContent = text;

    msg.append(head, body);
    this.radioPanel.prepend(msg);

    while (this.radioPanel.children.length > 2) {
      this.radioPanel.removeChild(this.radioPanel.lastChild!);
    }
    window.setTimeout(() => msg.classList.add('shown'), 30);
    window.setTimeout(() => msg.classList.add('fading'), 10000);
    window.setTimeout(() => msg.remove(), 10700);
  }

  showHint(text: string, durationMs = 6000): void {
    this.hint.textContent = text;
    this.hint.classList.add('visible');
    if (this.hintTimer !== null) window.clearTimeout(this.hintTimer);
    this.hintTimer = window.setTimeout(() => this.hint.classList.remove('visible'), durationMs);
  }

  showExit(handler: (() => void) | null): void {
    if (handler === null) {
      if (this.exitHandler !== null) {
        this.exitHandler = null;
        this.exitBtn.classList.add('hidden');
      }
      return;
    }
    if (this.exitHandler === null) this.exitBtn.classList.remove('hidden');
    this.exitHandler = handler;
  }

  showIntervention(title: string): void {
    this.intTitle.textContent = title;
    this.logEl.innerHTML = '';
    this.intActions.innerHTML = '';
    this.intPanel.classList.remove('hidden');
    document.body.classList.add('int-open');
  }

  closeIntervention(): void {
    this.intPanel.classList.add('hidden');
    document.body.classList.remove('int-open');
    this.intActions.innerHTML = '';
  }

  intLog(text: string, tone: 'info' | 'good' | 'bad'): void {
    const line = document.createElement('div');
    line.className = `int-line ${tone}`;
    line.textContent = text;
    this.logEl.append(line);
    while (this.logEl.children.length > 7) {
      this.logEl.removeChild(this.logEl.firstChild!);
    }
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  setIntActions(actions: readonly { key: string; label: string }[], handler: (key: string) => void): void {
    this.actionHandler = handler;
    this.intActions.innerHTML = '';
    for (const action of actions) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'int-btn';
      btn.textContent = action.label;
      btn.addEventListener('click', () => this.actionHandler?.(action.key));
      this.intActions.append(btn);
    }
  }
}
