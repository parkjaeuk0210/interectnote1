export type JoystickVelocity = {
  // Velocity in screen px per second (to be applied to viewport.x/y).
  vx: number;
  vy: number;
  // Clamped stick displacement in px (useful for rendering the knob).
  clampedDx: number;
  clampedDy: number;
};

export function computeJoystickVelocity(params: {
  dx: number;
  dy: number;
  radiusPx: number;
  deadzonePx: number;
  maxSpeedPxPerSec: number;
}): JoystickVelocity {
  const { dx, dy, radiusPx, deadzonePx, maxSpeedPxPerSec } = params;

  const radius = Math.max(1, radiusPx);
  const deadzone = Math.max(0, deadzonePx);

  const len = Math.hypot(dx, dy);
  if (!Number.isFinite(len) || len <= deadzone) {
    return { vx: 0, vy: 0, clampedDx: 0, clampedDy: 0 };
  }

  const scale = len > radius ? radius / len : 1;
  const clampedDx = dx * scale;
  const clampedDy = dy * scale;

  const nx = clampedDx / radius;
  const ny = clampedDy / radius;

  return {
    vx: nx * maxSpeedPxPerSec,
    vy: ny * maxSpeedPxPerSec,
    clampedDx,
    clampedDy,
  };
}

