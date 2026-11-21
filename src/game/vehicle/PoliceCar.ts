import * as THREE from 'three';
import { CONFIG } from '../config';
import { carPaintGeometry, carCabinGeometry } from './carShapes';

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

    const livery = new THREE.MeshStandardMaterial({
      map: makeLiveryTexture(),
      roughness: 0.4,
      metalness: 0.25
    });

    const body = new THREE.Mesh(carPaintGeometry('sedan'), white);
    body.castShadow = true;
    this.group.add(body);

    const decal = new THREE.PlaneGeometry(4.2, 0.34);
    const decalL = new THREE.Mesh(decal, livery);
    decalL.position.set(-0.846, 0.7, 0);
    decalL.rotation.y = -Math.PI / 2;
    const decalR = new THREE.Mesh(decal, livery);
    decalR.position.set(0.846, 0.7, 0);
    decalR.rotation.y = Math.PI / 2;
    this.group.add(decalL, decalR);

    const lowerTrim = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.14, 4.06), black);
    lowerTrim.position.y = 0.36;
    this.group.add(lowerTrim);

    const glass = new THREE.MeshStandardMaterial({
      color: 0x1d2b3a,
      roughness: 0.15,
      metalness: 0.6,
      transparent: true,
      opacity: 0.85
    });
    const cabin = new THREE.Mesh(carCabinGeometry('sedan'), glass);
    cabin.position.set(0, 0.94, -0.18);
    cabin.castShadow = true;
    this.group.add(cabin);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.08, 1.3), white);
    roof.position.set(0, 1.66, -0.2);
    roof.castShadow = true;
    this.group.add(roof);

    const bumper = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.26, 0.34), black);
    bumper.position.set(0, 0.44, 2.3);
    this.group.add(bumper);
    const bumperRear = bumper.clone();
    bumperRear.position.z = -2.3;
    this.group.add(bumperRear);

    const grille = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 0.06), black);
    grille.position.set(0, 0.66, 2.2);
    this.group.add(grille);

    const headlights = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.12, 0.06), new THREE.MeshStandardMaterial({ color: 0xd8d3bd, emissive: 0xfff1c4, emissiveIntensity: 0.35, roughness: 0.3 }));
    headlights.position.set(0, 0.78, 2.19);
    this.group.add(headlights);
    const taillights = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.12, 0.06), new THREE.MeshStandardMaterial({ color: 0x4a0d12, emissive: 0xff3524, emissiveIntensity: 0.4, roughness: 0.4 }));
    taillights.position.set(0, 0.78, -2.17);
    this.group.add(taillights);
  }

  private buildWheels(): void {
    const wheelGeo = new THREE.CylinderGeometry(this.c.wheelRadius, this.c.wheelRadius, 0.26, 18);
    wheelGeo.rotateZ(Math.PI / 2);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x101114, roughness: 0.9 });
    const rimGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.27, 10);
    rimGeo.rotateZ(Math.PI / 2);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xb9bcc2, roughness: 0.35, metalness: 0.7 });

    const positions: [number, number][] = [
      [-0.78, -1.55],
      [0.78, -1.55],
      [-0.78, 1.55],
      [0.78, 1.55]
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
    base.position.set(0, 1.72, -0.15);
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
    redMesh.position.set(-0.3, 1.83, -0.15);
    const blueMesh = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.3), blue);
    blueMesh.position.set(0.3, 1.83, -0.15);
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
