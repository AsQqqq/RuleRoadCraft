// ui/selectionBox.js
export class SelectionBox {
  constructor({ viewport, camera, world }) {
    this.viewport = viewport;
    this.camera = camera;
    this.world = world;

    this.node = null;
    this.active = false;

    // screen coordinates of the start point
    this.startX = 0;
    this.startY = 0;
  }

  start(screenX, screenY) {
    this.startX = screenX;
    this.startY = screenY;
    this.active = true;

    const el = document.createElement('div');
    el.className = 'selection-box';
    el.style.left = `${screenX}px`;
    el.style.top = `${screenY}px`;
    el.style.width = '0px';
    el.style.height = '0px';
    document.body.appendChild(el);
    this.node = el;
  }

  update(screenX, screenY) {
    if (!this.active || !this.node) return;

    const x = Math.min(this.startX, screenX);
    const y = Math.min(this.startY, screenY);
    const w = Math.abs(screenX - this.startX);
    const h = Math.abs(screenY - this.startY);

    this.node.style.left = `${x}px`;
    this.node.style.top = `${y}px`;
    this.node.style.width = `${w}px`;
    this.node.style.height = `${h}px`;
  }

  /**
   * Returns the selection rectangle in world coordinates.
   * Uses the viewport offset to convert screen → local → world.
   */
  getWorldRect() {
    if (!this.active || !this.node) return null;

    const rect = this.viewport.getBoundingClientRect();

    const screenX = parseFloat(this.node.style.left);
    const screenY = parseFloat(this.node.style.top);
    const screenW = parseFloat(this.node.style.width);
    const screenH = parseFloat(this.node.style.height);

    // convert screen corners to world
    const topLeft = this.camera.screenToWorld(
      screenX - rect.left,
      screenY - rect.top
    );
    const bottomRight = this.camera.screenToWorld(
      screenX + screenW - rect.left,
      screenY + screenH - rect.top
    );

    return {
      x: topLeft.x,
      y: topLeft.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y
    };
  }

  /**
   * Returns array of object IDs that intersect the selection rect.
   */
  getIntersectingIds() {
    const worldRect = this.getWorldRect();
    if (!worldRect) return [];

    const ids = [];
    for (const obj of this.world.all()) {
      if (rectsIntersect(worldRect, obj)) {
        ids.push(obj.id);
      }
    }
    return ids;
  }

  end() {
    this.active = false;
    if (this.node) {
      this.node.remove();
      this.node = null;
    }
  }
}

/**
 * AABB intersection check.
 */
function rectsIntersect(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}
