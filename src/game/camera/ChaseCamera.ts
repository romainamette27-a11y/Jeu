import * as THREE from 'three';
import { CONFIG } from '../config';
import type { PoliceCar } from '../vehicle/PoliceCar';

const tmpDesired = new THREE.Vector3();
const tmpLook = new THREE.Vector3();

export class ChaseCamera {
  private cam: THREE.PerspectiveCamera;
  private car: PoliceCar;
  private c = CONFIG.camera;

  constructor(cam: THREE.PerspectiveCamera, car: PoliceCar) {
    this.cam = cam;
    this.car = car;
    this.snap();
  }

  snap(): void {
    this.computeDesired(tmpDesired);
    this.cam.position.copy(tmpDesired);
    this.computeLook(tmpLook);
    this.cam.lookAt(tmpLook);
  }

  update(dt: number): void {
    this.computeDesired(tmpDesired);
    const k = 1 - Math.exp(-dt * this.c.stiffness);
    this.cam.position.lerp(tmpDesired, k);
    this.computeLook(tmpLook);
    this.cam.lookAt(tmpLook);
  }

  private computeDesired(out: THREE.Vector3): void {
    out.set(
      this.car.pos.x - Math.sin(this.car.heading) * this.c.distance,
      this.c.height,
      this.car.pos.y - Math.cos(this.car.heading) * this.c.distance
    );
  }

  private computeLook(out: THREE.Vector3): void {
    out.set(
      this.car.pos.x + Math.sin(this.car.heading) * this.c.lookAhead,
      this.c.lookHeight,
      this.car.pos.y + Math.cos(this.car.heading) * this.c.lookAhead
    );
  }
}
