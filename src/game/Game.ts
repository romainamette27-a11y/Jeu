import * as THREE from 'three';
import { CONFIG } from './config';
import { makeEnvTexture } from './world/EnvSky';
import { City } from './world/City';
import { StreetLamps } from './world/StreetLamps';
import { SkyAndLights } from './world/SkyAndLights';
import { PoliceCar } from './vehicle/PoliceCar';
import type { DriveInput } from './input/InputManager';
import { TrafficSystem } from './traffic/TrafficSystem';
import { Pedestrians } from './pedestrians/Pedestrians';
import { ParkedCars } from './city/ParkedCars';
import { Dispatch } from './dispatch/Dispatch';
import { ChaseCamera, FollowTarget, DRIVING_RIG, FOOT_RIG } from './camera/ChaseCamera';
import { Officer } from './officer/Officer';
import { InterventionSystem } from './dispatch/InterventionSystem';
import type { CallTally } from './dispatch/InterventionSystem';
import { loadSave, writeSave, rankFor, type SaveData } from './progression/Progression';
import { InputManager } from './input/InputManager';
import { VirtualControls } from './input/VirtualControls';
import { Siren } from './audio/Siren';
import { Engine } from './audio/Engine';
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
  private parked: ParkedCars;
  private pedestrians: Pedestrians;
  private dispatch: Dispatch;
  private chaseCam: ChaseCamera;
  private input = new InputManager();
  private controls: VirtualControls | null = null;
  private hud: HUD;
  private siren = new Siren();
  private engine = new Engine();
  private sfx = new Sfx();
  private officer = new Officer();
  private intervention: InterventionSystem;
  private readonly idleInput: DriveInput = { steer: 0, throttle: 0, brake: 1, handbrake: true };
  private readonly carFollow: FollowTarget = { x: 0, z: 0, heading: 0 };

  private rafId = 0;
  private running = true;
  private minutes = CONFIG.shift.startMinutes;
  private xp = 0;
  private save: SaveData;
  private offShift = false;
  private shiftXp = 0;
  private shiftCalls = 0;
  private shiftArrests = 0;
  private shiftPv = 0;
  private shiftWarnings = 0;
  private shiftDistance = 0;
  private rankName = 'Cadet';
  private meterActionShown = false;

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.domElement.style.touchAction = 'none';
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 1.0, 1200);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromEquirectangular(makeEnvTexture()).texture;
    this.scene.environmentIntensity = 0.55;
    pmrem.dispose();

    this.city = new City();
    this.scene.add(this.city.group);

    this.lamps = new StreetLamps(this.scene);
    this.sky = new SkyAndLights(this.scene);

    this.car = new PoliceCar();
    this.scene.add(this.car.group);

    this.traffic = new TrafficSystem(280);
    this.scene.add(this.traffic.group);

    this.parked = new ParkedCars(84);
    this.scene.add(this.parked.group);

    this.pedestrians = new Pedestrians(420);
    this.scene.add(this.pedestrians.group);

    this.officer.group.visible = false;
    this.scene.add(this.officer.group);

    this.hud = new HUD();
    this.dispatch = new Dispatch(this.scene, this.hud, this.sfx);
    this.traffic.onPulledOver = (x, z) => {
      this.dispatch.spawnCustomCall('traffic', x, z, 'Interception confirmée — véhicule arrêté. Va contrôler le conducteur.');
    };

    this.save = loadSave();
    this.xp = this.save.totalXp;
    this.rankName = rankFor(this.xp).name;
    this.hud.setXP(this.xp);
    this.hud.setRank(this.rankName);

    this.intervention = new InterventionSystem(
      this.scene,
      this.hud,
      this.officer,
      (call, tally: CallTally) => {
        this.shiftCalls++;
        this.shiftArrests += tally.arrests;
        this.shiftPv += tally.pv;
        this.shiftWarnings += tally.warnings;
        this.addXp(call.type.xp);
        this.dispatch.finishCall(call);
      },
      (xp) => this.addXp(xp)
    );

    this.carFollow.x = this.car.pos.x;
    this.carFollow.z = this.car.pos.y;
    this.carFollow.heading = this.car.heading;
    this.chaseCam = new ChaseCamera(this.camera, this.carFollow);

    this.renderer.domElement.addEventListener('pointerdown', this.onOrbitStart);
    window.addEventListener('pointermove', this.onOrbitMove);
    window.addEventListener('pointerup', this.onOrbitEnd);
    window.addEventListener('pointercancel', this.onOrbitEnd);

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
        ? 'Gauche : volant — Droite : gaz / frein — Glisse l’écran : caméra — 🚨 : sirène'
        : 'ZQSD / Flèches pour conduire — Espace : frein à main — F : sirène — Glisse la souris : caméra',
      8000
    );
    this.hud.radioPush('Centrale DCT', 'Bon service, officier. Les appels arrivent sur ta fréquence.');

    this.loop();
  }

  private isTouchDevice(): boolean {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  private addXp(xp: number): void {
    this.xp += xp;
    this.shiftXp += xp;
    this.hud.setXP(this.xp);

    const rank = rankFor(this.xp).name;
    if (rank !== this.rankName) {
      this.rankName = rank;
      this.hud.setRank(rank);
      this.hud.showHint('🎖️ Promotion ! Nouveau grade : ' + rank, 7000);
    }

    this.save.totalXp = this.xp;
    writeSave(this.save);
  }

  private onFirstGesture = () => {
    this.sfx.unlock();
    this.engine.unlock();
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

  private orbiting = false;
  private orbitX = 0;
  private orbitY = 0;

  private onOrbitStart = (e: PointerEvent) => {
    if (e.target !== this.renderer.domElement) return;
    this.orbiting = true;
    this.orbitX = e.clientX;
    this.orbitY = e.clientY;
    this.renderer.domElement.setPointerCapture(e.pointerId);
  };

  private onOrbitMove = (e: PointerEvent) => {
    if (!this.orbiting) return;
    this.chaseCam.orbit(e.clientX - this.orbitX, e.clientY - this.orbitY);
    this.orbitX = e.clientX;
    this.orbitY = e.clientY;
  };

  private onOrbitEnd = (e: PointerEvent) => {
    if (!this.orbiting) return;
    this.orbiting = false;
    if (this.renderer.domElement.hasPointerCapture(e.pointerId)) {
      this.renderer.domElement.releasePointerCapture(e.pointerId);
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
      this.engine.suspend();
    } else {
      this.running = true;
      this.siren.resume();
      this.engine.resume();
      this.clock.getDelta();
    }
  };

  private loop = () => {
    this.rafId = requestAnimationFrame(this.loop);
    if (!this.running) return;

    const dt = Math.min(this.clock.getDelta(), 0.05);

    this.controls?.sync();
    this.input.sample();

    if (this.offShift) {
      this.sky.update(this.car.group.position, this.minutes);
      this.lamps.update(1 - this.sky.brightness);
      this.city.setNight(1 - this.sky.brightness);
      this.chaseCam.update(dt, this.carFollow, DRIVING_RIG);
      this.hud.update(this.minutes, 0, false);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    const driving = this.intervention.mode === 'driving';

    if (driving) {
      this.car.update(dt, this.input);
      this.resolveCollisions();
      this.shiftDistance += Math.abs(this.car.speed) * dt;
    } else {
      this.car.update(dt, this.idleInput);
      const foot = {
        move: this.input.throttle - this.input.brake,
        turn: this.input.steer
      };
      this.intervention.update(dt, this.car, foot);
    }

    this.minutes = (this.minutes + dt * CONFIG.shift.minutesPerSecond) % 1440;
    this.traffic.update(dt, this.car.pos.x, this.car.pos.y);
    this.parked.update(this.car.pos.x, this.car.pos.y);
    this.pedestrians.update(dt, this.car.pos.x, this.car.pos.y);

    const follow = driving ? this.carFollow : this.officer;
    this.chaseCam.update(dt, follow, driving ? DRIVING_RIG : FOOT_RIG);
    this.sky.update(this.car.group.position, this.minutes);
    this.lamps.update(1 - this.sky.brightness);
    this.city.setNight(1 - this.sky.brightness);

    this.dispatch.update(dt, this.car, this.minutes);

    if (driving) {
      const spawned = this.traffic.maybeSpeeder(dt, this.car.pos.x, this.car.pos.y);
      if (spawned) {
        this.hud.radioPush('Centrale DCT', 'Véhicule en excès de vitesse devant toi — intercepte-le !');
      }
    }

    if (driving) {
      const target = this.dispatch.target;
      if (target && target.onSite) {
        this.hud.showExit(() => this.intervention.start(this.car, target));
      } else {
        this.hud.showExit(() => this.intervention.startPatrol(this.car), '🚶');
      }
    } else if (this.intervention.mode === 'patrol') {
      const dx = this.car.pos.x - this.officer.x;
      const dz = this.car.pos.y - this.officer.z;
      if (Math.hypot(dx, dz) < 4.5) {
        this.hud.showExit(() => this.intervention.enterCar(this.car), '🚔');
      } else {
        this.hud.showExit(null);
      }

      const meter = this.parked.expiredMeterNear(this.officer.x, this.officer.z, 4.5);
      const hasMeterAction = meter !== null;
      if (hasMeterAction !== this.meterActionShown) {
        this.meterActionShown = hasMeterAction;
        this.hud.setIntActions(
          hasMeterAction ? [{ key: 'meter', label: '🎫 Verbaliser l’horodateur (+25 XP)' }] : [],
          (key) => {
            if (key !== 'meter') return;
            const m = this.parked.expiredMeterNear(this.officer.x, this.officer.z, 4.5);
            if (!m) return;
            this.parked.ticket(m);
            this.shiftPv++;
            this.addXp(25);
            this.hud.showHint('🎫 PV stationnement dressé — horodateur en infraction.', 5000);
            this.hud.radioPush('Centrale DCT', 'PV de stationnement émis. Bien joué, officier.');
          }
        );
      }
    } else {
      this.hud.showExit(null);
    }

    this.carFollow.x = this.car.pos.x;
    this.carFollow.z = this.car.pos.y;
    this.carFollow.heading = this.car.heading;

    this.updateGpsTarget(driving ? this.carFollow : this.officer);

    this.hud.update(this.minutes, this.car.speed, this.car.speed < -0.2);
    this.engine.setLevel(Math.abs(this.car.speed) / CONFIG.car.maxSpeed, driving);

    if (this.minutes >= CONFIG.shift.endMinutes) {
      this.endShift();
    }

    this.renderer.render(this.scene, this.camera);
  };

  private updateGpsTarget(anchor: FollowTarget): void {
    const target = this.intervention.activeCall ?? this.dispatch.target;
    if (!target) {
      this.hud.setTarget(null, 0, false);
      return;
    }

    const dx = target.x - anchor.x;
    const dz = target.z - anchor.z;
    const dist = Math.hypot(dx, dz);
    const worldAngle = Math.atan2(dx, dz);
    let rel = worldAngle - anchor.heading;
    if (rel > Math.PI) rel -= Math.PI * 2;
    if (rel < -Math.PI) rel += Math.PI * 2;

    const onsite = this.intervention.activeCall !== null || (dist < 14 && Math.abs(this.car.speed) < 2.5);
    this.hud.setTarget(rel, dist, onsite);
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
    this.renderer.domElement.removeEventListener('pointerdown', this.onOrbitStart);
    window.removeEventListener('pointermove', this.onOrbitMove);
    window.removeEventListener('pointerup', this.onOrbitEnd);
    window.removeEventListener('pointercancel', this.onOrbitEnd);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('pointerdown', this.onFirstGesture);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.input.detach();
    this.siren.dispose();
    this.engine.dispose();
    this.intervention.dispose();
    this.dispatch.dispose();
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }

  private endShift(): void {
    this.offShift = true;
    this.applySiren(false);
    this.intervention.abort();
    this.dispatch.clearCalls();
    this.traffic.cancelSpeeder();

    this.save.totalXp = this.xp;
    this.save.shifts++;
    this.save.calls += this.shiftCalls;
    this.save.arrests += this.shiftArrests;
    this.save.pv += this.shiftPv;
    this.save.warnings += this.shiftWarnings;
    this.save.distance += this.shiftDistance;
    writeSave(this.save);

    const rank = rankFor(this.xp);
    const rankText = rank.nextXp
      ? `${rank.name} — prochain grade à ${rank.nextXp} XP`
      : `${rank.name} — grade maximum atteint`;

    this.hud.showBilan(
      '📋 Fin du service — Bilan',
      [
        ['Appels traités', String(this.shiftCalls)],
        ['Interpellations', String(this.shiftArrests)],
        ['PV dressés', String(this.shiftPv)],
        ['Avertissements', String(this.shiftWarnings)],
        ['XP du service', `+${this.shiftXp}`],
        ['XP total', String(this.xp)],
        ['Distance parcourue', `${(this.save.distance / 1000).toFixed(1)} km`]
      ],
      rankText,
      () => this.resetShift()
    );

    this.sfx.complete();
    this.hud.radioPush('Centrale DCT', 'Service terminé, officier. Rendez-vous au prochain shift !');
  }

  private resetShift(): void {
    this.minutes = CONFIG.shift.startMinutes;
    this.offShift = false;
    this.shiftXp = 0;
    this.shiftCalls = 0;
    this.shiftArrests = 0;
    this.shiftPv = 0;
    this.shiftWarnings = 0;
    this.shiftDistance = 0;

    this.car.pos.set(0, -150);
    this.car.heading = 0;
    this.car.speed = 0;
    this.car.group.position.set(this.car.pos.x, 0, this.car.pos.y);

    this.carFollow.x = this.car.pos.x;
    this.carFollow.z = this.car.pos.y;
    this.carFollow.heading = this.car.heading;
    this.chaseCam.snap(this.carFollow, DRIVING_RIG);

    this.hud.showHint('Nouveau service ! Reste à l’écoute du poste...', 6000);
    this.hud.radioPush('Centrale DCT', 'Nouveau service. La ville compte sur toi, officier.');
    this.clock.getDelta();
  }
}
