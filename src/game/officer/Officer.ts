import * as THREE from 'three';

export class Officer {
  readonly group = new THREE.Group();

  x = 0;
  z = 0;
  heading = 0;
  arrived = true;

  private targetX = 0;
  private targetZ = 0;
  private speed = 0;
  private bob = 0;

  constructor() {
    const uniform = new THREE.MeshStandardMaterial({ color: 0x1c2a4a, roughness: 0.75 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xd9b08c, roughness: 0.8 });
    const capMat = new THREE.MeshStandardMaterial({ color: 0x0d1a33, roughness: 0.7 });
    const vestMat = new THREE.MeshStandardMaterial({ color: 0x14213d, roughness: 0.85 });

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.23, 0.6, 4, 10), uniform);
    body.position.y = 0.98;
    body.castShadow = true;

    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.4, 0.34), vestMat);
    vest.position.y = 1.12;

    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.5, 0.26), uniform);
    legs.position.y = 0.35;

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), skin);
    head.position.y = 1.62;

    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.09, 12), capMat);
    cap.position.y = 1.74;

    this.group.add(body, vest, legs, head, cap);
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

        const step = Math.min(this.speed * dt, dist);
        this.x += Math.sin(this.heading) * step;
        this.z += Math.cos(this.heading) * step;
      }
    }

    this.bob += dt * this.speed * 4.5;
    const lift = this.arrived ? 0 : Math.abs(Math.sin(this.bob)) * 0.05;
    this.group.position.set(this.x, lift, this.z);
    this.group.rotation.y = this.heading;
  }
}
