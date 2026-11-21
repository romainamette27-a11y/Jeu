import * as THREE from 'three';

export type CarKind = 'sedan' | 'estate' | 'van';

function bodyProfile(kind: CarKind): THREE.Shape {
  const s = new THREE.Shape();
  if (kind === 'van') {
    s.moveTo(-2.35, 0.34);
    s.lineTo(2.35, 0.34);
    s.quadraticCurveTo(2.44, 0.4, 2.44, 0.62);
    s.lineTo(2.4, 1.45);
    s.quadraticCurveTo(2.3, 1.98, 1.95, 2.02);
    s.lineTo(-2.3, 2.02);
    s.quadraticCurveTo(-2.44, 1.95, -2.44, 0.62);
    s.lineTo(-2.35, 0.34);
    return s;
  }
  const half = kind === 'estate' ? 2.28 : 2.1;
  const nose = kind === 'estate' ? 2.34 : 2.18;
  s.moveTo(-half, 0.3);
  s.lineTo(half, 0.3);
  s.quadraticCurveTo(nose, 0.34, nose, 0.52);
  s.lineTo(nose - 0.05, 0.8);
  s.quadraticCurveTo(nose - 0.12, 0.9, half - 0.5, 0.9);
  s.lineTo(0.7, 0.98);
  s.lineTo(-half + 0.85, 0.98);
  s.lineTo(-half + 0.3, 0.9);
  s.quadraticCurveTo(-nose + 0.12, 0.86, -nose + 0.05, 0.6);
  s.lineTo(-half, 0.3);
  return s;
}

function cabinProfile(kind: CarKind): THREE.Shape {
  const c = new THREE.Shape();
  if (kind === 'estate') {
    c.moveTo(1.0, 0);
    c.lineTo(0.55, 0.6);
    c.lineTo(-1.28, 0.62);
    c.quadraticCurveTo(-1.62, 0.6, -1.78, 0.14);
    c.lineTo(-1.88, 0);
    c.lineTo(1.0, 0);
    return c;
  }
  c.moveTo(1.0, 0);
  c.lineTo(0.48, 0.6);
  c.quadraticCurveTo(0.15, 0.7, -0.25, 0.7);
  c.lineTo(-0.78, 0.66);
  c.lineTo(-1.2, 0);
  c.lineTo(1.0, 0);
  return c;
}

function extrude(shape: THREE.Shape, depth: number, bevel: number): THREE.ExtrudeGeometry {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    steps: 1,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 6
  });
  geo.translate(0, 0, -depth / 2);
  geo.rotateY(-Math.PI / 2);
  return geo;
}

export function carPaintGeometry(kind: CarKind): THREE.BufferGeometry {
  return extrude(bodyProfile(kind), kind === 'van' ? 1.58 : 1.5, kind === 'van' ? 0.09 : 0.08);
}

export function carCabinGeometry(kind: CarKind): THREE.BufferGeometry {
  return extrude(cabinProfile(kind), 1.3, 0.05);
}

export function makeCarBody(kind: CarKind, color: number): THREE.Group {
  const group = new THREE.Group();

  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.35 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x22313f, roughness: 0.15, metalness: 0.55 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.85 });
  const headlights = new THREE.MeshStandardMaterial({
    color: 0xd8d3bd,
    emissive: 0xfff1c4,
    emissiveIntensity: 0.35,
    roughness: 0.3
  });
  const taillights = new THREE.MeshStandardMaterial({
    color: 0x4a0d12,
    emissive: 0xff3524,
    emissiveIntensity: 0.4,
    roughness: 0.4
  });

  if (kind === 'van') {
    const body = new THREE.Mesh(extrude(bodyProfile('van'), 1.58, 0.09), paint);
    body.castShadow = true;
    group.add(body);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.52, 0.06), glass);
    windshield.position.set(0, 1.52, 2.08);
    windshield.rotation.x = -0.2;
    group.add(windshield);

    for (const sx of [-0.81, 0.81]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.44, 2.1), glass);
      side.position.set(sx, 1.42, 0.2);
      group.add(side);
    }

    const bumper = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.26, 0.34), trim);
    bumper.position.set(0, 0.42, 2.32);
    group.add(bumper);
    const bumperR = bumper.clone();
    bumperR.position.z = -2.32;
    group.add(bumperR);

    const lights = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.14, 0.08), headlights);
    lights.position.set(0, 0.94, 2.44);
    group.add(lights);
    const tails = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.14, 0.08), taillights);
    tails.position.set(0, 0.94, -2.44);
    group.add(tails);
  } else {
    const body = new THREE.Mesh(extrude(bodyProfile(kind), 1.5, 0.08), paint);
    body.castShadow = true;
    group.add(body);

    const cabin = new THREE.Mesh(extrude(cabinProfile(kind), 1.3, 0.05), glass);
    cabin.position.set(0, kind === 'estate' ? 0.92 : 0.94, kind === 'estate' ? -0.42 : -0.18);
    group.add(cabin);

    const skirt = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.16, kind === 'estate' ? 4.44 : 4.1), trim);
    skirt.position.y = 0.38;
    group.add(skirt);

    const nose = kind === 'estate' ? 2.34 : 2.18;
    const lights = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.12, 0.07), headlights);
    lights.position.set(0, 0.74, nose - 0.02);
    group.add(lights);
    const tails = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.12, 0.07), taillights);
    tails.position.set(0, 0.74, -nose + 0.02);
    group.add(tails);
  }

  return group;
}
