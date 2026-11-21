import * as THREE from 'three';
import type { Call } from './Dispatch';
import type { Officer } from '../officer/Officer';
import type { PoliceCar } from '../vehicle/PoliceCar';
import type { HUD } from '../ui/HUD';
import type { InterventionAction } from './InterventionAction';

export type InterventionMode = 'driving' | 'toScene' | 'menu' | 'chase' | 'return';

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

const SKIN = [0xd9b08c, 0xc49a6c, 0x8d5524, 0xe8c39e];
const CLOTHES = [0x6b4f3a, 0x44506b, 0x59473a, 0x37545c, 0x703c46];
const SUSPECT_CLOTHES = [0x24272e, 0x30272e, 0x1d3328];

interface ActiveIntervention {
  call: Call;
  npcs: Npc[];
  s: IntState;
  used: Set<string>;
}

export class InterventionSystem {
  mode: InterventionMode = 'driving';

  private current: ActiveIntervention | null = null;
  private npcRoot = new THREE.Group();
  private returnToCarSignal = false;
  private finishedCall: Call | null = null;

  constructor(
    private scene: THREE.Scene,
    private hud: HUD,
    private officer: Officer,
    private onFinish: (call: Call) => void,
    private onXp: (xp: number) => void
  ) {
    scene.add(this.npcRoot);
  }

  get activeCall(): Call | null {
    return this.current ? this.current.call : null;
  }

