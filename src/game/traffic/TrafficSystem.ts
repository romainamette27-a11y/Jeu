import * as THREE from 'three';
import { CONFIG, gridPitch, linePosition } from '../config';

type Dir = 0 | 1 | 2 | 3;

const DIRV: readonly [number, number][] = [
  [0, 1],
  [1, 0],
  [0, -1],
  [-1, 0]
];

const LANE = 5;
const TURN_RATE = 3.2;
const ROAD_HALF = 8.5;

interface TrafficCar {
  group: THREE.Group;
  x: number;
  z: number;
  heading: number;
  speed: number;
  cruise: number;
  dir: Dir;
  nodeK: number;
  nodeJ: number;
  wx: number;
  wz: number;
  waitTime: number;
}

const PALETTE = [0xc23b2e, 0x2d4fa1, 0xdedede, 0x2a2b2f, 0x9a9fa8, 0xb9832f, 0x3d7a45, 0x7a3d7a];

function rightOf(d: Dir): Dir {
  return ((d + 3) % 4) as Dir;
}

function angleDiff(from: number, to: number): number {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

export class TrafficSystem {
  readonly group = new THREE.Group();
  readonly cars: TrafficCar[] = [];
  private readonly n = CONFIG.city.blocksPerSide;
  private wheels: THREE.InstancedMesh;
  private wheelDummy = new THREE.Object3D();

  constructor(count = 20) {
    this.buildCarMeshes(count);
    this.wheels = this.buildWheels(count);
    this.group.add(this.wheels);
  }

  private buildCarMeshes(count: number): void {
    const bodyGeo = new THREE.BoxGeometry(1.8, 0.6, 4.2);
    const cabinGeo = new THREE.BoxGeometry(1.62, 0.52, 1.9);
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x223347,
      roughness: 0.2,
      metalness: 0.5
    });

    for (let i = 0; i < count; i++) {
      const bodyMat = new THREE.MeshStandardMaterial({
        color: PALETTE[i % PALETTE.length],
        roughness: 0.45,
        metalness: 0.35
      });
      const group = new THREE.Group();
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.66;
      body.castShadow = true;
      const cabin = new THREE.Mesh(cabinGeo, glassMat);
      cabin.position.set(0, 1.2, 0.15);
      group.add(body, cabin);
      this.group.add(group);

      const car = this.pickSpawn(group, i % 2 === 0 ? 10 : 12.5);
      this.cars.push(car);
    }
  }

  private pickSpawn(group: THREE.Group, cruise: number): TrafficCar {
    for (let attempt = 0; attempt < 40; attempt++) {
      const k = Math.floor(Math.random() * (this.n + 1));
      const j = Math.floor(Math.random() * (this.n + 1));
      const d = Math.floor(Math.random() * 4) as Dir;
      if (!this.nodeInBounds(k, j)) continue;
      if (!this.neighbor(k, j, d)) continue;

      const pos = this.nodePos(k, j);
      const along = Math.random() * gridPitch();
      const right = DIRV[rightOf(d)];
      const x = pos.x + DIRV[d][0] * along + right[0] * LANE;
      const z = pos.y + DIRV[d][1] * along + right[1] * LANE;
      if (Math.hypot(x, z + 150) < 30) continue;

      group.position.set(x, 0, z);
      const car: TrafficCar = {
        group,
        x,
        z,
        heading: Math.atan2(DIRV[d][0], DIRV[d][1]),
        speed: cruise * 0.5,
        cruise,
        dir: d,
        nodeK: k + DIRV[d][0],
        nodeJ: j + DIRV[d][1],
        wx: 0,
        wz: 0,
        waitTime: 0
      };
      this.setWaypoint(car);
      return car;
    }
    const fallbackPos = this.nodePos(0, 0);
    group.position.set(fallbackPos.x, 0, fallbackPos.y);
    return {
      group,
      x: fallbackPos.x,
      z: fallbackPos.y,
      heading: 0,
      speed: 0,
      cruise,
      dir: 0,
      nodeK: 0,
      nodeJ: 0,
      wx: fallbackPos.x,
      wz: fallbackPos.y,
      waitTime: 0
    };
  }

  private buildWheels(count: number): THREE.InstancedMesh {
    const geo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 12);
    geo.rotateZ(Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.9 });
    const mesh = new THREE.InstancedMesh(geo, mat, count * 4);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.castShadow = true;

    for (let i = 0; i < count * 4; i++) {
      this.wheelDummy.position.set(0, 0.32, 0);
      this.wheelDummy.rotation.set(0, 0, 0);
      this.wheelDummy.updateMatrix();
      mesh.setMatrixAt(i, this.wheelDummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }

  private nodeInBounds(k: number, j: number): boolean {
    return k >= 0 && k <= this.n && j >= 0 && j <= this.n;
  }

  private neighbor(k: number, j: number, d: Dir): boolean {
    const nk = k + DIRV[d][0];
    const nj = j + DIRV[d][1];
    return this.nodeInBounds(nk, nj);
  }

  private nodePos(k: number, j: number): { x: number; y: number } {
    return { x: linePosition(k), y: linePosition(j) };
  }

  private setWaypoint(car: TrafficCar): void {
    const node = this.nodePos(car.nodeK, car.nodeJ);
    const right = DIRV[rightOf(car.dir)];
    car.wx = node.x + DIRV[car.dir][0] * 12 + right[0] * LANE;
    car.wz = node.y + DIRV[car.dir][1] * 12 + right[1] * LANE;
  }

  private lateralClamp(v: number): number {
    const idx = Math.round(v / gridPitch() + CONFIG.city.blocksPerSide / 2);
    const bounded = Math.max(0, Math.min(CONFIG.city.blocksPerSide, idx));
    const line = linePosition(bounded);
    return Math.max(line - ROAD_HALF, Math.min(line + ROAD_HALF, v));
  }

  private advance(car: TrafficCar): void {
    const options: Dir[] = [car.dir, ((car.dir + 1) % 4) as Dir, ((car.dir + 3) % 4) as Dir];
    const shuffled = Math.random() < 0.4 ? [options[1], options[2], options[0]] : options;
    let chosen: Dir | null = null;

    for (const d of shuffled) {
      if (this.neighbor(car.nodeK, car.nodeJ, d)) {
        chosen = d;
        if (d === car.dir && Math.random() < 0.55) break;
        if (d !== car.dir) break;
      }
    }
    if (chosen === null) {
      for (let d = 0; d < 4; d++) {
        if (this.neighbor(car.nodeK, car.nodeJ, d as Dir)) {
          chosen = d as Dir;
          break;
        }
      }
    }
    if (chosen === null) chosen = ((car.dir + 2) % 4) as Dir;

    car.dir = chosen;
    car.nodeK = car.nodeK + DIRV[chosen][0];
    car.nodeJ = car.nodeJ + DIRV[chosen][1];
    this.setWaypoint(car);
  }

  update(dt: number, px: number, pz: number): void {
    for (const car of this.cars) {
      const desired = Math.atan2(car.wx - car.x, car.wz - car.z);
      const diff = angleDiff(car.heading, desired);
      const maxTurn = TURN_RATE * dt;
      car.heading += Math.max(-maxTurn, Math.min(maxTurn, diff));

      let target = car.cruise;
      if (Math.abs(diff) > 0.22) target = Math.min(target, car.cruise * 0.4);

      const fwdX = Math.sin(car.heading);
      const fwdZ = Math.cos(car.heading);

      const check = (ox: number, oz: number, halfWidth: number, lookahead: number) => {
        const rx = ox - car.x;
        const rz = oz - car.z;
        const ahead = rx * fwdX + rz * fwdZ;
        const lat = Math.abs(rx * fwdZ - rz * fwdX);
        if (ahead > 0 && ahead < lookahead && lat < halfWidth) {
          target = Math.min(target, car.cruise * Math.max(0, (ahead - 5) / (lookahead - 6)));
          if (ahead < 5.5) target = 0;
        }
      };

      check(px, pz, 1.7, 14);
      for (const other of this.cars) {
        if (other === car) continue;
        check(other.x, other.z, 1.5, 12);
      }

      if (car.speed < 0.4) {
        car.waitTime += dt;
        if (car.waitTime > 2.5) target = Math.max(target, 1.6);
      } else {
        car.waitTime = Math.max(0, car.waitTime - dt * 2);
      }

      const accel = target > car.speed ? 8 : -16;
      car.speed = Math.max(0, Math.min(car.cruise, car.speed + accel * dt));
      if (target < car.speed) car.speed = Math.max(target, car.speed - 20 * dt);

      car.x += fwdX * car.speed * dt;
      car.z += fwdZ * car.speed * dt;

      if (car.dir === 0 || car.dir === 2) {
        car.x = this.lateralClamp(car.x);
      } else {
        car.z = this.lateralClamp(car.z);
      }

      const dx = car.wx - car.x;
      const dz = car.wz - car.z;
      if (dx * dx + dz * dz < 20) this.advance(car);

      car.group.position.set(car.x, 0, car.z);
      car.group.rotation.y = car.heading;
    }

    this.updateWheels();
  }

  private updateWheels(): void {
    const offsets = [
      [-0.85, 1.35],
      [0.85, 1.35],
      [-0.85, -1.35],
      [0.85, -1.35]
    ];
    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i];
      const c = Math.cos(car.heading);
      const s = Math.sin(car.heading);
      for (let w = 0; w < 4; w++) {
        const ox = offsets[w][0];
        const oz = offsets[w][1];
        this.wheelDummy.position.set(car.x + ox * c + oz * s, 0.32, car.z - ox * s + oz * c);
        this.wheelDummy.rotation.set(0, car.heading, 0);
        this.wheelDummy.updateMatrix();
        this.wheels.setMatrixAt(i * 4 + w, this.wheelDummy.matrix);
      }
    }
    this.wheels.instanceMatrix.needsUpdate = true;
  }
}
