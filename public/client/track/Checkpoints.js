const COUNT = 7;

// Gates spread around the loop. All of them have to be passed (any order)
// before crossing the start line counts as a lap.
export default class Checkpoints {
  constructor(track) {
    this.track = track;
    this.gates = [];
    const n = track.centerline.length;
    for (let i = 0; i < COUNT; i++) {
      this.gates.push(track.gate(Math.floor((0.08 + 0.92 * i / COUNT) * n)));
    }
    this.passed = new Set();
    this.last = null; // where R puts you back
  }

  get allPassed() {
    return this.passed.size === this.gates.length;
  }

  // True if moving from (x0, y0) to (x1, y1) went through a gate not yet passed this lap.
  update(x0, y0, x1, y1) {
    const i = this.gates.findIndex(g => this.track.crosses(g, x0, y0, x1, y1));
    if (i < 0 || this.passed.has(i)) return false;
    this.passed.add(i);
    this.last = this.gates[i];
    return true;
  }

  newLap() {
    this.passed.clear();
    this.last = this.track.start;
  }

  draw(g) {
    const hw = this.track.halfWidth;
    g.lineStyle(8, 0x29adff);
    for (const { x, y, fx, fy } of this.gates) {
      g.lineBetween(x - fy * hw, y + fx * hw, x + fy * hw, y - fx * hw);
    }
  }
}
