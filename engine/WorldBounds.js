// engine/WorldBounds.js
export class WorldBounds {
  constructor({
    minX = -500,
    minY = -500,
    maxX = 1500,
    maxY = 1500
  } = {}) {
    this.minX = minX;
    this.minY = minY;
    this.maxX = maxX;
    this.maxY = maxY;
  }

  clampPoint(x, y) {
    return {
      x: Math.max(this.minX, Math.min(this.maxX, x)),
      y: Math.max(this.minY, Math.min(this.maxY, y)),
    };
  }

  containsPoint(x, y) {
    return (
      x >= this.minX &&
      x <= this.maxX &&
      y >= this.minY &&
      y <= this.maxY
    );
  }

  clampObject(obj) {
    const maxX = this.maxX - obj.width;
    const maxY = this.maxY - obj.height;

    obj.x = Math.max(this.minX, Math.min(maxX, obj.x));
    obj.y = Math.max(this.minY, Math.min(maxY, obj.y));
  }
}
