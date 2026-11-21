import * as THREE from 'three';

export class Officer {
  readonly group = new THREE.Group();

  x = 0;
  z = 0;
  heading = 0;
  arrived = true;
  speed = 0;

  private targetX = 0;
  private targetZ = 0;
  private bob = 0;
  private phase = 0;

  private legL: THREE.Group;
  private legR: THREE.Group;
  private armL: THREE.Group;
  private armR: THREE.Group;
  private torso: THREE.Group;

  constructor() {
    const uniform = new THREE.MeshStandardMaterial({ color: 0x1c2a4a, roughness: 0.75 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x182342, roughness: 0.85 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xd9b08c, roughness: 0.8 });
    const capMat = new THREE.MeshStandardMaterial({ color: 0x0d1a33, roughness: 0.7 });
    const vestMat = new THREE.MeshStandardMaterial({ color: 0x14213d, roughness: 0.85 });
    const bootsMat = new THREE.MeshStandardMaterial({ color: 0x101216, roughness: 0.9 });
    const beltMat = new THREE.MeshStandardMaterial({ color: 0x0a0d13, roughness: 0.8 });

    this.torso = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.23, 0.6, 4, 10), uniform);
    body.position.y = 0.98;
    body.castShadow = true;
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.4, 0.34), vestMat);
    vest.position.y = 1.12;
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.08, 0.3), beltMat);
    belt.position.y = 0.7;
    this.torso.add(body, vest, belt);
    this.group.add(this.torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), skin);
    head.position.y = 1.62;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.09, 12), capMat);
    cap.position.y = 1.74;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.12), capMat);
    visor.position.set(0, 1.72, 0.2);
    this.group.add(head, cap, visor);

    const mkLeg = (sideX: number): THREE.Group => {
      const pivot = new THREE.Group();
      pivot.position.set(sideX, 0.88, 0);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.78, 0.18), pants);
      leg.position.y = -0.39;
      leg.castShadow = true;
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.26), bootsMat);
      boot.position.set(0, -0.83, 0.03);
      pivot.add(leg, boot);
      return pivot;
    };

    const mkArm = (sideX: number): THREE.Group => {
      const pivot = new THREE.Group();
      pivot.position.set(sideX, 1.36, 0);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.56, 0.14), uniform);
      arm.position.y = -0.28;
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), skin);
      hand.position.y = -0.58;
      pivot.add(arm, hand);
      return pivot;
    };

    this.legL = mkLeg(-0.1);
    this.legR = mkLeg(0.1);
    this.armL = mkArm(-0.29);
    this.armR = mkArm(0.29);
    this.group.add(this.legL, this.legR, this.armL, this.armR);
  }

  placeAt(x: number, z: number, towardX: number, towardZ: number): void {
    this.x = x;
    this.z = z;
    this.heading = Math.atan2(towardX - x, towardZ - z);
    this.arrived = true;
    this.speed = 0;
    this.group.position.set(x, 0, z);
    this.group.rotation.y = this.heading;
  }

  walkTo(x: number, z: number, speed: number): void {
    this.targetX = x;
    this.targetZ = z;
    this.speed = speed;
    this.arrived = false;
  }

  freeMove(dt: number, turn: number, move: number): void {
    const moving = Math.abs(move) > 0.1;
    const maxTurn = 3.0;
    this.heading -= turn * maxTurn * dt * (moving ? 1 : 0.4);

    const target = Math.max(-1, Math.min(1, move));
    this.speed = target * 3.2 * (target < 0 ? 0.6 : 1);
    const step = this.speed * dt;
    this.x += Math.sin(this.heading) * step;
    this.z += Math.cos(this.heading) * step;
    this.targetX = this.x;
    this.targetZ = this.z;
    this.arrived = true;
  }

  update(dt: number): void {
    if (!this.group.visible) return;

    if (!this.arrived) {
      const dx = this.targetX - this.x;
      const dz = this.targetZ - this.z;
      const dist = Math.hypot(dx, dz);

      if (dist < 0.4) {
        this.arrived = true;
      } else {
        const desired = Math.atan2(dx, dz);
        let diff = (desired - this.heading) % (Math.PI * 2);
        if (diff > Math.PI) diff -= Math.PI * 2;
        if (diff < -Math.PI) diff += Math.PI * 2;
        this.heading += Math.max(-5 * dt, Math.min(5 * dt, diff));

        const step = Math.min(Math.abs(this.speed) * dt, dist);
        this.x += Math.sin(this.heading) * step * Math.sign(this.speed || 1);
        this.z += Math.cos(this.heading) * step * Math.sign(this.speed || 1);
      }
    }

    const moving = !this.arrived || Math.abs(this.speed) > 0.25;
    if (moving) {
      this.phase += dt * Math.abs(this.speed) * 4.2;
      const swing = Math.sin(this.phase);
      const back = this.speed < 0 ? -1 : 1;
      this.legL.rotation.x = swing * 0.62 * back;
      this.legR.rotation.x = -swing * 0.62 * back;
      this.armL.rotation.x = -swing * 0.5 * back;
      this.armR.rotation.x = swing * 0.5 * back;
      this.torso.rotation.x = 0.05;
      this.bob = Math.abs(Math.sin(this.phase)) * 0.05;
    } else {
      const settle = Math.exp(-dt * 6);
      this.legL.rotation.x *= settle;
      this.legR.rotation.x *= settle;
      this.armL.rotation.x *= settle;
      this.armR.rotation.x *= settle;
      this.torso.rotation.x *= settle;
      this.bob *= settle;
    }

    this.group.position.set(this.x, this.bob, this.z);
    this.group.rotation.y = this.heading;
  }
}
