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
  baseCruise: number;
  dir: Dir;
  nodeK: number;
  nodeJ: number;
  wx: number;
  wz: number;
  waitTime: number;
}

const PALETTE = [
  0xe8e8e4,
  0xe8e8e4,
  0x9a9fa8,
  0x2a2b2f,
  0x24335c,
  0x6b2230,
  0x2d4a35,
  0xb7b1a4,
  0xc9c2b4
];

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
  private speeder: TrafficCar | null = null;
  private speederState: 'chase' | 'pulling' = 'chase';
  private speederTimer = 0;
  private speederCd = 45 + Math.random() * 40;
  private marker: THREE.Mesh | null = null;
  onPulledOver: ((x: number, z: number) => void) | null = null;

  constructor(count = 28) {
    this.buildCarMeshes(count);
    this.wheels = this.buildWheels(count);
    this.group.add(this.wheels);
  }

  private buildCarMeshes(count: number): void {
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x223347,
      roughness: 0.2,
      metalness: 0.5
    });
    const headlightMat = new THREE.MeshStandardMaterial({
      color: 0xd8d3bd,
      emissive: 0xfff1c4,
      emissiveIntensity: 0.35,
      roughness: 0.3
    });
    const taillightMat = new THREE.MeshStandardMaterial({
      color: 0x4a0d12,
      emissive: 0xff3524,
      emissiveIntensity: 0.4,
      roughness: 0.4
    });

    for (let i = 0; i < count; i++) {
      const group = new THREE.Group();
      const kind = i % 3;

      if (kind === 2) {
        const bodyMat = new THREE.MeshStandardMaterial({
          color: 0xe8e8e4,
          roughness: 0.5,
          metalness: 0.25
        });
        const vanBody = new THREE.Mesh(new THREE.BoxGeometry(1.94, 1.36, 4.7), bodyMat);
        vanBody.position.y = 0.98;
        vanBody.castShadow = true;
        const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 0.08), glassMat);
        windshield.position.set(0, 1.32, 2.32);
        const band = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.34, 4.72), bodyMat);
        band.position.y = 0.5;
        const lights = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.14, 0.08), headlightMat);
        lights.position.set(0, 0.88, 2.36);
        const tails = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.14, 0.08), taillightMat);
        tails.position.set(0, 0.88, -2.36);
        group.add(vanBody, windshield, band, lights, tails);
      } else {
        const bodyMat = new THREE.MeshStandardMaterial({
          color: PALETTE[i % PALETTE.length],
          roughness: 0.45,
          metalness: 0.35
        });
        const isBreak = kind === 1;
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, isBreak ? 4.6 : 4.2), bodyMat);
        body.position.y = 0.66;
        body.castShadow = true;
        const cabin = new THREE.Mesh(
          new THREE.BoxGeometry(1.62, 0.52, isBreak ? 2.8 : 1.9),
          glassMat
        );
        cabin.position.set(0, 1.2, isBreak ? -0.3 : 0.15);
        const lights = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.13, 0.07), headlightMat);
        lights.position.set(0, 0.78, isBreak ? 2.31 : 2.11);
        const tails = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.13, 0.07), taillightMat);
        tails.position.set(0, 0.78, isBreak ? -2.31 : -2.11);
        group.add(body, cabin, lights, tails);
      }

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
        baseCruise: cruise,
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
      baseCruise: cruise,
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

  maybeSpeeder(dt: number, px: number, pz: number): boolean {
    if (this.speeder) {
      this.speederTimer += dt;
      if (this.speederTimer > 32) {
        this.speeder.cruise = this.speeder.baseCruise;
        this.releaseMarker();
        this.speeder = null;
      }
      return false;
    }

    this.speederCd -= dt;
    if (this.speederCd > 0) return false;

    const candidates = this.cars.filter((car) => {
      const d = Math.hypot(car.x - px, car.z - pz);
      return d > 22 && d < 130;
    });
    if (candidates.length === 0) return false;

    const car = candidates[Math.floor(Math.random() * candidates.length)];
    this.speeder = car;
    this.speederState = 'chase';
    this.speederTimer = 0;
    this.speederCd = 90 + Math.random() * 50;
    car.cruise = car.baseCruise * 1.9;

    const marker = new THREE.Mesh(
      new THREE.ConeGeometry(0.55, 1.1, 4),
      new THREE.MeshBasicMaterial({ color: 0xffc23d, transparent: true, opacity: 0.85, depthWrite: false })
    );
    marker.rotation.x = Math.PI;
    marker.position.set(car.x, 3.1, car.z);
    this.group.add(marker);
    this.marker = marker;
    return true;
  }

  cancelSpeeder(): void {
    if (this.speeder) {
      this.speeder.cruise = this.speeder.baseCruise;
      this.speederState = 'chase';
      this.speederTimer = 0;
      this.speeder = null;
      this.releaseMarker();
    }
  }

  private releaseMarker(): void {
    if (this.marker) {
      this.group.remove(this.marker);
      this.marker.geometry.dispose();
      (this.marker.material as THREE.Material).dispose();
      this.marker = null;
    }
  }

  update(dt: number, px: number, pz: number): void {
    if (this.speeder && this.marker) {
      const t = performance.now() * 0.001;
      this.marker.position.set(this.speeder.x, 3.1 + Math.sin(t * 3) * 0.25, this.speeder.z);
      this.marker.rotation.y = t * 2;
    }

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

      if (car === this.speeder) {
        if (this.speederState === 'chase') {
          const d = Math.hypot(car.x - px, car.z - pz);
          if (d < 70) this.speederState = 'pulling';
          target = Math.max(target, car.cruise * 0.25);
        } else {
          target = 0;
          if (car.speed < 0.2) {
            this.speederState = 'chase';
            const sx = car.x;
            const sz = car.z;
            this.releaseMarker();
            this.speeder = null;
            const idx = this.cars.indexOf(car);
            if (idx !== -1) this.cars.splice(idx, 1);
            this.onPulledOver?.(sx, sz);
          }
        }
      }

      if (car.speed < 0.4) {
        car.waitTime += dt;
        if (car.waitTime > 2.5 && car !== this.speeder) target = Math.max(target, 1.6);
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
