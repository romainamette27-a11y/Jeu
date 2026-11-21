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
  private userYaw = 0;
  private userPitch = 0;
  private lastOrbitAt = -1e9;

  constructor(cam: THREE.PerspectiveCamera, target: FollowTarget) {
    this.cam = cam;
    this.snap(target, DRIVING_RIG);
  }

  orbit(dx: number, dy: number): void {
    this.userYaw -= dx * 0.0045;
    this.userPitch = Math.max(-0.08, Math.min(1.05, this.userPitch + dy * 0.004));
    this.lastOrbitAt = performance.now();
  }

  snap(target: FollowTarget, rig: CameraRig = this.rig): void {
    this.userYaw = 0;
    this.userPitch = 0;
    this.lastOrbitAt = -1e9;
    this.rig = { ...rig };
    this.computeDesired(tmpDesired, target, rig);
    this.cur.copy(tmpDesired);
    this.cam.position.copy(tmpDesired);
    this.computeLook(tmpLook, target, rig);
    this.cam.lookAt(tmpLook);
  }

  update(dt: number, target: FollowTarget, rig: CameraRig = this.rig): void {
    if (performance.now() - this.lastOrbitAt > 1600) {
      const decay = Math.exp(-dt * 1.6);
      this.userYaw *= decay;
      this.userPitch *= decay;
      if (Math.abs(this.userYaw) < 0.004) this.userYaw = 0;
      if (Math.abs(this.userPitch) < 0.004) this.userPitch = 0;
    }

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
    const yaw = t.heading + this.userYaw;
    const horiz = Math.cos(this.userPitch) * r.distance;
    out.set(
      t.x - Math.sin(yaw) * horiz,
      r.height + Math.sin(this.userPitch) * r.distance,
      t.z - Math.cos(yaw) * horiz
    );
  }

  private computeLook(out: THREE.Vector3, t: FollowTarget, r: CameraRig): void {
    const yaw = t.heading + this.userYaw;
    out.set(
      t.x + Math.sin(yaw) * r.lookAhead * Math.cos(this.userPitch),
      r.lookHeight + Math.sin(this.userPitch) * r.lookAhead * 0.25,
      t.z + Math.cos(yaw) * r.lookAhead * Math.cos(this.userPitch)
    );
  }
}
