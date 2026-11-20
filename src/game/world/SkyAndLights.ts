import * as THREE from 'three';
import { CONFIG } from '../config';

const DAY_TOP = new THREE.Color(0x3f6ea8);
const NIGHT_TOP = new THREE.Color(0x081226);
const DAY_HORIZON = new THREE.Color(0xcfd9e4);
const NIGHT_HORIZON = new THREE.Color(0x182231);
const DAY_SUN = new THREE.Color(0xffe9c4);
const NIGHT_MOON = new THREE.Color(0x8ea6d8);

export class SkyAndLights {
  readonly sun: THREE.DirectionalLight;
  brightness = 1;

  private hemi: THREE.HemisphereLight;
  private skyMat: THREE.ShaderMaterial;
  private fog: THREE.Fog;

  constructor(scene: THREE.Scene) {
    const hemi = new THREE.HemisphereLight(0xbdd3e6, 0x55524a, 0.85);
    scene.add(hemi);
    this.hemi = hemi;

    const sun = new THREE.DirectionalLight(0xffe9c4, 2.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 320;
    const e = CONFIG.lights.shadowExtent;
    sun.shadow.camera.left = -e;
    sun.shadow.camera.right = e;
    sun.shadow.camera.top = e;
    sun.shadow.camera.bottom = -e;
    sun.shadow.bias = -0.0004;
    scene.add(sun);
    scene.add(sun.target);
    this.sun = sun;

    this.fog = new THREE.Fog(0xcfd9e4, 140, 620);
    scene.fog = this.fog;

    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x3f6ea8) },
        horizonColor: { value: new THREE.Color(0xcfd9e4) }
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        varying vec3 vDir;
        void main() {
          float h = clamp(normalize(vDir).y, 0.0, 1.0);
          vec3 col = mix(horizonColor, topColor, pow(h, 0.55));
          gl_FragColor = vec4(col, 1.0);
        }
      `
    });
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(900, 24, 12), this.skyMat));
  }

  update(focus: THREE.Vector3, minutes: number): void {
    const dayFactor = (minutes - 6 * 60) / (12 * 60);
    const angle = Math.max(-0.12, Math.min(1.12, dayFactor)) * Math.PI;
    const elev = Math.sin(Math.max(0, Math.min(1, dayFactor)) * Math.PI);
    this.brightness = Math.min(1, elev * 1.5);
    const night = 1 - this.brightness;

    this.sun.position.set(focus.x + Math.cos(angle) * 80, Math.sin(angle) * 90 + 8, focus.z + 40);
    this.sun.target.position.copy(focus);
    this.sun.target.updateMatrixWorld();
    this.sun.intensity = 0.25 + 1.95 * elev;
    this.sun.color.lerpColors(NIGHT_MOON, DAY_SUN, this.brightness);

    this.hemi.intensity = 0.14 + 0.71 * this.brightness;

    const top = this.skyMat.uniforms.topColor.value as THREE.Color;
    const horizon = this.skyMat.uniforms.horizonColor.value as THREE.Color;
    top.lerpColors(NIGHT_TOP, DAY_TOP, this.brightness);
    horizon.lerpColors(NIGHT_HORIZON, DAY_HORIZON, this.brightness);
    this.fog.color.copy(horizon);
    this.fog.near = 120 - night * 60;
    this.fog.far = 620 - night * 220;
  }
}
