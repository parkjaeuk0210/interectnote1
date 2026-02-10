import { computeJoystickVelocity } from '../../utils/joystick';

describe('computeJoystickVelocity', () => {
  it('returns zero velocity inside deadzone', () => {
    const out = computeJoystickVelocity({
      dx: 4,
      dy: 5,
      radiusPx: 42,
      deadzonePx: 10,
      maxSpeedPxPerSec: 850,
    });
    expect(out.vx).toBe(0);
    expect(out.vy).toBe(0);
    expect(out.clampedDx).toBe(0);
    expect(out.clampedDy).toBe(0);
  });

  it('clamps displacement to radius and caps speed at max', () => {
    const out = computeJoystickVelocity({
      dx: 1000,
      dy: 0,
      radiusPx: 50,
      deadzonePx: 0,
      maxSpeedPxPerSec: 900,
    });
    expect(out.clampedDx).toBeCloseTo(50, 5);
    expect(out.clampedDy).toBeCloseTo(0, 5);
    expect(out.vx).toBeCloseTo(900, 5);
    expect(out.vy).toBeCloseTo(0, 5);
  });

  it('normalizes diagonal input so magnitude is near max', () => {
    const max = 800;
    const out = computeJoystickVelocity({
      dx: 100,
      dy: 100,
      radiusPx: 50,
      deadzonePx: 0,
      maxSpeedPxPerSec: max,
    });
    const mag = Math.hypot(out.vx, out.vy);
    expect(mag).toBeCloseTo(max, 5);
  });

  it('passes through clamped displacement for knob rendering', () => {
    const out = computeJoystickVelocity({
      dx: 10,
      dy: 0,
      radiusPx: 40,
      deadzonePx: 0,
      maxSpeedPxPerSec: 1000,
    });
    expect(out.clampedDx).toBeCloseTo(10, 5);
    expect(out.clampedDy).toBeCloseTo(0, 5);
  });
});

