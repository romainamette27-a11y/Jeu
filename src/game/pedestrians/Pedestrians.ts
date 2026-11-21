import * as THREE from 'three';
import { CONFIG, blockCenter } from '../config';

interface Ped {
  group: THREE.Group;
  blockI: number;
  blockJ: number;
  t: number;
  speed: number;
  dir: 1 | -1;
  dodgeX: number;
  dodgeZ: number;
  phase: number;
}

const SIDE_MARGIN = 1.8;

const SKIN = [0xd9b08c, 0xc49a6c, 0x8d5524, 0xe8c39e, 0xb87a4f];
const CLOTHES = [0x6b4f3a, 0x44506b, 0x59473a, 0x37545c, 0x703c46, 0x8a8f96, 0x2d2f36, 0x9c5c50];
const PANTS = [0x2b3038, 0x3a3f47, 0x4a4440, 0x22262e];

export class Pedestrians {
  readonly group = new THREE.Group();
  private peds: Ped[] = [];
  private bodyGeo = new THREE.CapsuleGeometry(0.2, 0.55, 3, 8);
  private headGeo = new THREE.SphereGeometry(0.14, 8, 6);
  private legsGeo = new THREE.BoxGeometry(0.32, 0.5, 0.22);
  private skinMats: THREE.MeshStandardMaterial[] = [];
  private clothesMats: THREE.MeshStandardMaterial[] = [];
  private pantsMats: THREE.MeshStandardMaterial[] = [];

  constructor(count = 30) {
    for (const color of SKIN) {
      this.skinMats.push(new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
    }
    for (const color of CLOTHES) {
      this.clothesMats.push(new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
    }
    for (const color of PANTS) {
      this.pantsMats.push(new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
    }

    for (let i = 0; i < count; i++) {
      this.spawnPed();
    }
  }

  private spawnPed(): void {
    const n = CONFIG.city.blocksPerSide;
    const group = new THREE.Group();

    const body = new THREE.Mesh(this.bodyGeo, this.pick(this.clothesMats));
    body.position.y = 0.98;
    body.castShadow = true;
    const legs = new THREE.Mesh(this.legsGeo, this.pick(this.pantsMats));
    legs.position.y = 0.38;
    const head = new THREE.Mesh(this.headGeo, this.pick(this.skinMats));
    head.position.y = 1.52;

    group.add(body, legs, head);
    this.group.add(group);

    const ped: Ped = {
      group,
      blockI: Math.floor(Math.random() * n),
      blockJ: Math.floor(Math.random() * n),
      t: Math.random() * this.perimeter(),
      speed: 1.0 + Math.random() * 0.7,
      dir: Math.random() < 0.5 ? 1 : -1,
      dodgeX: 0,
      dodgeZ: 0,
      phase: Math.random() * Math.PI * 2
    };
    this.placePed(ped);
    this.peds.push(ped);
  }

  private pick<T>(list: T[]): T {
    return list[Math.floor(Math.random() * list.length)];
  }

  private perimeter(): number {
    return 4 * (CONFIG.city.blockSize - SIDE_MARGIN * 2);
  }

  private placePed(ped: Ped): void {
    const half = CONFIG.city.blockSize / 2 - SIDE_MARGIN;
    const side = half * 2;
    const t = ((ped.t % this.perimeter()) + this.perimeter()) % this.perimeter();
    const segment = Math.floor(t / side);
    const u = t - segment * side;
    const cx = blockCenter(ped.blockI);
    const cz = blockCenter(ped.blockJ);

    let x = 0;
    let z = 0;
    let heading = 0;
    if (segment === 0) {
      x = cx - half + u;
      z = cz - half;
      heading = ped.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
    } else if (segment === 1) {
      x = cx + half;
      z = cz - half + u;
      heading = ped.dir === 1 ? 0 : Math.PI;
    } else if (segment === 2) {
      x = cx + half - u;
      z = cz + half;
      heading = ped.dir === 1 ? -Math.PI / 2 : Math.PI / 2;
    } else {
      x = cx - half;
      z = cz + half - u;
      heading = ped.dir === 1 ? Math.PI : 0;
    }

    const dx = ped.dodgeX;
    const dz = ped.dodgeZ;
    ped.group.position.set(x + dx, 0.18, z + dz);
    ped.group.rotation.y = heading;
  }

  update(dt: number, px: number, pz: number): void {
    for (const ped of this.peds) {
      ped.t += ped.speed * ped.dir * dt;
      this.placePed(ped);

      ped.phase += dt * ped.speed * 4.2;
      const lift = Math.abs(Math.sin(ped.phase)) * 0.04;
      ped.group.position.y = 0.18 + lift;

      const pos = ped.group.position;
      const dx = pos.x - px;
      const dz = pos.z - pz;
      const dist = Math.hypot(dx, dz);
      if (dist < 3.4 && dist > 0.1) {
        const push = (3.4 - dist) * 1.6 * dt;
        ped.dodgeX += (dx / dist) * push;
        ped.dodgeZ += (dz / dist) * push;
      }

      const maxDodge = 2.4;
      const len = Math.hypot(ped.dodgeX, ped.dodgeZ);
      if (len > maxDodge) {
        ped.dodgeX = (ped.dodgeX / len) * maxDodge;
        ped.dodgeZ = (ped.dodgeZ / len) * maxDodge;
      }
      ped.dodgeX *= Math.max(0, 1 - dt * 1.5);
      ped.dodgeZ *= Math.max(0, 1 - dt * 1.5);
    }
  }

  dispose(): void {
    this.bodyGeo.dispose();
    this.headGeo.dispose();
    this.legsGeo.dispose();
  }
}
