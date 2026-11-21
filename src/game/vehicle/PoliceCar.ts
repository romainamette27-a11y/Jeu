import * as THREE from 'three';
import { CONFIG } from '../config';

export interface DriveInput {
  steer: number;
  throttle: number;
  brake: number;
  handbrake: boolean;
}

export class PoliceCar {
  readonly group = new THREE.Group();

  lightsOn = false;

  pos = new THREE.Vector2(0, -150);
  heading = 0;
  speed = 0;

  private steerAngle = 0;
  private wheelSpin = 0;
  private readonly frontPivots: THREE.Group[] = [];
  private readonly allWheels: THREE.Mesh[] = [];
  private readonly barRed: THREE.MeshStandardMaterial;
  private readonly barBlue: THREE.MeshStandardMaterial;
  private readonly c = CONFIG.car;

  constructor() {
    this.group.position.set(this.pos.x, 0, this.pos.y);
    this.buildBody();
    this.buildWheels();
    const [red, blue] = this.buildLightbar();
    this.barRed = red;
    this.barBlue = blue;
  }

  private buildBody(): void {
    const white = new THREE.MeshStandardMaterial({ color: 0xe9e9ea, roughness: 0.4, metalness: 0.25 });
    const black = new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.6, metalness: 0.3 });
    const glass = new THREE.MeshStandardMaterial({
      color: 0x1d2b3a,
      roughness: 0.15,
      metalness: 0.6,
      transparent: true,
      opacity: 0.92
    });

    const livery = new THREE.MeshStandardMaterial({
      map: makeLiveryTexture(),
      roughness: 0.4,
      metalness: 0.25
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.62, 4.6), [
      livery,
      livery,
      white,
      black,
      white,
      white
    ]);
    body.position.y = 0.72;
    body.castShadow = true;
    this.group.add(body);

    const lowerTrim = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.2, 4.64), black);
    lowerTrim.position.y = 0.5;
    this.group.add(lowerTrim);

    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.16, 1.5), black);
    hood.position.set(0, 1.04, 1.5);
    hood.castShadow = true;
    this.group.add(hood);

    const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.16, 1.1), black);
    trunk.position.set(0, 1.04, -1.72);
    trunk.castShadow = true;
    this.group.add(trunk);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.58, 2.2), glass);
    cabin.position.set(0, 1.32, 0.12);
    cabin.castShadow = true;
    this.group.add(cabin);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.1, 1.5), white);
    roof.position.set(0, 1.62, 0.12);
    roof.castShadow = true;
    this.group.add(roof);

    const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.26, 0.34), black);
    bumper.position.set(0, 0.5, 2.42);
    this.group.add(bumper);
    const bumperRear = bumper.clone();
    bumperRear.position.z = -2.42;
    this.group.add(bumperRear);

    const grille = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.2, 0.06), black);
    grille.position.set(0, 0.8, 2.31);
    this.group.add(grille);
  }

  private buildWheels(): void {
    const wheelGeo = new THREE.CylinderGeometry(this.c.wheelRadius, this.c.wheelRadius, 0.26, 18);
    wheelGeo.rotateZ(Math.PI / 2);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x101114, roughness: 0.9 });
    const rimGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.27, 10);
    rimGeo.rotateZ(Math.PI / 2);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xb9bcc2, roughness: 0.35, metalness: 0.7 });

    const positions: [number, number][] = [
      [-0.95, -1.55],
      [0.95, -1.55],
      [-0.95, 1.55],
      [0.95, 1.55]
    ];

    for (const [x, z] of positions) {
      const pivot = new THREE.Group();
      pivot.position.set(x, this.c.wheelRadius, z);

      const wheel = new THREE.Mesh(wheelGeo, tireMat);
      wheel.castShadow = true;
      const rim = new THREE.Mesh(rimGeo, rimMat);
      wheel.add(rim);

      pivot.add(wheel);
      this.group.add(pivot);

      this.allWheels.push(wheel);
      if (z > 0) this.frontPivots.push(pivot);
    }
  }

  private buildLightbar(): [THREE.MeshStandardMaterial, THREE.MeshStandardMaterial] {
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.09, 0.34),
      new THREE.MeshStandardMaterial({ color: 0x15171c })
    );
    base.position.set(0, 1.72, 0.12);
    this.group.add(base);

    const red = new THREE.MeshStandardMaterial({
      color: 0x8a0f18,
      emissive: 0xff2222,
      emissiveIntensity: 2.0
    });
    const blue = new THREE.MeshStandardMaterial({
      color: 0x0f2050,
      emissive: 0x2266ff,
      emissiveIntensity: 0.05
    });

    const redMesh = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.3), red);
    redMesh.position.set(-0.3, 1.83, 0.12);
    const blueMesh = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.3), blue);
    blueMesh.position.set(0.3, 1.83, 0.12);
    this.group.add(redMesh, blueMesh);

    return [red, blue];
  }

  update(dt: number, input: DriveInput): void {
    const speedAbs = Math.abs(this.speed);

    const maxSteer = this.c.steering.maxAngle / (1 + speedAbs * this.c.highSpeedSteerFalloff);
    const steerTarget = -input.steer * maxSteer;
    this.steerAngle += (steerTarget - this.steerAngle) * Math.min(1, dt * this.c.steering.response);

    let accel = 0;
    if (input.throttle > 0) {
      if (this.speed < -0.2) {
        accel += this.c.brakeForce * input.throttle;
      } else {
        accel += this.c.engineForce * input.throttle * Math.max(0, 1 - speedAbs / this.c.maxSpeed);
      }
    }
    if (input.brake > 0) {
      if (this.speed > 0.2) {
        accel -= this.c.brakeForce * input.brake;
      } else {
        accel -= this.c.engineForce * 0.3 * input.brake * Math.max(0, 1 - speedAbs / this.c.reverseMaxSpeed);
      }
    }

    const driveSign = Math.sign(this.speed);
    const drag = -driveSign * (this.c.rollingDrag + this.c.dragCoef * speedAbs * speedAbs);
    this.speed += (accel + drag) * dt;

    if (input.handbrake) {
      this.speed -= driveSign * Math.min(Math.abs(this.speed), 14 * dt);
      if (Math.abs(this.speed) < 0.6) this.speed = 0;
    }

    if (input.throttle === 0 && input.brake === 0 && Math.abs(this.speed) < 0.5) this.speed = 0;
    this.speed = Math.max(-this.c.reverseMaxSpeed, Math.min(this.c.maxSpeed, this.speed));

    if (Math.abs(this.speed) > 0.15) {
      this.heading += this.steerAngle * this.speed * this.c.turnRate * dt;
    }

    const dirX = Math.sin(this.heading);
    const dirZ = Math.cos(this.heading);
    this.pos.x += dirX * this.speed * dt;
    this.pos.y += dirZ * this.speed * dt;

    this.group.position.set(this.pos.x, 0, this.pos.y);
    this.group.rotation.y = this.heading;

    this.wheelSpin += (this.speed / this.c.wheelRadius) * dt;
    for (const wheel of this.allWheels) wheel.rotation.x = this.wheelSpin;
    for (const pivot of this.frontPivots) pivot.rotation.y = this.steerAngle;

    if (!this.lightsOn) {
      this.barRed.emissiveIntensity = 0.05;
      this.barBlue.emissiveIntensity = 0.05;
      return;
    }

    const t = performance.now() * 0.0045;
    const toggle = Math.floor(t) % 2 === 0;
    this.barRed.emissiveIntensity = toggle ? 2.6 : 0.05;
    this.barBlue.emissiveIntensity = toggle ? 0.05 : 2.6;
  }
}

function makeLiveryTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 144;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#f2f3f5';
  ctx.fillRect(0, 0, 1024, 144);

  ctx.fillStyle = '#16338f';
  ctx.fillRect(0, 96, 1024, 34);

  ctx.save();
  ctx.translate(392, 74);
  ctx.transform(1, 0, -0.18, 1, 0, 0);
  ctx.fillStyle = '#16338f';
  ctx.font = 'italic 900 62px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('POLICE', 0, 0);
  ctx.restore();

  ctx.fillStyle = '#16338f';
  ctx.fillRect(88, 44, 442, 5);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