  private buildNpc(suspect: boolean, x: number, z: number): Npc {
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

    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.6, 4, 8), clothes);
    body.position.y = 0.95;
    body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), skin);
    head.position.y = 1.58;
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.24), clothes);
    legs.position.y = 0.34;
    group.add(body, head, legs);
    group.position.set(x, 0, z);
    group.rotation.y = Math.random() * Math.PI * 2;
    this.npcRoot.add(group);

    return { group, suspect, x, z, heading: group.rotation.y, fleeDir: 0, fleeSpeed: 0 };
  }

  start(car: PoliceCar, call: Call): void {
    this.clearNpcs();

    const npcs: Npc[] = [];
    const sx = call.x;
    const sz = call.z;
    const ring = 2.5;

    const hasSuspect = ['traffic', 'burglary', 'suspicious'].includes(call.type.key);
    const witnessCount =
      call.type.key === 'accident'
        ? 2
        : call.type.key === 'noise'
          ? 2
          : call.type.key === 'missing'
            ? 1
            : call.type.key === 'parking'
              ? 1
              : 0;

    if (hasSuspect) {
      const angle = Math.random() * Math.PI * 2;
      npcs.push(this.buildNpc(true, sx + Math.cos(angle) * ring, sz + Math.sin(angle) * ring));
    }
    for (let i = 0; i < witnessCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      npcs.push(this.buildNpc(false, sx + Math.cos(angle) * (ring + 1.5), sz + Math.sin(angle) * (ring + 1.5)));
    }

    const sideX = Math.cos(car.heading) * 1.6;
    const sideZ = -Math.sin(car.heading) * 1.6;
    this.officer.placeAt(car.pos.x + sideX, car.pos.y + sideZ, sx, sz);
    this.officer.group.visible = true;
    this.officer.walkTo(sx, sz + 4, 2.4);

    this.current = { call, npcs, s: freshState(), used: new Set() };
    this.mode = 'toScene';

    this.hud.showExit(null);
    this.hud.showIntervention(`${call.type.label} — ${call.type.caller}`);
    this.hud.intLog('Tu arrives sur les lieux. Reste procédural et courtois.', 'info');
  }

  private complete(call: Call): void {
    this.clearNpcs();
    this.current = null;
    this.finishedCall = null;
    this.returnToCarSignal = false;
    this.hud.closeIntervention();
    this.onFinish(call);
  }

  private returnToCar(car: PoliceCar): void {
    this.mode = 'return';
    const sideX = Math.cos(car.heading) * 1.9;
    const sideZ = -Math.sin(car.heading) * 1.9;
    this.officer.walkTo(car.pos.x + sideX, car.pos.y + sideZ, 2.8);
    this.hud.setIntActions([], () => {});
    if (this.current) {
      this.hud.showExit(null);
    }
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
    this.hud.intLog('🚨 Le suspect s\u2019enfuit à la course ! Rattrape-le !', 'bad');
  }

  private menuActions(s: IntState): InterventionAction[] {
    if (!this.current) return [];
    const type = this.current.call.type.key;
    const actions: InterventionAction[] = [];

    switch (type) {
      case 'traffic':
        if (!s.checked) actions.push({ key: 'id', label: '🪪 Contrôler le permis' });
        if (s.checked && s.wanted && !s.arrested) actions.push({ key: 'arrest', label: '⛓️ Procéder à l\u2019interpellation' });
        if (!s.arrested) {
          actions.push({ key: 'pv', label: '📄 Dresser un PV (+35 XP)' });
          actions.push({ key: 'warn', label: '💬 Avertir et relâcher (+15 XP)' });
        }
        break;

      case 'accident':
        if (!s.secured) actions.push({ key: 'secure', label: '🚧 Sécuriser la zone (+20 XP)' });
        if (s.secured && !s.ems) actions.push({ key: 'ems', label: '🚑 Appeler les secours (+30 XP)' });
        if (s.ems) actions.push({ key: 'ids', label: '📋 Relever les identités (+20 XP)' });
        break;

      case 'burglary':
        if (!s.inspected) actions.push({ key: 'inspect', label: '🔍 Examiner la porte forcée (+15 XP)' });
        if (s.inspected && !s.checked && !s.fled && !s.arrested)
          actions.push({ key: 'id', label: '🪪 Contrôler l\u2019individu' });
        if (((s.wanted && !s.fled) || s.held) && !s.arrested && s.inspected)
          actions.push({ key: 'arrest', label: '⛓️ Menotter le suspect' });
        break;

      case 'missing':
        if (!s.questioned) actions.push({ key: 'question', label: '💬 Questionner le déclarant (+20 XP)' });
        if (s.questioned && !s.secured) actions.push({ key: 'diffuse', label: '📡 Diffuser le signalement (+30 XP)' });
        break;

      case 'noise':
        if (!s.warned) actions.push({ key: 'warn', label: '💬 Avertir les organisateurs (+10 XP)' });
        if (s.warned) actions.push({ key: 'pv', label: '📄 Dresser un PV tapage (+20 XP)' });
        break;

      case 'parking':
        if (!s.secured) actions.push({ key: 'tow', label: '🛻 Demander la fourrière (+25 XP)' });
        break;

      case 'suspicious':
        if (!s.checked) actions.push({ key: 'id', label: '🪪 Contrôler l\u2019identité' });
        if (s.checked && !s.inspected && !s.arrested) actions.push({ key: 'frisk', label: '🔍 Fouiller (+20 XP)' });
        if (s.wanted && !s.fled && !s.arrested) actions.push({ key: 'arrest', label: '⛓️ Menotter le suspect' });
        break;
    }

    actions.push({ key: 'finish', label: '✅ Clôturer l\u2019intervention' });
    actions.push({ key: 'exit', label: '🔺 Remonter dans le véhicule' });
    const used = this.current.used;
    return actions.filter((a) => a.key === 'finish' || a.key === 'exit' || !used.has(a.key));
  }

  private openMenu(): void {
    if (!this.current) return;
    this.mode = 'menu';
    this.hud.setIntActions(this.menuActions(this.current.s), (key) => this.handleAction(key));
  }

  private handleAction(key: string): void {
    if (!this.current) return;
    const s = this.current.s;
    const call = this.current.call;

    if (key === 'exit') {
      this.returnToCarSignal = true;
      return;
    }
    if (this.current.used.has(key)) return;
    if (key === 'finish') {
      this.finishedCall = call;
      this.hud.intLog('Retour au véhicule pour terminer l’intervention.', 'info');
      this.returnToCarSignal = true;
      return;
    }

    const give = (xp: number) => this.onXp(xp);
    const refresh = () => this.hud.setIntActions(this.menuActions(s), (k) => this.handleAction(k));

    switch (call.type.key) {
      case 'traffic': {
        if (key === 'id') {
          s.checked = true;
          if (Math.random() < 0.3) {
            s.wanted = true;
            this.hud.intLog('⚠️ Permis suspendu et fichier signalé ! Interpellation possible.', 'bad');
          } else {
            give(5);
            this.hud.intLog('✓ Permis et assurance valides. Conducteur coopératif.', 'good');
          }
        } else if (key === 'pv') {
          give(35);
          this.hud.intLog('📄 PV de circulation dressé et signé.', 'good');
        } else if (key === 'warn') {
          give(15);
          this.hud.intLog('💬 Rappel verbal délivré, le conducteur repart.', 'good');
        } else if (key === 'arrest') {
          s.arrested = true;
          give(60);
          this.hud.intLog('⛓️ Interpellation effectuée dans les règles. Transport au poste.', 'good');
        }
        break;
      }

      case 'accident': {
        if (key === 'secure') {
          s.secured = true;
          give(20);
          this.hud.intLog('🚧 Zone sécurisée, balisage posé.', 'good');
        } else if (key === 'ems') {
          s.ems = true;
          give(30);
          this.hud.intLog('🚑 Secours appelés et en route.', 'good');
        } else if (key === 'ids') {
          give(20);
          this.hud.intLog('📋 Identités relevées, constat établi.', 'good');
        }
        break;
      }

      case 'burglary': {
        if (key === 'inspect') {
          s.inspected = true;
          give(15);
          this.hud.intLog('🔍 Porte forcée confirmée, traces d\u2019outils relevées.', 'good');
        } else if (key === 'id') {
          s.checked = true;
          if (Math.random() < 0.45) {
            this.fleeNow();
            return;
          }
          give(25);
          this.hud.intLog('✓ Identité contrôlée, rien à signaler.', 'good');
        } else if (key === 'arrest') {
          s.arrested = true;
          give(90);
          this.hud.intLog('⛓️ Suspect menotté et placé en garde à vue.', 'good');
        }
        break;
      }

      case 'missing': {
        if (key === 'question') {
          s.questioned = true;
          give(20);
          this.hud.intLog('💬 Le déclarant décrit précisément la personne disparue.', 'good');
        } else if (key === 'diffuse') {
          s.secured = true;
          give(30);
          this.hud.intLog('📡 Signalement diffusé à toutes les patrouilles.', 'good');
        }
        break;
      }

      case 'noise': {
        if (key === 'warn') {
          s.warned = true;
          give(10);
          this.hud.intLog('💬 Les organisateurs baissent le volume. Tenue exemplaire.', 'good');
        } else if (key === 'pv') {
          give(20);
          this.hud.intLog('📄 PV pour tapage nocturne dressé.', 'good');
        }
        break;
      }

      case 'parking': {
        if (key === 'tow') {
          s.secured = true;
          give(25);
          this.hud.intLog('🛻 Fourrière demandée, véhicule enlevé sous peu.', 'good');
        }
        break;
      }

      case 'suspicious': {
        if (key === 'id') {
          s.checked = true;
          if (Math.random() < 0.5) {
            s.wanted = true;
            this.hud.intLog('⚠️ Casier actif ! Effractions non résolues sur son dossier.', 'bad');
          } else {
            give(15);
            this.hud.intLog('✓ Identité contrôlée, déplacement justifié.', 'good');
          }
        } else if (key === 'frisk') {
          s.inspected = true;
          give(20);
          if (s.wanted) this.hud.intLog('🔍 Objets volés trouvés sur lui.', 'bad');
          else this.hud.intLog('🔍 Fouille effectuée, rien à signaler.', 'good');
        } else if (key === 'arrest') {
          s.arrested = true;
          give(70);
          this.hud.intLog('⛓️ Suspect interpellé, belle prise, officier !', 'good');
        }
        break;
      }
    }

    this.current.used.add(key);
    refresh();
  }

  update(dt: number, car: PoliceCar): void {
    if (!this.current || !this.officer.group.visible) return;
    const s = this.current.s;

    switch (this.mode) {
      case 'toScene': {
        this.officer.update(dt);
        if (this.officer.arrived) this.openMenu();
        break;
      }

      case 'menu': {
        this.officer.update(dt);
        if (this.returnToCarSignal) {
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
          s.held = true;
          this.onXp(30);
          this.hud.intLog('✓ Suspect rattrapé et plaqué au sol (+30 XP) !', 'good');
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
