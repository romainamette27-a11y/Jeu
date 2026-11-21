import * as THREE from 'three';
import { CONFIG, blockCenter } from '../config';

interface Ped {
  group: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  torso: THREE.Mesh;
  blockI: number;
  blockJ: number;
  t: number;
  speed: number;
  baseSpeed: number;
  dir: 1 | -1;
  dodgeX: number;
  dodgeZ: number;
  phase: number;
  wait: number;
}

const SIDE_MARGIN = 1.8;

const SKIN = [0xd9b08c, 0xc49a6c, 0x8d5524, 0xe8c39e, 0xb87a4f, 0x6b4423];
const SHIRTS = [0x6b4f3a, 0x44506b, 0x59473a, 0x37545c, 0x703c46, 0x8a8f96, 0x2d2f36, 0x9c5c50, 0xd7cfc0, 0x35507a];
const PANTS = [0x2b3038, 0x3a3f47, 0x4a4440, 0x22262e, 0x5b5348, 0x1f2933];
const HAIR = [0x1a1a1a, 0x1a1a1a, 0x4a2f1d, 0xc7a24a, 0x9a9a9a, 0x5c3d24, 0x2c2320];

export class Pedestrians {
  readonly group = new THREE.Group();
  private peds: Ped[] = [];

  private legGeo = new THREE.BoxGeometry(0.14, 0.58, 0.17);
  private armGeo = new THREE.BoxGeometry(0.1, 0.5, 0.1);
  private torsoGeo = new THREE.CapsuleGeometry(0.19, 0.5, 3, 8);
  private headGeo = new THREE.SphereGeometry(0.14, 10, 8);
  private hairGeo = new THREE.SphereGeometry(0.148, 10, 6, 0, Math.PI * 2, 0, Math.PI / 1.9);
  private eyeGeo = new THREE.SphereGeometry(0.022, 6, 5);
  private shoeGeo = new THREE.BoxGeometry(0.15, 0.08, 0.25);

