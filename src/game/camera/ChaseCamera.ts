import * as THREE from 'three';
import { CONFIG } from '../config';

const tmpDesired = new THREE.Vector3();
const tmpLook = new THREE.Vector3();

export interface FollowTarget {
  x: number;
  z: number;
  heading: number;
}

export interface CameraRig {
  distance: number;
  height: number;
  lookAhead: number;
  lookHeight: number;
}

const DRIVING_RIG: CameraRig = {
  distance: CONFIG.camera.distance,
  height: CONFIG.camera.height,
  lookAhead: CONFIG.camera.lookAhead,
  lookHeight: CONFIG.camera.lookHeight
};

const FOOT_RIG: CameraRig = {
  distance: 6.2,
  height: 3.0,
  lookAhead: 3.0,
  lookHeight: 1.2
};

export { DRIVING_RIG, FOOT_RIG };

export class ChaseCamera {
  private cam: THREE.PerspectiveCamera;
  private cur = new THREE.Vector3();
  private rig: CameraRig = { ...DRIVING_RIG };

  constructor(cam: THREE.PerspectiveCamera, target: FollowTarget) {
    this.cam = cam;
    this.snap(target, DRIVING_RIG);
  }

  snap(target: FollowTarget, rig: CameraRig = this.rig): void {
    this.rig = { ...rig };
    this.computeDesired(tmpDesired, target, rig);
    this.cur.copy(tmpDesired);
    this.cam.position.copy(tmpDesired);
    this.computeLook(tmpLook, target, rig);
    this.cam.lookAt(tmpLook);
  }

  update(dt: number, target: FollowTarget, rig: CameraRig = this.rig): void {
    this.rig.distance += (rig.distance - this.rig.distance) * Math.min(1, dt * 3);
    this.rig.height += (rig.height - this.rig.height) * Math.min(1, dt * 3);
    this.rig.lookAhead += (rig.lookAhead - this.rig.lookAhead) * Math.min(1, dt * 3);
    this.rig.lookHeight += (rig.lookHeight - this.rig.lookHeight) * Math.min(1, dt * 3);

    this.computeDesired(tmpDesired, target, this.rig);
    const k = 1 - Math.exp(-dt * CONFIG.camera.stiffness);
    this.cur.lerp(tmpDesired, k);
    this.cam.position.copy(this.cur);
    this.computeLook(tmpLook, target, this.rig);
    this.cam.lookAt(tmpLook);
  }

  private computeDesired(out: THREE.Vector3, t: FollowTarget, r: CameraRig): void {
    out.set(t.x - Math.sin(t.heading) * r.distance, r.height, t.z - Math.cos(t.heading) * r.distance);
  }

  private computeLook(out: THREE.Vector3, t: FollowTarget, r: CameraRig): void {
    out.set(t.x + Math.sin(t.heading) * r.lookAhead, r.lookHeight, t.z + Math.cos(t.heading) * r.lookAhead);
  }
}
