import * as THREE from 'three';
import { CONFIG, linePosition } from '../config';

export class StreetLamps {
  private readonly headMat = new THREE.MeshStandardMaterial({
    color: 0x2a2d33,
    emissive: 0xffd9a0,
    emissiveIntensity: 0.05,
    roughness: 0.6
  });
  private readonly poolMat = new THREE.MeshBasicMaterial({
    color: 0xffdba0,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  constructor(scene: THREE.Scene) {
    const n = CONFIG.city.blocksPerSide;
    const delta = CONFIG.city.roadWidth / 2 + 1.5;

    const posts: THREE.BufferGeometry[] = [];
    const heads: THREE.BufferGeometry[] = [];
    const pools: THREE.BufferGeometry[] = [];

    const postProto = new THREE.CylinderGeometry(0.1, 0.14, 5.4, 8).toNonIndexed();
    const headProto = new THREE.BoxGeometry(0.8, 0.22, 0.36).toNonIndexed();
    const poolProto = new THREE.CircleGeometry(6.5, 20).toNonIndexed();
    poolProto.rotateX(-Math.PI / 2);

    for (let k = 0; k <= n; k++) {
      for (let j = 0; j <= n; j++) {
        const x = linePosition(k);
        const z = linePosition(j);

        for (const [ox, oz] of [
          [delta, delta],
          [-delta, -delta]
        ]) {
          const px = x + ox;
          const pz = z + oz;

          const post = postProto.clone();
          post.translate(px, 2.7, pz);
          posts.push(post);

          const head = headProto.clone();
          head.translate(px, 5.45, pz);
          heads.push(head);

          const pool = poolProto.clone();
          pool.translate(px, 0.07, pz);
          pools.push(pool);
        }
      }
    }

    scene.add(this.merge(posts, new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.7 })));
    scene.add(this.merge(heads, this.headMat));
    const poolMesh = this.merge(pools, this.poolMat);
    poolMesh.renderOrder = 2;
    scene.add(poolMesh);
  }

  private merge(geos: THREE.BufferGeometry[], material: THREE.Material): THREE.Mesh {
    let total = 0;
    for (const g of geos) total += g.getAttribute('position').count;
    const pos = new Float32Array(total * 3);
    let offset = 0;
    for (const g of geos) {
      const p = g.getAttribute('position').array as ArrayLike<number>;
      pos.set(p, offset);
      offset += p.length;
    }
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return new THREE.Mesh(merged, material);
  }

  update(glow: number): void {
    this.headMat.emissiveIntensity = 0.05 + glow * 2.6;
    this.poolMat.opacity = glow * 0.2;
  }
}
