// ui/debug.js
export class DebugOverlay {
  constructor({ world, camera, grid, viewport, bounds, selectedIds }) {
    this.world = world;
    this.camera = camera;
    this.grid = grid;
    this.viewport = viewport;
    this.bounds = bounds;
    this.selectedIds = selectedIds;

    this.mouseScreen = { x: 0, y: 0 };
    this.mouseWorld = { x: 0, y: 0 };

    this.lastTime = performance.now();
    this.fps = 0;

    this.node = this.createNode();
    this.bind();
    this.loop();
  }

  createNode() {
    const el = document.createElement('div');
    el.className = 'debug-overlay';
    document.body.appendChild(el);
    return el;
  }

  bind() {
    this.viewport.addEventListener('mousemove', (e) => {
      const rect = this.viewport.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      this.mouseScreen.x = sx;
      this.mouseScreen.y = sy;

      const w = this.camera.screenToWorld(sx, sy);
      this.mouseWorld.x = w.x;
      this.mouseWorld.y = w.y;
    });
  }

  loop = () => {
    const now = performance.now();
    const delta = now - this.lastTime;
    this.lastTime = now;
    this.fps = 1000 / delta;

    this.render(delta);
    requestAnimationFrame(this.loop);
  };

  fpsClass(fps) {
    if (fps >= 50) return 'fps-good';
    if (fps >= 30) return 'fps-ok';
    return 'fps-bad';
  }

  render(delta) {
    const fps = this.fps.toFixed(0);
    const frame = delta.toFixed(1);
    const selCount = this.selectedIds ? this.selectedIds.size : 0;

    this.node.innerHTML = `
      <div class="debug-title">Debug</div>

      <div class="debug-section">
        <div class="debug-label">Performance</div>
        <div class="debug-row">
          <span class="debug-key">FPS</span>
          <span class="debug-val ${this.fpsClass(this.fps)}">${fps}</span>
        </div>
        <div class="debug-row">
          <span class="debug-key">Frame</span>
          <span class="debug-val dim">${frame} ms</span>
        </div>
      </div>

      <div class="debug-section">
        <div class="debug-label">Mouse</div>
        <div class="debug-row">
          <span class="debug-key">Screen</span>
          <span class="debug-val">${this.mouseScreen.x.toFixed(0)}, ${this.mouseScreen.y.toFixed(0)}</span>
        </div>
        <div class="debug-row">
          <span class="debug-key">World</span>
          <span class="debug-val">${this.mouseWorld.x.toFixed(0)}, ${this.mouseWorld.y.toFixed(0)}</span>
        </div>
      </div>

      <div class="debug-section">
        <div class="debug-label">Camera</div>
        <div class="debug-row">
          <span class="debug-key">Position</span>
          <span class="debug-val">${this.camera.x.toFixed(0)}, ${this.camera.y.toFixed(0)}</span>
        </div>
        <div class="debug-row">
          <span class="debug-key">Zoom</span>
          <span class="debug-val">${this.camera.zoom.toFixed(2)}x</span>
        </div>
      </div>

      <div class="debug-section">
        <div class="debug-label">World</div>
        <div class="debug-row">
          <span class="debug-key">Bounds</span>
          <span class="debug-val dim">${this.bounds.minX},${this.bounds.minY} - ${this.bounds.maxX},${this.bounds.maxY}</span>
        </div>
        <div class="debug-row">
          <span class="debug-key">Objects</span>
          <span class="debug-val">${this.world.all().length}</span>
        </div>
        <div class="debug-row">
          <span class="debug-key">Selected</span>
          <span class="debug-val">${selCount}</span>
        </div>
        <div class="debug-row">
          <span class="debug-key">Grid</span>
          <span class="debug-val dim">${this.grid.size}px</span>
        </div>
      </div>
    `;
  }
}
