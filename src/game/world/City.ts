import * as THREE from 'three';
import { CONFIG, blockCenter, linePosition } from '../config';

export interface ColliderRect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export class City {
  readonly group = new THREE.Group();
  readonly colliders: ColliderRect[] = [];

  constructor() {
    this.buildGround();
    this.buildRoadMarkings();
    this.buildBlocks();
  }

  private buildGround(): void {
    const size = CONFIG.city.worldHalf * 2 + 400;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshStandardMaterial({ color: 0x2b2e34, roughness: 0.95, metalness: 0.0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    this.group.add(ground);
  }

  private buildRoadMarkings(): void {
    const pieces: THREE.BufferGeometry[] = [];
    const n = CONFIG.city.blocksPerSide;
    const lines = n + 1;
    const roadHalf = CONFIG.city.roadWidth / 2;
    const edgeOffset = roadHalf - 0.8;
    const dashLength = 3.0;
    const dashStep = 8.0;
    const segmentHalf = CONFIG.city.blockSize / 2 - 2.0;

    for (let k = 0; k < lines; k++) {
      const pos = linePosition(k);
      for (let c = 0; c < n; c++) {
        const center = blockCenter(c);

        const segLen = segmentHalf * 2;
        const dashCount = Math.max(1, Math.floor((segLen - dashLength) / dashStep));
        const span = (dashCount - 1) * dashStep;
        for (let d = 0; d < dashCount; d++) {
          const along = center - span / 2 + d * dashStep;

          const vertical = new THREE.PlaneGeometry(0.3, dashLength);
          vertical.rotateX(-Math.PI / 2);
          vertical.translate(pos, 0.05, along);
          pieces.push(vertical);

          const horizontal = new THREE.PlaneGeometry(0.3, dashLength);
          horizontal.rotateX(-Math.PI / 2);
          horizontal.rotateY(Math.PI / 2);
          horizontal.translate(along, 0.05, pos);
          pieces.push(horizontal);
        }

        for (const off of [-edgeOffset, edgeOffset]) {
          const edgeVertical = new THREE.PlaneGeometry(0.22, segLen);
          edgeVertical.rotateX(-Math.PI / 2);
          edgeVertical.translate(pos + off, 0.05, center);
          pieces.push(edgeVertical);

          const edgeHorizontal = new THREE.PlaneGeometry(0.22, segLen);
          edgeHorizontal.rotateX(-Math.PI / 2);
          edgeHorizontal.rotateY(Math.PI / 2);
          edgeHorizontal.translate(center, 0.05, pos + off);
          pieces.push(edgeHorizontal);
        }
      }
    }

    const merged = mergeDashes(pieces);
    const material = new THREE.MeshBasicMaterial({
      color: 0xd8d8d2,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4
    });
    const marks = new THREE.Mesh(merged, material);
    marks.renderOrder = 1;
    this.group.add(marks);
  }

  private buildBlocks(): void {
    const slabGeo = new THREE.BoxGeometry(CONFIG.city.blockSize, 0.18, CONFIG.city.blockSize);
    const slabMat = new THREE.MeshStandardMaterial({ color: 0x86898f, roughness: 0.9 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x5f6266, roughness: 0.95 });
    const windowTex = makeWindowTexture();
    const palette = [0xb9b4aa, 0xa39e94, 0xb59f8d, 0xa8adb5, 0x9b8f83, 0xc0b09c];

    const n = CONFIG.city.blocksPerSide;

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const cx = blockCenter(i);
        const cz = blockCenter(j);

        const slab = new THREE.Mesh(slabGeo, slabMat);
        slab.position.set(cx, 0.09, cz);
        slab.receiveShadow = true;
        this.group.add(slab);

        for (const qx of [-1, 1]) {
          for (const qz of [-1, 1]) {
            if (Math.random() > 0.85) continue;

            const margin = 3.5;
            const maxHalf = CONFIG.city.blockSize / 4 - margin;
            const w = rand(12, maxHalf * 2);
            const d = rand(12, maxHalf * 2);
            const distCenter = Math.hypot(cx, cz);
            const heightBase = 44 / (1 + distCenter / 160);
            const h = rand(7, Math.max(10, heightBase));

            const bx = cx + qx * (CONFIG.city.blockSize / 4);
            const bz = cz + qz * (CONFIG.city.blockSize / 4);

            const facadeTex = windowTex.clone();
            facadeTex.repeat.set(Math.max(1, Math.round(w / 5)), Math.max(1, Math.round(h / 4)));
            facadeTex.needsUpdate = true;

            const facadeMat = new THREE.MeshStandardMaterial({
              map: facadeTex,
              color: palette[(i * n + j * 3 + Math.round(w)) % palette.length],
              roughness: 0.85
            });

            const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [
              facadeMat,
              facadeMat,
              roofMat,
              roofMat,
              facadeMat,
              facadeMat
            ]);
            mesh.position.set(bx, 0.18 + h / 2, bz);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.group.add(mesh);

            this.colliders.push({
              minX: bx - w / 2 - 0.3,
              maxX: bx + w / 2 + 0.3,
              minZ: bz - d / 2 - 0.3,
              maxZ: bz + d / 2 + 0.3
            });
          }
        }
      }
    }
  }
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function mergeDashes(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const expanded = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  let total = 0;
  for (const g of expanded) total += g.getAttribute('position').count;
  const pos = new Float32Array(total * 3);
  let offset = 0;
  for (const g of expanded) {
    const p = g.getAttribute('position').array as ArrayLike<number>;
    pos.set(p, offset);
    offset += p.length;
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return merged;
}

function makeWindowTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#c9cbd0';
  ctx.fillRect(0, 0, size, size);

  const cols = 4;
  const rows = 4;
  const pad = 7;
  const winW = (size - pad * (cols + 1)) / cols;
  const winH = (size - pad * (rows + 1)) / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = Math.random() < 0.06;
      const shades = ['#33445c', '#3d5270', '#46608a', '#2c3a50'];
      ctx.fillStyle = lit ? '#d9c793' : shades[Math.floor(Math.random() * shades.length)];
      const x = pad + c * (winW + pad);
      const y = pad + r * (winH + pad);
      ctx.fillRect(x, y, winW, winH);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(x, y, winW, winH * 0.35);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
