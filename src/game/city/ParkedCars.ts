import * as THREE from 'three';
import { CONFIG, linePosition } from '../config';
import { makeCarBody } from '../vehicle/carShapes';

const CAR_COLORS = [0xbfc3c9, 0x5c6470, 0x1d2b4a, 0x742c34, 0x54626e, 0xd8d3bd, 0x2d2f36, 0x9c5c50, 0x35507a];

interface Meter {
  x: number;
  z: number;
  paid: boolean;
  screen: THREE.MeshBasicMaterial;
}

export class ParkedCars {
  readonly group = new THREE.Group();
  private items: { g: THREE.Object3D; x: number; z: number }[] = [];
  private meters: Meter[] = [];

  expiredMeterNear(px: number, pz: number, radius: number): Meter | null {
    let best: Meter | null = null;
    let bestDist = radius;
    for (const m of this.meters) {
      if (m.paid) continue;
      const d = Math.hypot(m.x - px, m.z - pz);
      if (d < bestDist) {
        bestDist = d;
        best = m;
      }
    }
    return best;
  }

  ticket(meter: Meter): void {
    meter.paid = true;
    meter.screen.color.setHex(0x57d97a);
  }

  update(px: number, pz: number): void {
    for (const it of this.items) {
      it.g.visible = Math.hypot(it.x - px, it.z - pz) < 150;
    }
  }

  constructor(count = 80) {
    const n = CONFIG.city.blocksPerSide;
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.9 });

    for (let i = 0; i < count; i++) {
      const vertical = Math.random() < 0.5;
      const line = Math.floor(Math.random() * (n + 1));
      const lineC = linePosition(line);
      const seg = Math.floor(Math.random() * n);
      const from = linePosition(seg) + 15;
      const to = linePosition(seg + 1) - 15;
      const slotLen = (to - from) / Math.max(1, Math.floor((to - from) / 6));

      const along = from + (Math.floor(Math.random() * Math.max(1, Math.floor((to - from) / 6))) + 0.5) * slotLen + (Math.random() - 0.5) * 1.2;
      const side = Math.random() < 0.5 ? 1 : -1;
      const lat = side * (6.6 + Math.random() * 0.6);
      const x = vertical ? lineC + lat : along;
      const z = vertical ? along : lineC + lat;
      if (Math.hypot(x, z + 150) < 34) continue;

      const kindRoll = Math.random();
      const kind = kindRoll < 0.55 ? 'sedan' : kindRoll < 0.85 ? 'estate' : 'van';
      const color = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
      const car = makeCarBody(kind, color);

      for (const wx of [-0.79, 0.79]) {
        for (const wz of [-1.35, 1.35]) {
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 12), wheelMat);
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(wx, 0.32, wz);
          car.add(wheel);
        }
      }

      car.position.set(x, 0, z);
      car.rotation.y = vertical
        ? (Math.random() < 0.5 ? 0 : Math.PI)
        : (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
      this.group.add(car);
      this.items.push({ g: car, x, z });

      if (Math.random() < 0.55) {
        const paid = Math.random() < 0.6;
        const mx = vertical ? lineC + side * 9.0 : along + (Math.random() - 0.5) * 4;
        const mz = vertical ? along + (Math.random() - 0.5) * 4 : lineC + side * 9.0;
        const rotY = vertical ? (side > 0 ? -Math.PI / 2 : Math.PI / 2) : side > 0 ? Math.PI : 0;
        this.meters.push(this.makeMeter(mx, mz, paid, rotY));
      }
    }
  }

  private makeMeter(x: number, z: number, paid: boolean, rotY: number): Meter {
    const group = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: 0x2a2e36, roughness: 0.6, metalness: 0.5 });

    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.95, 8), metal);
    post.position.y = 0.48;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.34, 0.14), metal);
    head.position.y = 1.08;
    const screenColor = paid ? 0x35d16f : 0xe8452c;
    const screen = new THREE.MeshBasicMaterial({ color: screenColor });
    const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.2), screen);
    screenMesh.position.set(0, 1.1, 0.075);

    group.add(post, head, screenMesh);
    group.position.set(x, 0, z);
    group.rotation.y = rotY;
    this.items.push({ g: group, x, z });
    return { x, z, paid, screen };
  }
}
