import * as THREE from 'three';
import type { Call } from './Dispatch';
import type { Officer } from '../officer/Officer';
import type { PoliceCar } from '../vehicle/PoliceCar';
import type { HUD } from '../ui/HUD';
import type { InterventionAction } from './InterventionAction';

export type InterventionMode = 'driving' | 'patrol' | 'toScene' | 'menu' | 'chase' | 'return';

export interface CallTally {
  arrests: number;
  pv: number;
  warnings: number;
}

export interface FootInput {
  move: number;
  turn: number;
}

type Pose = 'stand' | 'lie' | 'sit';

interface Npc {
  group: THREE.Group;
  suspect: boolean;
  x: number;
  z: number;
  heading: number;
  fleeDir: number;
  fleeSpeed: number;
}

interface IntState {
  checked: boolean;
  secured: boolean;
  ems: boolean;
  questioned: boolean;
  inspected: boolean;
  wanted: boolean;
  fled: boolean;
  held: boolean;
  arrested: boolean;
  warned: boolean;
}

interface PendingAction {
  key: string;
  label: string;
  remaining: number;
  total: number;
}

const SKIN = [0xd9b08c, 0xc49a6c, 0x8d5524, 0xe8c39e];
const CLOTHES = [0x6b4f3a, 0x44506b, 0x59473a, 0x37545c, 0x703c46];
const SUSPECT_CLOTHES = [0x24272e, 0x30272e, 0x1d3328];

const ACTION_DURATIONS: Record<string, number> = {
  id: 1600,
  frisk: 2200,
  inspect: 2400,
  question: 2600,
  diffuse: 2400,
  secure: 2000,
  ems: 1800,
  ids: 3000,
  firstaid: 2800,
  tow: 1800,
  pv: 3000,
  warn: 1500,
  arrest: 2600
};

interface ActiveIntervention {
  call: Call;
  npcs: Npc[];
  s: IntState;
  used: Set<string>;
  tally: CallTally;
}

export class InterventionSystem {
  mode: InterventionMode = 'driving';

  private current: ActiveIntervention | null = null;
  private npcRoot = new THREE.Group();
  private returnToCarSignal = false;
  private finishedCall: Call | null = null;
  private pending: PendingAction | null = null;

  constructor(
    private scene: THREE.Scene,
    private hud: HUD,
    private officer: Officer,
    private onFinish: (call: Call, tally: CallTally) => void,
    private onXp: (xp: number) => void
  ) {
    scene.add(this.npcRoot);
  }

  get activeCall(): Call | null {
    return this.current ? this.current.call : null;
  }

