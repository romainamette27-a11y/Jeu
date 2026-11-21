export const CONFIG = {
  city: {
    blocksPerSide: 6,
    blockSize: 64,
    roadWidth: 20,
    worldHalf: 0,
    boundsHalf: 0
  },
  car: {
    maxSpeed: 38,
    reverseMaxSpeed: 8,
    engineForce: 22,
    brakeForce: 30,
    dragCoef: 0.012,
    rollingDrag: 1.6,
    steering: {
      maxAngle: 0.72,
      response: 3.8
    },
    turnRate: 0.12,
    highSpeedSteerFalloff: 0.035,
    collisionRadius: 1.5,
    wheelRadius: 0.34
  },
  camera: {
    distance: 9.0,
    height: 3.8,
    lookAhead: 6.0,
    lookHeight: 1.4,
    stiffness: 5.0
  },
  shift: {
    startMinutes: 8 * 60,
    endMinutes: 16 * 60,
    minutesPerSecond: 2.0
  },
  lights: {
    sunOffset: [60, 90, 35] as [number, number, number],
    shadowExtent: 70
  }
};

CONFIG.city.worldHalf = (CONFIG.city.blocksPerSide * (CONFIG.city.blockSize + CONFIG.city.roadWidth)) / 2;
CONFIG.city.boundsHalf = CONFIG.city.worldHalf - 6;

export function gridPitch(): number {
  return CONFIG.city.blockSize + CONFIG.city.roadWidth;
}

export function linePosition(k: number): number {
  return (k - CONFIG.city.blocksPerSide / 2) * gridPitch();
}

export function blockCenter(i: number): number {
  return linePosition(i) + gridPitch() / 2;
}
