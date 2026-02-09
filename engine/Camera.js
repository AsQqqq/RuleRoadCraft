// engine/Camera.js
export class Camera {
  constructor({
    x = 0,
    y = 0,
    zoom = 1,
    minZoom = 0.2,
    maxZoom = 4,
  } = {}) {
    this.x = x;
    this.y = y;
    this.zoom = zoom;
    this.minZoom = minZoom;
    this.maxZoom = maxZoom;
  }

  clampZoom(z) {
    return Math.max(this.minZoom, Math.min(this.maxZoom, z));
  }

  worldToScreen(wx, wy) {
    return {
      x: wx * this.zoom + this.x,
      y: wy * this.zoom + this.y,
    };
  }

  screenToWorld(sx, sy) {
    return {
      x: (sx - this.x) / this.zoom,
      y: (sy - this.y) / this.zoom,
    };
  }

  panBy(dx, dy) {
    this.x += dx;
    this.y += dy;
  }

  zoomAt(sx, sy, factor, {
    bounds,
    viewportWidth,
    viewportHeight,
    padding = 100,
    minZoom = this.minZoom,
    maxZoom = this.maxZoom,
  } = {}) {
    const before = this.screenToWorld(sx, sy);

    let nextZoom = this.zoom * factor;

    // 🔹 логический минимум зума (от карты)
    if (bounds && viewportWidth && viewportHeight) {
      const logicalMinZoom =
        this.computeMinZoom(bounds, viewportWidth, viewportHeight, padding);

      nextZoom = Math.max(nextZoom, logicalMinZoom);
    }

    // 🔹 жёсткие пределы
    nextZoom = Math.max(minZoom, Math.min(maxZoom, nextZoom));

    this.zoom = nextZoom;

    const after = this.screenToWorld(sx, sy);

    this.x += (after.x - before.x) * this.zoom;
    this.y += (after.y - before.y) * this.zoom;
  }

  setBounds(bounds, viewportWidth, viewportHeight, {
    padding = 0
  } = {}) {
    const zoom = this.zoom;

    // нормализуем padding
    const pad = typeof padding === 'number'
      ? { left: padding, right: padding, top: padding, bottom: padding }
      : {
          left: padding.left ?? 0,
          right: padding.right ?? 0,
          top: padding.top ?? 0,
          bottom: padding.bottom ?? 0
        };

    // границы мира в screen-space
    const worldLeft   = bounds.minX * zoom;
    const worldTop    = bounds.minY * zoom;
    const worldRight  = bounds.maxX * zoom;
    const worldBottom = bounds.maxY * zoom;

    // допустимые границы камеры
    const minX = viewportWidth  - worldRight  - pad.right;
    const maxX = -worldLeft     + pad.left;

    const minY = viewportHeight - worldBottom - pad.bottom;
    const maxY = -worldTop      + pad.top;

    this.x = Math.min(maxX, Math.max(minX, this.x));
    this.y = Math.min(maxY, Math.max(minY, this.y));
  }

  computeMinZoom(bounds, viewportWidth, viewportHeight, padding = 0) {
    const worldWidth  = bounds.maxX - bounds.minX;
    const worldHeight = bounds.maxY - bounds.minY;

    const zoomX = (viewportWidth  - padding * 2) / worldWidth;
    const zoomY = (viewportHeight - padding * 2) / worldHeight;

    // берём минимальный, чтобы мир не стал меньше экрана
    return Math.min(zoomX, zoomY);
  }

}