  private buildNpc(pose: Pose, suspect: boolean, x: number, z: number): Npc {
    const skin = new THREE.MeshStandardMaterial({
      color: SKIN[Math.floor(Math.random() * SKIN.length)],
      roughness: 0.8
    });
    const clothes = new THREE.MeshStandardMaterial({
      color: suspect
        ? SUSPECT_CLOTHES[Math.floor(Math.random() * SUSPECT_CLOTHES.length)]
        : CLOTHES[Math.floor(Math.random() * CLOTHES.length)],
      roughness: 0.85
    });
    const pants = new THREE.MeshStandardMaterial({
      color: 0x2b3038,
      roughness: 0.9
    });

    const group = new THREE.Group();

    if (pose === 'lie') {
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.6, 4, 8), clothes);
      body.rotation.x = Math.PI / 2;
      body.position.y = 0.26;
      group.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), skin);
      head.position.set(0, 0.34, 0.78);
      group.add(head);
      const legs = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.7), pants);
      legs.position.set(0, 0.26, -0.62);
      group.add(legs);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.6), clothes);
      arm.position.set(0.42, 0.26, 0.15);
      group.add(arm);
    } else if (pose === 'sit') {
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.6, 4, 8), clothes);
      body.position.y = 0.78;
      group.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), skin);
      head.position.y = 1.4;
      group.add(head);
      const legs = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.66), pants);
      legs.rotation.x = -1.3;
      legs.position.set(0, 0.34, 0.2);
      group.add(legs);
      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.16), clothes);
      armL.position.set(0.34, 0.78, 0.05);
      armL.rotation.z = 0.5;
      group.add(armL);
      const armR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.16), clothes);
      armR.position.set(-0.34, 0.78, 0.05);
      armR.rotation.z = -0.5;
      group.add(armR);
    } else {
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.6, 4, 8), clothes);
      body.position.y = 0.95;
      body.castShadow = true;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), skin);
      head.position.y = 1.58;
      const legs = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.24), pants);
      legs.position.y = 0.34;
      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.5, 0.15), clothes);
      armL.position.set(0.34, 1.0, 0);
      const armR = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.5, 0.15), clothes);
      armR.position.set(-0.34, 1.0, 0);
      group.add(body, head, legs, armL, armR);
    }

    group.position.set(x, 0, z);
    group.rotation.y = Math.random() * Math.PI * 2;
    this.npcRoot.add(group);

    return { group, suspect, x, z, heading: group.rotation.y, fleeDir: 0, fleeSpeed: 0 };
  }

  private buildWreck(x: number, z: number): void {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4a4e55, roughness: 0.7, metalness: 0.3 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x191c22, roughness: 0.7 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.6, 4.3), bodyMat);
    body.position.y = 0.6;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.5, 1.9), darkMat);
    cabin.position.set(0, 1.1, 0.1);
    const light = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.14, 0.08), darkMat);
    light.position.set(0, 0.74, 2.16);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.14, 0.08), darkMat);
    tail.position.set(0, 0.74, -2.16);

    group.add(body, cabin, light, tail);
    group.position.set(x, 0, z);
    group.rotation.y = Math.random() * Math.PI * 2;
    group.rotation.z = (Math.random() - 0.5) * 0.1;
    this.npcRoot.add(group);
  }

  start(car: PoliceCar, call: Call): void {
    this.clearNpcs();

    const npcs: Npc[] = [];
    const sx = call.x;
    const sz = call.z;

    switch (call.type.key) {
      case 'accident': {
        this.buildWreck(sx, sz);
        npcs.push(this.buildNpc('lie', false, sx + 2.3, sz + 1.3));
        npcs.push(this.buildNpc('sit', false, sx - 2.2, sz + 1.7));
        npcs.push(this.buildNpc('stand', false, sx - 1.5, sz - 2.3));
        break;
      }
      case 'traffic': {
        npcs.push(this.buildNpc('stand', true, sx + 1.6, sz + 1.2));
        break;
      }
      case 'burglary':
      case 'suspicious': {
        npcs.push(this.buildNpc('stand', true, sx + 1.5, sz + 0.8));
        break;
      }
      case 'noise': {
        npcs.push(this.buildNpc('stand', false, sx + 1.8, sz + 1.0));
        npcs.push(this.buildNpc('stand', false, sx - 1.8, sz + 1.0));
        break;
      }
      case 'missing': {
        npcs.push(this.buildNpc('stand', false, sx + 1.2, sz + 1.0));
        break;
      }
      case 'parking': {
        npcs.push(this.buildNpc('stand', false, sx + 1.5, sz - 1.2));
        break;
      }
    }

    const sideX = Math.cos(car.heading) * 1.6;
    const sideZ = -Math.sin(car.heading) * 1.6;
    this.officer.placeAt(car.pos.x + sideX, car.pos.y + sideZ, sx, sz);
    this.officer.group.visible = true;
    this.officer.walkTo(sx, sz + 4, 2.4);

    this.current = { call, npcs, s: freshState(), used: new Set(), tally: { arrests: 0, pv: 0, warnings: 0 } };
    this.pending = null;
    this.mode = 'toScene';

    this.hud.showExit(null);
    this.hud.showIntervention(`${call.type.label} \u2014 ${call.type.caller}`);
    this.hud.intLog('Tu arrives sur les lieux. Reste procédural et courtois.', 'info');
  }

  startPatrol(car: PoliceCar): void {
    this.clearNpcs();
    this.current = null;
    this.pending = null;

    const sideX = Math.cos(car.heading) * 1.6;
    const sideZ = -Math.sin(car.heading) * 1.6;
    this.officer.placeAt(car.pos.x + sideX, car.pos.y + sideZ, car.pos.x, car.pos.y + 10);
    this.officer.group.visible = true;
    this.officer.speed = 0;
    this.officer.arrived = true;

    this.mode = 'patrol';
    this.hud.showExit(null);
    this.hud.closeIntervention();
    this.hud.showHint('Patrouille à pied — Gaz : avancer, Frein : reculer, Volant : tourner', 7000);
  }

  enterCar(car: PoliceCar): void {
    if (this.mode !== 'patrol') return;
    this.returnToCarSignal = false;
    this.returnToCar(car);
  }

  private applyAction(key: string, s: IntState, call: Call): void {
    const give = (xp: number) => this.onXp(xp);

    switch (call.type.key) {
      case 'traffic': {
        if (key === 'id') {
          s.checked = true;
          if (Math.random() < 0.3) {
            s.wanted = true;
            this.hud.intLog('\u26a0\ufe0f Permis suspendu et fichier signalé ! Interpellation possible.', 'bad');
          } else {
            give(5);
            this.hud.intLog('\u2713 Permis et assurance valides. Conducteur coopératif.', 'good');
          }
        } else if (key === 'pv') {
          give(35);
          this.hud.intLog('\ud83d\udcc4 PV de circulation dressé et signé.', 'good');
        } else if (key === 'warn') {
          give(15);
          this.hud.intLog('\ud83d\udcac Rappel verbal délivré, le conducteur repart.', 'good');
        } else if (key === 'arrest') {
          s.arrested = true;
          give(60);
          this.hud.intLog('\u26d3\ufe0f Interpellation effectuée dans les règles. Transport au poste.', 'good');
        }
        break;
      }

      case 'accident': {
        if (key === 'secure') {
          s.secured = true;
          give(20);
          this.hud.intLog('\ud83d\udea7 Zone sécurisée, balisage posé.', 'good');
        } else if (key === 'ems') {
          s.ems = true;
          give(30);
          this.hud.intLog('\ud83d\ude91 Secours appelés et en route.', 'good');
        } else if (key === 'firstaid') {
          s.inspected = true;
          give(40);
          this.hud.intLog('\ud83e\ude79 Blessés rassurés et mis en position d\u2019attente. Le SAMU prend le relais.', 'good');
        } else if (key === 'ids') {
          give(20);
          this.hud.intLog('\ud83d\udccb Identités relevées, constat établi.', 'good');
        }
        break;
      }

      case 'burglary': {
        if (key === 'inspect') {
          s.inspected = true;
          give(15);
          this.hud.intLog('\ud83d\udd0d Porte forcée confirmée, traces d\u2019outils relevées.', 'good');
        } else if (key === 'id') {
          s.checked = true;
          if (Math.random() < 0.45) {
            this.fleeNow();
            return;
          }
          give(25);
          this.hud.intLog('\u2713 Identité contrôlée, rien à signaler.', 'good');
        } else if (key === 'arrest') {
          s.arrested = true;
          give(90);
          this.hud.intLog('\u26d3\ufe0f Suspect menotté et placé en garde à vue.', 'good');
        }
        break;
      }

      case 'missing': {
        if (key === 'question') {
          s.questioned = true;
          give(20);
          this.hud.intLog('\ud83d\udcac Le déclarant décrit précisément la personne disparue.', 'good');
        } else if (key === 'diffuse') {
          s.secured = true;
          give(30);
          this.hud.intLog('\ud83d\udce1 Signalement diffusé à toutes les patrouilles.', 'good');
        }
        break;
      }

      case 'noise': {
        if (key === 'warn') {
          s.warned = true;
          give(10);
          this.hud.intLog('\ud83d\udcac Les organisateurs baissent le volume. Tenue exemplaire.', 'good');
        } else if (key === 'pv') {
          give(20);
          this.hud.intLog('\ud83d\udcc4 PV pour tapage nocturne dressé.', 'good');
        }
        break;
      }

      case 'parking': {
        if (key === 'tow') {
          s.secured = true;
          give(25);
          this.hud.intLog('\ud83d\udefb Fourrière demandée, véhicule enlevé sous peu.', 'good');
        }
        break;
      }

      case 'suspicious': {
        if (key === 'id') {
          s.checked = true;
          if (Math.random() < 0.5) {
            s.wanted = true;
            this.hud.intLog('\u26a0\ufe0f Casier actif ! Effractions non résolues sur son dossier.', 'bad');
          } else {
            give(15);
            this.hud.intLog('\u2713 Identité contrôlée, déplacement justifié.', 'good');
          }
        } else if (key === 'frisk') {
          s.inspected = true;
          give(20);
          if (s.wanted) this.hud.intLog('\ud83d\udd0d Objets volés trouvés sur lui.', 'bad');
          else this.hud.intLog('\ud83d\udd0d Fouille effectuée, rien à signaler.', 'good');
        } else if (key === 'arrest') {
          s.arrested = true;
          give(70);
          this.hud.intLog('\u26d3\ufe0f Suspect interpellé, belle prise, officier !', 'good');
        }
        break;
      }
    }
  }

  menuActions(s: IntState): InterventionAction[] {
    if (!this.current) return [];
    const type = this.current.call.type.key;
    const actions: InterventionAction[] = [];

    switch (type) {
      case 'traffic':
        if (!s.checked) actions.push({ key: 'id', label: '\ud83e\udeaa Contrôler le permis' });
        if (s.checked && s.wanted && !s.arrested) actions.push({ key: 'arrest', label: '\u26d3\ufe0f Procéder à l\u2019interpellation' });
        if (!s.arrested) {
          actions.push({ key: 'pv', label: '\ud83d\udcc4 Dresser un PV (+35 XP)' });
          actions.push({ key: 'warn', label: '\ud83d\udcac Avertir et relâcher (+15 XP)' });
        }
        break;

      case 'accident':
        if (!s.secured) actions.push({ key: 'secure', label: '\ud83d\udea7 Sécuriser la zone (+20 XP)' });
        if (s.secured && !s.ems) actions.push({ key: 'ems', label: '\ud83d\ude91 Appeler les secours (+30 XP)' });
        if (s.ems && !s.inspected) actions.push({ key: 'firstaid', label: '\ud83e\ude79 Aider les blessés (+40 XP)' });
        if (s.secured && s.ems) actions.push({ key: 'ids', label: '\ud83d\udccb Relever les identités (+20 XP)' });
        break;

      case 'burglary':
        if (!s.inspected) actions.push({ key: 'inspect', label: '\ud83d\udd0d Examiner la porte forcée (+15 XP)' });
        if (s.inspected && !s.checked && !s.fled && !s.arrested)
          actions.push({ key: 'id', label: '\ud83e\udeaa Contrôler l\u2019individu' });
        if (((s.wanted && !s.fled) || s.held) && !s.arrested && s.inspected)
          actions.push({ key: 'arrest', label: '\u26d3\ufe0f Menotter le suspect' });
        break;

      case 'missing':
        if (!s.questioned) actions.push({ key: 'question', label: '\ud83d\udcac Questionner le déclarant (+20 XP)' });
        if (s.questioned && !s.secured) actions.push({ key: 'diffuse', label: '\ud83d\udce1 Diffuser le signalement (+30 XP)' });
        break;

      case 'noise':
        if (!s.warned) actions.push({ key: 'warn', label: '\ud83d\udcac Avertir les organisateurs (+10 XP)' });
        if (s.warned) actions.push({ key: 'pv', label: '\ud83d\udcc4 Dresser un PV tapage (+20 XP)' });
        break;

      case 'parking':
        if (!s.secured) actions.push({ key: 'tow', label: '\ud83d\udefb Demander la fourrière (+25 XP)' });
        break;

      case 'suspicious':
        if (!s.checked) actions.push({ key: 'id', label: '\ud83e\udeaa Contrôler l\u2019identité' });
        if (s.checked && !s.inspected && !s.arrested) actions.push({ key: 'frisk', label: '\ud83d\udd0d Fouiller (+20 XP)' });
        if (s.wanted && !s.fled && !s.arrested) actions.push({ key: 'arrest', label: '\u26d3\ufe0f Menotter le suspect' });
        break;
    }

    actions.push({ key: 'finish', label: '\u2705 Clôturer l\u2019intervention' });
    actions.push({ key: 'exit', label: '\ud83d\udd3a Remonter' });
    const used = this.current.used;
    return actions.filter((a) => a.key === 'finish' || a.key === 'exit' || !used.has(a.key));
  }

  private openMenu(): void {
    if (!this.current) return;
    this.mode = 'menu';
    this.hud.setIntActions(this.menuActions(this.current.s), (key) => this.handleAction(key));
  }

  handleAction(key: string): void {
    if (!this.current || this.pending) return;
    const s = this.current.s;
    const call = this.current.call;

    if (key === 'exit') {
      this.returnToCarSignal = true;
      return;
    }
    if (this.current.used.has(key)) return;
    if (key === 'finish') {
      this.finishedCall = call;
      this.hud.intLog('Retour au véhicule pour terminer l\u2019intervention.', 'info');
      this.returnToCarSignal = true;
      return;
    }

    const dur = ACTION_DURATIONS[key];
    if (dur) {
      const label = this.currentLabelOf(key) ?? 'Action en cours...';
      this.pending = { key, label, remaining: dur, total: dur };
      this.hud.showActionProgress(label);
      return;
    }

    this.applyAction(key, s, call);
    this.current.used.add(key);
    if (key === 'arrest') this.current.tally.arrests++;
    if (key === 'pv') this.current.tally.pv++;
    if (key === 'warn') this.current.tally.warnings++;
    this.hud.setIntActions(this.menuActions(s), (k) => this.handleAction(k));
  }

  private currentLabelOf(key: string): string | null {
    if (!this.current) return null;
    return this.menuActions(this.current.s).find((a) => a.key === key)?.label ?? null;
  }

  update(dt: number, car: PoliceCar, foot: FootInput): void {
    switch (this.mode) {
      case 'driving':
        break;

      case 'patrol': {
        this.officer.freeMove(dt, foot.turn, foot.move);
        this.officer.update(dt);
        if (this.returnToCarSignal) {
          this.returnToCarSignal = false;
          this.returnToCar(car);
        }
        break;
      }

      case 'toScene': {
        this.officer.update(dt);
        if (this.officer.arrived) this.openMenu();
        break;
      }

      case 'menu': {
        this.officer.update(dt);
        if (this.pending) {
          this.pending.remaining -= dt * 1000;
          this.hud.setActionProgress(Math.max(0, 1 - this.pending.remaining / this.pending.total));
          const cur = this.current;
          if (!cur) break;
          if (this.pending.remaining <= 0) {
            const { key } = this.pending;
            this.pending = null;
            this.hud.clearActionProgress();
            const s = cur.s;
            const call = cur.call;
            this.applyAction(key, s, call);
            cur.used.add(key);
            if (key === 'arrest') cur.tally.arrests++;
            if (key === 'pv') cur.tally.pv++;
            if (key === 'warn') cur.tally.warnings++;
            this.hud.setIntActions(this.menuActions(s), (k) => this.handleAction(k));
          }
        }
        if (this.returnToCarSignal && !this.pending) {
          this.returnToCarSignal = false;
          this.returnToCar(car);
        }
        break;
      }

      case 'chase': {
        const suspect = this.suspectNpc();
        if (!suspect) {
          this.mode = 'menu';
          break;
        }

        suspect.fleeSpeed = Math.max(2.2, suspect.fleeSpeed - dt * 0.07);
        if (Math.random() < dt * 0.25) {
          suspect.fleeDir += (Math.random() - 0.5) * 1.2;
        }
        suspect.x += Math.sin(suspect.fleeDir) * suspect.fleeSpeed * dt;
        suspect.z += Math.cos(suspect.fleeDir) * suspect.fleeSpeed * dt;
        suspect.heading = suspect.fleeDir;
        suspect.group.position.set(suspect.x, 0, suspect.z);
        suspect.group.rotation.y = suspect.heading;

        this.officer.walkTo(suspect.x, suspect.z, 4.6);
        this.officer.update(dt);

        const d = Math.hypot(suspect.x - this.officer.x, suspect.z - this.officer.z);
        if (d < 3.2) {
          const caught = this.current;
          if (!caught) break;
          const s = caught.s;
          s.held = true;
          this.onXp(30);
          this.hud.intLog('\u2713 Suspect rattrapé et plaqué au sol (+30 XP) !', 'good');
          this.mode = 'menu';
          this.openMenu();
        }
        break;
      }

      case 'return': {
        this.officer.update(dt);
        if (this.officer.arrived) {
          this.officer.group.visible = false;
          this.mode = 'driving';
          const call = this.finishedCall;
          if (call) {
            this.complete(call);
          } else {
            this.hud.closeIntervention();
          }
        }
        break;
      }
    }
  }

  private complete(call: Call, tally?: CallTally): void {
    const t = tally ?? (this.current ? this.current.tally : { arrests: 0, pv: 0, warnings: 0 });
    this.clearNpcs();
    this.current = null;
    this.finishedCall = null;
    this.pending = null;
    this.returnToCarSignal = false;
    this.hud.closeIntervention();
    this.hud.clearActionProgress();
    this.hud.setIntActions([], () => {});
    this.onFinish(call, t);
  }

  private returnToCar(car: PoliceCar): void {
    this.mode = 'return';
    const sideX = Math.cos(car.heading) * 1.9;
    const sideZ = -Math.sin(car.heading) * 1.9;
    this.officer.walkTo(car.pos.x + sideX, car.pos.y + sideZ, 2.8);
    this.hud.setIntActions([], () => {});
    this.hud.showExit(null);
  }

  private clearNpcs(): void {
    while (this.npcRoot.children.length > 0) {
      const child = this.npcRoot.children[0] as THREE.Group;
      child.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          (obj.material as THREE.Material).dispose();
        }
      });
      this.npcRoot.remove(child);
    }
  }

  private suspectNpc(): Npc | null {
    return this.current ? this.current.npcs.find((n) => n.suspect) ?? null : null;
  }

  private fleeNow(): void {
    if (!this.current) return;
    const suspect = this.suspectNpc();
    if (!suspect) return;
    this.current.s.fled = true;
    const dx = suspect.x - this.officer.x;
    const dz = suspect.z - this.officer.z;
    suspect.fleeDir = Math.atan2(dx, dz) + (Math.random() - 0.5) * 0.6;
    suspect.fleeSpeed = 4.1;
    this.mode = 'chase';
    this.hud.setIntActions([], () => {});
    this.hud.clearActionProgress();
    this.pending = null;
    this.hud.intLog('\ud83d\udea8 Le suspect s\u2019enfuit à la course ! Rattrape-le !', 'bad');
  }

  abort(): void {
    this.clearNpcs();
    this.current = null;
    this.finishedCall = null;
    this.pending = null;
    this.returnToCarSignal = false;
    this.officer.group.visible = false;
    this.hud.closeIntervention();
    this.hud.clearActionProgress();
    this.hud.setIntActions([], () => {});
    this.mode = 'driving';
  }

  dispose(): void {
    this.clearNpcs();
    this.scene.remove(this.npcRoot);
  }
}

function freshState(): IntState {
  return {
    checked: false,
    secured: false,
    ems: false,
    questioned: false,
    inspected: false,
    wanted: false,
    fled: false,
    held: false,
    arrested: false,
    warned: false
  };
}
