export const W = 720, H = 820;
export const LEFT = 27, RIGHT = 693, SLOT = (RIGHT - LEFT) / 9;
export const VALUES = [100, 500, 1000, 0, 10000, 0, 1000, 500, 100];
export const RADIUS = 19, PEG_RADIUS = 6.5, DIVIDER_TOP = 661, FLOOR = 796;
export const PEGS = [];
for (let row = 0; row < 12; row++) {
  const count = row % 2 === 0 ? 9 : 8;
  const start = LEFT + SLOT * (row % 2 === 0 ? .5 : 1);
  for (let col = 0; col < count; col++) PEGS.push({x: start + SLOT * col, y: 124 + row * 44, row});
}
export const GUIDES = [
  [{x: LEFT, y: 0}, {x: LEFT, y: 80}, ...Array.from({length: 12}, (_, row) => ({x: LEFT + (row % 2 === 0 ? SLOT / 2 : 0), y: 124 + row * 44})), {x: LEFT, y: FLOOR}],
  [{x: RIGHT, y: 0}, {x: RIGHT, y: 80}, ...Array.from({length: 12}, (_, row) => ({x: RIGHT - (row % 2 === 0 ? SLOT / 2 : 0), y: 124 + row * 44})), {x: RIGHT, y: FLOOR}]
];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export class PlinkoPhysics {
  constructor(random = Math.random) { this.random = random; this.chip = null; }
  drop(x) {
    this.chip = { x: clamp(x, LEFT + RADIUS + 1, RIGHT - RADIUS - 1), y: 51, vx: (this.random() - .5) * 14, vy: 0, angle: 0, spin: (this.random() - .5) * 4, t: 0, lastProgress: 0, lowest: 51, settled: false, slot: null };
    return this.chip;
  }
  step(dt, onHit = () => {}) {
    const c = this.chip;
    if (!c || c.settled) return null;
    c.t += dt; c.vy += 940 * dt; c.vx *= Math.exp(-.17 * dt);
    c.x += c.vx * dt; c.y += c.vy * dt; c.angle += c.spin * dt;
    const collide = (px, py, r, id) => {
      const dx = c.x - px, dy = c.y - py, rr = RADIUS + r, d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr) return;
      const d = Math.sqrt(d2), nx = d > .001 ? dx / d : (this.random() < .5 ? -1 : 1), ny = d > .001 ? dy / d : 0;
      c.x = px + nx * (rr + .08); c.y = py + ny * (rr + .08);
      const vn = c.vx * nx + c.vy * ny;
      if (vn < 0) {
        c.vx -= 1.53 * vn * nx; c.vy -= 1.53 * vn * ny;
        c.spin = clamp(c.vx / RADIUS, -12, 12);
        if (Math.abs(c.vx) < 13 && ny < -.9) c.vx += (this.random() < .5 ? -1 : 1) * 20;
        if (-vn > 28) onHit(id, Math.min(1, -vn / 450));
      }
    };
    for (let i = 0; i < PEGS.length; i++) {
      const p = PEGS[i];
      if (Math.abs(c.y - p.y) < RADIUS + PEG_RADIUS + 4) collide(p.x, p.y, PEG_RADIUS, i);
    }
    for (let side = 0; side < GUIDES.length; side++) {
      const guide = GUIDES[side];
      for (let j = 1; j < guide.length; j++) {
        const a = guide[j - 1], b = guide[j];
        if (c.y < a.y - RADIUS - 4 || c.y > b.y + RADIUS + 4) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const t = clamp(((c.x - a.x) * dx + (c.y - a.y) * dy) / (dx * dx + dy * dy), 0, 1);
        collide(a.x + t * dx, a.y + t * dy, 2.5, 140 + side);
      }
    }
    for (let j = 1; j < 9; j++) {
      const px = LEFT + SLOT * j;
      if (c.y > DIVIDER_TOP - RADIUS - 4) collide(px, clamp(c.y, DIVIDER_TOP, FLOOR), 3.5, 120 + j);
    }
    if (c.x < LEFT + RADIUS) { c.x = LEFT + RADIUS; c.vx = Math.abs(c.vx) * .61; }
    if (c.x > RIGHT - RADIUS) { c.x = RIGHT - RADIUS; c.vx = -Math.abs(c.vx) * .61; }
    if (c.y < RADIUS + 10) { c.y = RADIUS + 10; c.vy = Math.abs(c.vy) * .4; }
    c.vx = clamp(c.vx, -650, 650); c.vy = clamp(c.vy, -550, 950);
    if (c.y > c.lowest + 7) { c.lowest = c.y; c.lastProgress = c.t; }
    if (c.y >= FLOOR - RADIUS) {
      c.y = FLOOR - RADIUS; c.settled = true; c.vx = 0; c.vy = 0;
      c.slot = clamp(Math.floor((c.x - LEFT) / SLOT), 0, 8);
      return {slot: c.slot, value: VALUES[c.slot], time: c.t};
    }
    // A lodged chip is returned for a free re-drop, as on the show.
    if (c.t - c.lastProgress > 7 || c.t > 25) { c.settled = true; return {stuck: true}; }
    return null;
  }
}