  private skinMats: THREE.MeshStandardMaterial[] = [];
  private shirtMats: THREE.MeshStandardMaterial[] = [];
  private pantsMats: THREE.MeshStandardMaterial[] = [];
  private hairMats: THREE.MeshStandardMaterial[] = [];
  private eyeMat = new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.4 });
  private shoeMat = new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.9 });
  private handGeo = new THREE.SphereGeometry(0.05, 6, 5);

  constructor(count = 40) {
    for (const color of SKIN) {
      this.skinMats.push(new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
    }
    for (const color of SHIRTS) {
      this.shirtMats.push(new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
    }
    for (const color of PANTS) {
      this.pantsMats.push(new THREE.MeshStandardMaterial({ color, roughness: 0.92 }));
    }
    for (const color of HAIR) {
      this.hairMats.push(new THREE.MeshStandardMaterial({ color, roughness: 1.0 }));
    }

    for (let i = 0; i < count; i++) {
      this.spawnPed(i);
    }
  }

  private pick<T>(list: T[]): T {
    return list[Math.floor(Math.random() * list.length)];
  }

  private spawnPed(i: number): void {
    const group = new THREE.Group();

    const skin = this.pick(this.skinMats);
    const head = new THREE.Mesh(this.headGeo, skin);
    head.position.y = 1.62;
    const headScale = 0.92 + Math.random() * 0.25;
    head.scale.set(headScale, headScale, headScale);
    const eyeL = new THREE.Mesh(this.eyeGeo, this.eyeMat);
    eyeL.position.set(-0.05, 0.01, 0.125);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.05;
    head.add(eyeL, eyeR);
    group.add(head);

    if (i % 6 !== 0) {
      const hair = new THREE.Mesh(this.hairGeo, this.pick(this.hairMats));
      hair.position.y = 1.635;
      hair.scale.y = 0.85;
      group.add(hair);
    }

    const torso = new THREE.Mesh(this.torsoGeo, this.pick(this.shirtMats));
    torso.position.y = 1.22;
    group.add(torso);

    const pantsMat = this.pick(this.pantsMats);
    const legL = new THREE.Mesh(this.legGeo, pantsMat);
    const legR = new THREE.Mesh(this.legGeo, pantsMat);
    const shoeL = new THREE.Mesh(this.shoeGeo, this.shoeMat);
    shoeL.position.set(0, -0.52, 0.035);
    const shoeR = shoeL.clone();
    legL.add(shoeL);
    legR.add(shoeR);
    const shirtMat = torso.material as THREE.MeshStandardMaterial;
    const armL = new THREE.Mesh(this.armGeo, shirtMat);
    const armR = new THREE.Mesh(this.armGeo, shirtMat);
    const handL = new THREE.Mesh(this.handGeo, skin);
    handL.position.y = -0.52;
    const handR = handL.clone();
    armL.add(handL);
    armR.add(handR);

    const legPivotL = new THREE.Group();
    legPivotL.position.set(-0.09, 0.95, 0);
    legL.position.y = -0.275;
    legPivotL.add(legL);
    const legPivotR = new THREE.Group();
    legPivotR.position.set(0.09, 0.95, 0);
    legR.position.y = -0.275;
    legPivotR.add(legR);

    const armPivotL = new THREE.Group();
    armPivotL.position.set(-0.27, 1.42, 0);
    armL.position.y = -0.24;
    armPivotL.add(armL);
    const armPivotR = new THREE.Group();
    armPivotR.position.set(0.27, 1.42, 0);
    armR.position.y = -0.24;
    armPivotR.add(armR);

    group.add(legPivotL, legPivotR, armPivotL, armPivotR);
    this.group.add(group);

    const baseSpeed = 1.0 + Math.random() * 0.8;
    const ped: Ped = {
      group,
      legL: legPivotL,
      legR: legPivotR,
      armL: armPivotL,
      armR: armPivotR,
      torso,
      blockI: Math.floor(Math.random() * CONFIG.city.blocksPerSide),
      blockJ: Math.floor(Math.random() * CONFIG.city.blocksPerSide),
      t: Math.random() * this.perimeter(),
      speed: baseSpeed,
      baseSpeed,
      dir: Math.random() < 0.5 ? 1 : -1,
      dodgeX: 0,
      dodgeZ: 0,
      phase: Math.random() * Math.PI * 2,
      wait: Math.random() < 0.35 ? 2 + Math.random() * 5 : 0
    };
    this.placePed(ped);
    this.peds.push(ped);
  }

  private perimeter(): number {
    return 4 * (CONFIG.city.blockSize - SIDE_MARGIN * 2);
  }

  private placePed(ped: Ped): void {
    const half = CONFIG.city.blockSize / 2 - SIDE_MARGIN;
    const side = half * 2;
    const per = this.perimeter();
    const t = ((ped.t % per) + per) % per;
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

    ped.group.position.set(x + ped.dodgeX, 0.18, z + ped.dodgeZ);
    ped.group.rotation.y = heading;
  }

  private animateWalk(ped: Ped, dt: number): void {
    const moving = ped.speed > 0.15 && ped.wait <= 0;
    if (moving) {
      ped.phase += dt * ped.speed * 4.6;
      const swing = Math.sin(ped.phase);
      ped.legL.rotation.x = swing * 0.7;
      ped.legR.rotation.x = -swing * 0.7;
      ped.armL.rotation.x = -swing * 0.58;
      ped.armR.rotation.x = swing * 0.58;
      ped.torso.rotation.x = 0.05;
      ped.group.position.y = 0.18 + Math.abs(Math.sin(ped.phase)) * 0.035;
    } else {
      const settle = Math.exp(-dt * 6);
      ped.legL.rotation.x *= settle;
      ped.legR.rotation.x *= settle;
      ped.armL.rotation.x *= settle;
      ped.armR.rotation.x *= settle;
      ped.torso.rotation.x *= settle;
      ped.group.position.y = 0.18;
    }
  }

  update(dt: number, px: number, pz: number): void {
    for (const ped of this.peds) {
      if (ped.wait > 0) {
        ped.wait -= dt;
        if (ped.wait <= 0 && Math.random() < 0.4) {
          ped.dir = ped.dir === 1 ? -1 : 1;
        }
      } else if (Math.random() < dt * 0.05) {
        ped.wait = 2 + Math.random() * 5;
      }

      ped.speed = ped.wait > 0 ? 0 : ped.baseSpeed;
      ped.t += ped.speed * ped.dir * dt;
      this.placePed(ped);
      this.animateWalk(ped, dt);

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
    this.legGeo.dispose();
    this.armGeo.dispose();
    this.torsoGeo.dispose();
    this.headGeo.dispose();
    this.hairGeo.dispose();
    this.eyeGeo.dispose();
    this.shoeGeo.dispose();
    this.handGeo.dispose();
  }
}
