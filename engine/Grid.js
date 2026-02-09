// engine/Grid.js
export class Grid {
  constructor({ size = 25 } = {}) {
    this.size = size;
  }

  snap(value) {
    return Math.round(value / this.size) * this.size;
  }

  snapPoint(x, y) {
    return {
      x: this.snap(x),
      y: this.snap(y),
    };
  }
}
