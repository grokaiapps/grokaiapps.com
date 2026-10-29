// Position/velocity use panels and panels per second; 20 panels = one turn.
// Tuned interaction model, not measured specifications of the TV prop.
export const FIXED_STEP = 1 / 240;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
// Transfer a deliberate phone-sized pull without spending most of the stroke
// overcoming the grip's lag. Coast friction still controls the heavy slowdown.
const HAND_STIFFNESS = 110;
const HAND_DAMPING = 19;
const MAX_HAND_TORQUE = 42;
const MOTOR_TORQUE = 28;
const STATIC_FRICTION = 1.65;
const ROLLING_FRICTION = 1.4;
const VISCOUS_DRAG = .065;
const PEG_TORQUE = .24;

export function createWheel(position = 0) {
  return {position, velocity: 0, held: false, handTarget: position,
    motor: false, done: true, forwardStart: position, forwardDistance: 0};
}
export function grab(wheel, motor = false) {
  wheel.held = true;
  wheel.motor = motor;
  wheel.handTarget = wheel.position;
  wheel.done = false;
  wheel.forwardStart = wheel.position;
  wheel.forwardDistance = 0;
}
export function moveGrip(wheel, target) {
  if (wheel.held && !wheel.motor) wheel.handTarget = target;
}
export function release(wheel) {
  wheel.held = false;
  wheel.motor = false;
  // No launch impulse, rounding, or change in velocity on release.
}
export function cancelGrip(wheel) {
  wheel.held = false;
  wheel.motor = false;
  wheel.velocity = 0;
  wheel.done = true;
  wheel.forwardStart = wheel.position;
  wheel.forwardDistance = 0;
}
export function step(wheel, dt = FIXED_STEP) {
  if (wheel.done) return 0;
  const oldPosition = wheel.position;
  const oldVelocity = wheel.velocity;
  const hand = wheel.held ? (wheel.motor
    ? clamp(MOTOR_TORQUE - Math.max(0, wheel.velocity - 18) * 12, 0, MOTOR_TORQUE)
    : clamp(HAND_STIFFNESS * (wheel.handTarget - wheel.position) - HAND_DAMPING * wheel.velocity,
      -MAX_HAND_TORQUE, MAX_HAND_TORQUE)) : 0;
  // The small periodic load represents the spring pointer riding over pegs.
  const applied = hand - PEG_TORQUE * Math.sin(2 * Math.PI * wheel.position);
  if (Math.abs(oldVelocity) < .012 && Math.abs(applied) <= STATIC_FRICTION) {
    wheel.velocity = 0;
    wheel.done = !wheel.held;
    return 0;
  }
  const direction = Math.sign(oldVelocity || applied);
  const resistance = ROLLING_FRICTION * direction + VISCOUS_DRAG * oldVelocity;
  let nextVelocity = oldVelocity + (applied - resistance) * dt;
  // Friction can stop a wheel, but cannot by itself reverse it.
  if (oldVelocity * nextVelocity < 0 && Math.abs(applied) <= STATIC_FRICTION) nextVelocity = 0;
  wheel.velocity = nextVelocity;
  wheel.position += (oldVelocity + nextVelocity) * .5 * dt;
  if (nextVelocity < 0) {
    wheel.forwardStart = wheel.position;
    wheel.forwardDistance = 0;
  } else {
    if (oldVelocity <= 0) wheel.forwardStart = oldPosition;
    wheel.forwardDistance = Math.max(0, wheel.position - wheel.forwardStart);
  }
  if (!wheel.held && wheel.velocity === 0) wheel.done = true;
  return Math.floor(wheel.position + .5) - Math.floor(oldPosition + .5);
}
