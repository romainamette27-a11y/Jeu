import * as THREE from 'three';
import { CONFIG } from './config';
import { City } from './world/City';
import { StreetLamps } from './world/StreetLamps';
import { SkyAndLights } from './world/SkyAndLights';
import { PoliceCar } from './vehicle/PoliceCar';
import { TrafficSystem } from './traffic/TrafficSystem';
import { Dispatch } from './dispatch/Dispatch';
import { ChaseCamera } from './camera/ChaseCamera';
import { InputManager } from './input/InputManager';
import { VirtualControls } from './input/VirtualControls';
import { Siren } from './audio/Siren';
import { Sfx } from './audio/Sfx';
import { HUD } from './ui/HUD';

const tmpVec = new THREE.Vector3();

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();

  private city: City;
  private lamps: StreetLamps;
  private sky: SkyAndLights;
  private car: PoliceCar;
  private traffic: TrafficSystem;
  private dispatch: Dispatch;
  private chaseCam: ChaseCamera;
  private input = new InputManager();
  private controls: VirtualControls | null = null;
  private hud: HUD;
  private siren = new Siren();
  private sfx = new Sfx();

  private rafId = 0;
  private running = true;
  private minutes = CONFIG.shift.startMinutes;
  private xp = 0;

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 1.0, 1200);

    this.city = new City();
    this.scene.add(this.city.group);

    this.lamps = new StreetLamps(this.scene);
    this.sky = new SkyAndLights(this.scene);

    this.car = new PoliceCar();
    this.scene.add(this.car.group);

    this.traffic = new TrafficSystem();
    this.scene.add(this.traffic.group);
    this.chaseCam = new ChaseCamera(this.camera, this.car);

    this.hud = new HUD();
    this.dispatch = new Dispatch(this.scene, this.hud, this.sfx);

    this.input.attach();
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('pointerdown', this.onFirstGesture);
    this.hud.setSirenHandler((on) => this.applySiren(on));
    if (this.isTouchDevice()) {
      this.controls = new VirtualControls(this.input);
    }

    window.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibility);

    this.hud.showHint(
      this.controls
        ? 'Gauche : volant — À droite : gaz / frein — 🚨 : sirène — Suis la flèche GPS !'
        : 'ZQSD / Flèches pour conduire — Espace : frein à main — F : sirène — Suis la flèche GPS !',
      8000
    );
    this.hud.radioPush('Centrale DCT', 'Bon service, officier. Les appels arrivent sur ta fréquence.');

    this.loop();
  }

  private isTouchDevice(): boolean {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  private onFirstGesture = () => {
    this.sfx.unlock();
  };

  private applySiren(on: boolean): void {
    this.car.lightsOn = on;
    this.siren.setEnabled(on);
    this.hud.setSirenVisual(on);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'KeyF') {
      this.applySiren(!this.car.lightsOn);
    }
  };

  private onResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  private onVisibility = () => {
    if (document.hidden) {
      this.running = false;
      this.siren.suspend();
    } else {
      this.running = true;
      this.siren.resume();
      this.clock.getDelta();
    }
  };

  private loop = () => {
    this.rafId = requestAnimationFrame(this.loop);
    if (!this.running) return;

    const dt = Math.min(this.clock.getDelta(), 0.05);

    this.controls?.sync();
    this.input.sample();

    this.car.update(dt, this.input);
    this.resolveCollisions();

    this.minutes = (this.minutes + dt * CONFIG.shift.minutesPerSecond) % 1440;
    this.traffic.update(dt, this.car.pos.x, this.car.pos.y);

    this.chaseCam.update(dt);
    this.sky.update(this.car.group.position, this.minutes);
    this.lamps.update(1 - this.sky.brightness);

    this.dispatch.update(dt, this.car, this.minutes, (xp) => {
      this.xp += xp;
      this.hud.setXP(this.xp);
    });
    this.updateGpsTarget();

    this.hud.update(this.minutes, this.car.speed, this.car.speed < -0.2);

    this.renderer.render(this.scene, this.camera);
  };

  private updateGpsTarget(): void {
    const target = this.dispatch.target;
    if (!target) {
      this.hud.setTarget(null, 0, false, 0);
      return;
    }

    const dx = target.x - this.car.pos.x;
    const dz = target.z - this.car.pos.y;
    const dist = Math.hypot(dx, dz);
    const worldAngle = Math.atan2(dx, dz);
    let rel = worldAngle - this.car.heading;
    if (rel > Math.PI) rel -= Math.PI * 2;
    if (rel < -Math.PI) rel += Math.PI * 2;

    const onsite = dist < 14 && Math.abs(this.car.speed) < 2.5;
    this.hud.setTarget(rel, dist, onsite, this.dispatch.targetOnsiteProgress(target));
  }

  private resolveCollisions(): void {
    const r = CONFIG.car.collisionRadius;
    const b = CONFIG.city.boundsHalf;

    if (Math.abs(this.car.pos.x) > b || Math.abs(this.car.pos.y) > b) {
      this.car.pos.x = THREE.MathUtils.clamp(this.car.pos.x, -b, b);
      this.car.pos.y = THREE.MathUtils.clamp(this.car.pos.y, -b, b);
      this.car.speed *= 0.5;
    }

    for (const rect of this.city.colliders) {
      if (
        this.car.pos.x < rect.minX - 4 ||
        this.car.pos.x > rect.maxX + 4 ||
        this.car.pos.y < rect.minZ - 4 ||
        this.car.pos.y > rect.maxZ + 4
      ) {
        continue;
      }

      const closestX = THREE.MathUtils.clamp(this.car.pos.x, rect.minX, rect.maxX);
      const closestZ = THREE.MathUtils.clamp(this.car.pos.y, rect.minZ, rect.maxZ);
      const dx = this.car.pos.x - closestX;
      const dz = this.car.pos.y - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < r * r) {
        const dist = Math.sqrt(distSq);
        if (dist < 1e-4) {
          tmpVec.set(this.car.pos.x - (rect.minX + rect.maxX) / 2, 0, this.car.pos.y - (rect.minZ + rect.maxZ) / 2);
          tmpVec.normalize();
          this.car.pos.x += tmpVec.x * r;
          this.car.pos.y += tmpVec.z * r;
        } else {
          const push = (r - dist) / dist;
          this.car.pos.x += dx * push;
          this.car.pos.y += dz * push;
        }
        this.car.speed *= 0.25;
      }
    }

    for (const other of this.traffic.cars) {
      const dx = this.car.pos.x - other.x;
      const dz = this.car.pos.y - other.z;
      const distSq = dx * dx + dz * dz;
      const minDist = 2.7;
      if (distSq < minDist * minDist && distSq > 1e-6) {
        const dist = Math.sqrt(distSq);
        const push = (minDist - dist) / dist;
        this.car.pos.x += dx * push;
        this.car.pos.y += dz * push;
        this.car.speed *= 0.5;
      }
    }
  }

  dispose(): void {
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('pointerdown', this.onFirstGesture);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.input.detach();
    this.siren.dispose();
    this.dispatch.dispose();
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}
