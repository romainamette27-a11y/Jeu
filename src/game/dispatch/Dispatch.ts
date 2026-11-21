import * as THREE from 'three';
import { CONFIG, linePosition } from '../config';
import type { PoliceCar } from '../vehicle/PoliceCar';
import type { HUD } from '../ui/HUD';
import type { Sfx } from '../audio/Sfx';

export interface CallType {
  key: string;
  caller: string;
  label: string;
  detail: string;
  xp: number;
  urgency: 'low' | 'mid' | 'high';
}

const CALL_TYPES: CallType[] = [
  { key: 'traffic', caller: 'Centrale DCT', label: 'Contrôle routier', detail: 'Véhicule en excès de vitesse, secteur signalé', xp: 40, urgency: 'mid' },
  { key: 'accident', caller: 'Centrale DCT', label: 'Accident de la circulation', detail: 'Collision signalée, blessés légers possibles', xp: 60, urgency: 'high' },
  { key: 'burglary', caller: 'Opérations', label: 'Effraction', detail: 'Alarme de commerce déclenchée', xp: 80, urgency: 'high' },
  { key: 'missing', caller: 'Opérations', label: 'Personne disparue', detail: 'Signalement de proximité, personne âgée', xp: 50, urgency: 'mid' },
  { key: 'noise', caller: 'Centrale DCT', label: 'Nuisance sonore', detail: 'Tapage nocturne signalé par un riverain', xp: 25, urgency: 'low' },
  { key: 'parking', caller: 'Centrale DCT', label: 'Stationnement gênant', detail: 'Véhicule bloquant la voie de circulation', xp: 25, urgency: 'low' },
  { key: 'suspicious', caller: 'Opérations', label: 'Comportement suspect', detail: 'Individu essayant plusieurs portières de véhicules', xp: 70, urgency: 'mid' }
];

const ONSITE_RADIUS = 14;
const ONSITE_SPEED = 2.5;

export interface Call {
  type: CallType;
  x: number;
  z: number;
  onSite: boolean;
  beacon: THREE.Group;
  ring: THREE.Mesh;
}

export class Dispatch {
  private group = new THREE.Group();
  private calls: Call[] = [];
  private nextIn = 18;
  private totalCalls = 0;

  constructor(
    private scene: THREE.Scene,
    private hud: HUD,
    private sfx: Sfx
  ) {
    scene.add(this.group);
  }

  get target(): Call | null {
    let best: Call | null = null;
    let bestDist = Infinity;
    for (const call of this.calls) {
      const d = Math.hypot(call.x - this.lastPlayerX, call.z - this.lastPlayerZ);
      if (d < bestDist) {
        bestDist = d;
        best = call;
      }
    }
    return best;
  }

  private lastPlayerX = 0;
  private lastPlayerZ = 0;

  update(dt: number, car: PoliceCar, minutes: number): void {
    this.lastPlayerX = car.pos.x;
    this.lastPlayerZ = car.pos.y;

    this.nextIn -= dt;
    if (this.nextIn <= 0 && this.calls.length < 1) {
      this.spawnCall(minutes);
      this.nextIn = 40 + Math.random() * 30;
    }

    for (const call of this.calls) {
      const t = performance.now() * 0.001;
      call.ring.rotation.z = t * 1.2;
      call.beacon.position.y = Math.sin(t * 2) * 0.6;

      const dist = Math.hypot(call.x - car.pos.x, call.z - car.pos.y);
      call.onSite = dist < ONSITE_RADIUS && Math.abs(car.speed) < ONSITE_SPEED;
    }
  }

  private spawnCall(minutes: number): void {
    const type = CALL_TYPES[Math.floor(Math.random() * CALL_TYPES.length)];
    const pos = this.pickRoadPosition();
    if (!pos) return;

    const beacon = new THREE.Group();
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 3.2, 46, 14, 1, true),
      new THREE.MeshBasicMaterial({
        color: type.urgency === 'high' ? 0xff5a4d : 0xffc23d,
        transparent: true,
        opacity: 0.28,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    column.position.y = 23;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.4, 4.6, 32),
      new THREE.MeshBasicMaterial({
        color: 0xffc23d,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.15;
    beacon.add(column, ring);
    beacon.position.set(pos.x, 0, pos.z);
    this.group.add(beacon);

    this.calls.push({ type, x: pos.x, z: pos.z, onSite: false, beacon, ring });
    this.totalCalls++;

    const h = Math.floor(minutes / 60);
    const m = Math.floor(minutes % 60);
    const stamp = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    this.hud.radioPush(`${stamp} — ${type.caller}`, `${type.label} : ${type.detail}`);
    this.hud.setCalls(this.calls.length);
    this.sfx.dispatch();
  }

  private pickRoadPosition(): { x: number; z: number } | null {
    const n = CONFIG.city.blocksPerSide;
    const alongMax = CONFIG.city.worldHalf - 24;
    for (let attempt = 0; attempt < 30; attempt++) {
      const lineCoord = linePosition(Math.floor(Math.random() * (n + 1)));
      const along = (Math.random() * 2 - 1) * alongMax;
      const side = Math.random() < 0.5 ? 6 : -6;
      const vertical = Math.random() < 0.5;
      const x = vertical ? lineCoord + side : along;
      const z = vertical ? along : lineCoord + side;

      const distToPlayer = Math.hypot(x - this.lastPlayerX, z - this.lastPlayerZ);
      if (distToPlayer < 60 || distToPlayer > 480) continue;
      return { x, z };
    }
    return null;
  }

  clearCalls(): void {
    for (const call of this.calls) {
      this.group.remove(call.beacon);
      call.beacon.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          (obj.material as THREE.Material).dispose();
        }
      });
    }
    this.calls = [];
    this.hud.setCalls(0);
  }

  finishCall(call: Call): void {
    const index = this.calls.indexOf(call);
    if (index === -1) return;

    this.group.remove(call.beacon);
    call.beacon.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        (obj.material as THREE.Material).dispose();
      }
    });
    this.calls.splice(index, 1);

    this.hud.radioPush('Centrale DCT', `Code 4 sur ${call.type.label.toLowerCase()}. Excellent travail, officier.`);
    this.hud.setCalls(this.calls.length);
    this.sfx.complete();
  }

  dispose(): void {
    this.scene.remove(this.group);
  }
}
