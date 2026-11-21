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
  private rankValue: HTMLElement;
  private bilan: HTMLElement;
  private bilanLines: HTMLElement;
  private wheel: HTMLElement;
  private wheelCenter: HTMLElement;
  private wheelBar: HTMLElement;
  private wheelLabel: HTMLElement;
  private offer: HTMLElement;
  private offerHead: HTMLElement;
  private offerDetail: HTMLElement;
  private offerTimer: HTMLElement;
  private offerAccept: (() => void) | null = null;
  private offerDecline: (() => void) | null = null;

  constructor() {
    const hud = document.createElement('div');
    hud.id = 'hud';

    const topLeft = document.createElement('div');
    topLeft.className = 'hud-top-left';

    const shift = document.createElement('div');
    shift.id = 'hud-shift';
    shift.className = 'hud-chip';
    shift.innerHTML = `<span class="label">SHIFT</span><span class="value">08:00</span>`;

    const rankChip = document.createElement('div');
    rankChip.className = 'hud-chip';
    rankChip.innerHTML = `<span class="label">GRADE</span><span class="value" id="hud-rank">Cadet</span>`;

    const xpChip = document.createElement('div');
    xpChip.className = 'hud-chip';
    xpChip.innerHTML = `<span class="label">XP</span><span class="value" id="hud-xp">0</span>`;

    const callsChip = document.createElement('div');
    callsChip.className = 'hud-chip';
    callsChip.innerHTML = `<span class="label">APPELS</span><span class="value" id="hud-calls">0</span>`;

    topLeft.append(shift, xpChip, callsChip, rankChip);

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
    this.exitBtn.textContent = '🚨';
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

    this.bilan = document.createElement('div');
    this.bilan.id = 'bilan';
    this.bilan.classList.add('hidden');

    this.wheel = document.createElement('div');
    this.wheel.id = 'wheel';
    this.wheel.classList.add('hidden');

    this.wheelCenter = document.createElement('div');
    this.wheelCenter.id = 'wheel-center';
    this.wheelLabel = document.createElement('div');
    this.wheelLabel.id = 'wheel-label';
    this.wheelBar = document.createElement('div');
    this.wheelBar.id = 'wheel-bar';
    this.wheelCenter.append(this.wheelLabel, this.wheelBar);
    this.wheel.append(this.wheelCenter);

    this.offer = document.createElement('div');
    this.offer.id = 'call-offer';
    this.offer.classList.add('hidden');
    this.offerHead = document.createElement('div');
    this.offerHead.className = 'offer-head';
    this.offerDetail = document.createElement('div');
    this.offerDetail.className = 'offer-detail';
    this.offerTimer = document.createElement('div');
    this.offerTimer.className = 'offer-timer';
    const offerBtns = document.createElement('div');
    offerBtns.className = 'offer-btns';
    const acceptBtn = document.createElement('button');
    acceptBtn.type = 'button';
    acceptBtn.className = 'offer-accept';
    acceptBtn.textContent = '✅ ACCEPTER';
    acceptBtn.addEventListener('click', () => {
      const onAccept = this.offerAccept;
      this.hideCallOffer();
      onAccept?.();
    });
    const declineBtn = document.createElement('button');
    declineBtn.type = 'button';
    declineBtn.className = 'offer-decline';
    declineBtn.textContent = '❌ REFUSER';
    declineBtn.addEventListener('click', () => {
      const onDecline = this.offerDecline;
      this.hideCallOffer();
      onDecline?.();
    });
    offerBtns.append(acceptBtn, declineBtn);
    this.offer.append(this.offerHead, this.offerDetail, this.offerTimer, offerBtns);

    hud.append(topLeft, topRight, this.gps, speed);

    document.body.append(hud, this.radioPanel, this.hint, this.exitBtn, this.intPanel, this.wheel, this.offer, this.bilan);

    this.rankValue = rankChip.querySelector('#hud-rank')!;
    this.bilanLines = document.createElement('div');
    this.bilanLines.className = 'bilan-lines';

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

  showCallOffer(
    caller: string,
    label: string,
    detail: string,
    onAccept: () => void,
    onDecline: () => void
  ): void {
    this.offerHead.textContent = `📻 Appel entrant — ${caller}`;
    this.offerDetail.textContent = `${label} : ${detail}`;
    this.offerTimer.textContent = '';
    this.offerAccept = onAccept;
    this.offerDecline = onDecline;
    this.offer.classList.remove('hidden');
  }

  setCallOfferTimer(seconds: number): void {
    if (this.offer.classList.contains('hidden')) return;
    this.offerTimer.textContent = `Réponse attendue dans ${seconds} s`;
  }

  hideCallOffer(): void {
    this.offer.classList.add('hidden');
    this.offerAccept = null;
    this.offerDecline = null;
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

  showExit(handler: (() => void) | null, icon = '🚨'): void {
    this.exitBtn.textContent = icon;
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
    this.wheel.querySelectorAll('.wheel-btn').forEach((el) => el.remove());

    if (actions.length === 0) {
      this.wheel.classList.add('hidden');
      return;
    }
    this.wheel.classList.remove('hidden');

    const size = 320;
    const radius = size / 2 - 52;
    actions.forEach((action, i) => {
      const angle = (-90 + (i * 360) / actions.length) * (Math.PI / 180);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'wheel-btn';
      const [emoji, ...rest] = action.label.split(' ');
      const emojiSpan = document.createElement('span');
      emojiSpan.className = 'wheel-emoji';
      emojiSpan.textContent = emoji;
      const labelSpan = document.createElement('span');
      labelSpan.className = 'wheel-text';
      labelSpan.textContent = rest.join(' ').replace(/ \(\+\d+ XP\)/, '');
      btn.append(emojiSpan, labelSpan);
      btn.style.left = `${size / 2 + Math.cos(angle) * radius - 50}px`;
      btn.style.top = `${size / 2 + Math.sin(angle) * radius - 42}px`;
      btn.addEventListener('click', () => this.actionHandler?.(action.key));
      this.wheel.append(btn);
    });
  }

  showActionProgress(label: string): void {
    this.wheelLabel.textContent = label.replace(/\(\+?\d+ XP\)/, '').trim();
    this.wheelBar.style.width = '0%';
    this.wheel.classList.add('busy');
  }

  setActionProgress(ratio: number): void {
    this.wheelBar.style.width = `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`;
  }

  clearActionProgress(): void {
    this.wheelLabel.textContent = '';
    this.wheelBar.style.width = '0%';
    this.wheel.classList.remove('busy');
  }

  setRank(name: string): void {
    this.rankValue.textContent = name;
  }

  showBilan(titleText: string, lines: [string, string][], rankText: string, onRestart: () => void): void {
    this.closeIntervention();
    this.showExit(null);

    this.bilanLines.innerHTML = '';
    for (const [label, value] of lines) {
      const row = document.createElement('div');
      row.className = 'bilan-line';
      const l = document.createElement('span');
      l.textContent = label;
      const v = document.createElement('span');
      v.textContent = value;
      row.append(l, v);
      this.bilanLines.append(row);
    }

    const rankBanner = document.createElement('div');
    rankBanner.className = 'bilan-rank';
    rankBanner.textContent = rankText;

    this.bilan.innerHTML = '';
    const titleEl = document.createElement('div');
    titleEl.className = 'bilan-title';
    titleEl.textContent = titleText;

    this.bilan.append(titleEl, rankBanner, this.bilanLines);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bilan-btn';
    btn.textContent = '🚨 Nouveau service';
    btn.addEventListener('click', () => {
      this.hideBilan();
      onRestart();
    });
    this.bilan.append(btn);

    this.bilan.classList.remove('hidden');
  }

  hideBilan(): void {
    this.bilan.classList.add('hidden');
  }
}
