// Four starting spots in two rows behind the start line.
export default class StartingGrid {
  constructor(track) {
    const { x, y, fx, fy, angle } = track.start;
    const hw = track.halfWidth;

    this.slots = [0, 1, 2, 3].map(i => {
      const back = hw * (1.2 + 1.1 * Math.floor(i / 2));
      const side = hw * 0.45 * (i % 2 ? -1 : 1);
      return { x: x - fx * back - fy * side, y: y - fy * back + fx * side, angle, fx, fy };
    });
  }

  slot(i) {
    return this.slots[i] ?? this.slots[0];
  }

  // An open box around the front of each spot.
  draw(g) {
    g.lineStyle(6, 0xfff1e8);
    for (const { x, y, fx, fy } of this.slots) {
      const at = (u, v) => ({ x: x + fx * v - fy * u, y: y + fy * v + fx * u });
      g.strokePoints([at(-24, -8), at(-24, 30), at(24, 30), at(24, -8)]);
    }
  }
}
