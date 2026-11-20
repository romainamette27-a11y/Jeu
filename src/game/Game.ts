import * as THREE from 'three';
import { CONFIG } from './config';
import { City } from './world/City';
import { SkyAndLights } from './world/SkyAndLights';
import { PoliceCar } from './vehicle/PoliceCar';
import { ChaseCamera } from './camera/ChaseCamera';
import { InputManager } from './input/InputManager';
import { VirtualControls } from './input/VirtualControls';
import { HUD } from './ui/HUD';

const tmpVec = new THREE.Vector3();

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();

  private city: City;
  private sky: SkyAndLights;
  private car: PoliceCar;
  private chaseCam: ChaseCamera;
  private input = new InputManager();
  private controls: VirtualControls | null = null;
  private hud: HUD;

  private rafId = 0;
  private running = true;

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 1200);

    this.city = new City();
    this.scene.add(this.city.group);

    this.sky = new SkyAndLights(this.scene);

    this.car = new PoliceCar();
    this.scene.add(this.car.group);

    this.chaseCam = new ChaseCamera(this.camera, this.car);
    this.hud = new HUD();

    this.input.attach();
    if (this.isTouchDevice()) {
      this.controls = new VirtualControls(this.input);
    }

    window.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibility);

    this.hud.showHint(
      this.controls
        ? 'Gauche : volant — À droite : gaz / frein — Bonne patrouille, officier !'
        : 'ZQSD / Flèches pour conduire — Espace : frein à main',
      7000
    );

    this.loop();
  }

  private isTouchDevice(): boolean {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  private onResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  private onVisibility = () => {
    if (document.hidden) {
      this.running = false;
    } else {
      this.running = true;
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
    this.chaseCam.update(dt);
    this.sky.update(this.car.group.position);
    this.hud.update(dt, this.car.speed, this.car.speed < -0.2);

    this.renderer.render(this.scene, this.camera);
  };

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
  }

  dispose(): void {
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.input.detach();
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}
