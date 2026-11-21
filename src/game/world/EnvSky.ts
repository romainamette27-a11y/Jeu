import * as THREE from 'three';

export function makeEnvTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const sky = ctx.createLinearGradient(0, 0, 0, 256);
  sky.addColorStop(0, '#0e1a38');
  sky.addColorStop(0.42, '#4a76b8');
  sky.addColorStop(0.52, '#9fc0e8');
  sky.addColorStop(0.62, '#d8e3ee');
  sky.addColorStop(0.68, '#8e8f88');
  sky.addColorStop(1, '#4a4a46');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 512, 256);

  const glow = ctx.createRadialGradient(360, 78, 4, 360, 78, 90);
  glow.addColorStop(0, 'rgba(255, 246, 220, 0.95)');
  glow.addColorStop(0.25, 'rgba(255, 236, 190, 0.4)');
  glow.addColorStop(1, 'rgba(255, 236, 190, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(250, 0, 260, 190);

  for (let i = 0; i < 26; i++) {
    const y = 120 + Math.random() * 40;
    const w = 30 + Math.random() * 80;
    ctx.fillStyle = `rgba(210, 218, 228, ${0.1 + Math.random() * 0.25})`;
    ctx.fillRect(Math.random() * 512 - 20, y, w, 6 + Math.random() * 12);
  }

  for (let i = 0; i < 14; i++) {
    const x = Math.random() * 512;
    const w = 18 + Math.random() * 46;
    const h = 26 + Math.random() * 40;
    ctx.fillStyle = `rgba(38, 44, 56, ${0.35 + Math.random() * 0.3})`;
    ctx.fillRect(x, 256 - 58 - h, w, h);
    ctx.fillStyle = `rgba(255, 220, 150, ${0.1 + Math.random() * 0.2})`;
    for (let wy = 0; wy < h - 8; wy += 9) {
      if (Math.random() < 0.4) {
        ctx.fillRect(x + 3 + Math.random() * (w - 8), 256 - 54 - h + wy, 4, 5);
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
