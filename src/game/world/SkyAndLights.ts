import * as THREE from 'three';
import { CONFIG } from '../config';

export class SkyAndLights {
  readonly sun: THREE.DirectionalLight;

  constructor(scene: THREE.Scene) {
    const hemi = new THREE.HemisphereLight(0xbdd3e6, 0x55524a, 0.85);
    scene.add(hemi);

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

    scene.fog = new THREE.Fog(0xcfd9e4, 140, 620);
    scene.add(this.buildSkyDome());
  }

  update(focus: THREE.Vector3): void {
    this.sun.position.set(
      focus.x + CONFIG.lights.sunOffset[0],
      focus.y + CONFIG.lights.sunOffset[1],
      focus.z + CONFIG.lights.sunOffset[2]
    );
    this.sun.target.position.copy(focus);
    this.sun.target.updateMatrixWorld();
  }

  private buildSkyDome(): THREE.Mesh {
    const geo = new THREE.SphereGeometry(900, 24, 12);
    const mat = new THREE.ShaderMaterial({
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
    return new THREE.Mesh(geo, mat);
  }
}
