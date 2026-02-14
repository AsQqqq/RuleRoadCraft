import { World } from '../engine/World.js';
import { GameObject } from '../engine/GameObject.js';
import { Camera } from '../engine/Camera.js';
import { Renderer } from './renderer.js';
import { InputController } from './input.js';
import { Grid } from '../engine/Grid.js';
import { DebugOverlay } from './debug.js';
import { WorldBounds } from '../engine/WorldBounds.js';
import { AxisOverlay } from './axisOverlay.js';
import { BoundsOverlay } from './boundsOverlay.js';
import { ObjectMenu } from './objectMenu.js';
import { ObjectRegistry } from '../engine/objects/ObjectRegistry.js';
import { OBJECT_HEADERS } from '../objects/headers.js';
import { GhostRenderer } from './ghostRenderer.js';
import { SelectionBox } from './selectionBox.js';
import { RoadNetwork } from '../engine/road/RoadNetwork.js';
import { RoadRenderer } from './roadRenderer.js';
import { RoadTool } from './roadTool.js';
import { RoadToolUI } from './roadToolUI.js';


const registry = new ObjectRegistry();
for (const entry of OBJECT_HEADERS) {
  registry.register(entry);
}

const objectMenu = new ObjectMenu({ registry });

const bounds = new WorldBounds({
  minX: 0,
  minY: 0,
  maxX: 5500,
  maxY: 2500
});

const world = new World();
const camera = new Camera();

const viewport = document.getElementById('canvas');
const container = document.getElementById('canvasContainer');

const renderer = new Renderer({ world, container });

const grid = new Grid({ size: 25 });

new AxisOverlay();

// ─── Selection state (shared Set) ───
const selectedIds = new Set();

const selectionBox = new SelectionBox({ viewport, camera, world });

// ─── Road System ───
const roadNetwork = new RoadNetwork();
const roadRenderer = new RoadRenderer({ container, network: roadNetwork, bounds });
const roadTool = new RoadTool({
  network: roadNetwork,
  renderer: roadRenderer,
  camera,
  viewport,
  bounds,
  grid
});
const roadToolUI = new RoadToolUI({ roadTool });
roadTool.setUI(roadToolUI);

// ─── Ghost (object placement) ───
const ghost = new GhostRenderer({ container });
let ghostActive = false;
let ghostDef = null;
let ghostObjectClass = null;

window.addEventListener('object-drag-start', (e) => {
  ghostDef = e.detail.definition;
  ghostObjectClass = e.detail.ObjectClass;

  ghost.show(ghostDef);
  ghostActive = true;
});

window.addEventListener('mousemove', (e) => {
  if (!ghostActive) return;

  const rect = viewport.getBoundingClientRect();
  const pos = camera.screenToWorld(
    e.clientX - rect.left,
    e.clientY - rect.top
  );

  const snapped = grid.snapPoint(
    pos.x - ghostDef.width / 2,
    pos.y - ghostDef.height / 2
  );

  ghost.move(snapped.x, snapped.y);
});

window.addEventListener('mouseup', () => {
  if (!ghostActive) return;

  const x = parseFloat(ghost.node.style.left);
  const y = parseFloat(ghost.node.style.top);

  // Проверка: внутри ли границ мира
  const inside =
    bounds.containsPoint(x, y) &&
    bounds.containsPoint(
      x + ghostDef.width,
      y + ghostDef.height
    );

  if (inside) {
    const canPlace =
      ghostObjectClass.canPlace(world, x, y);

    if (canPlace) {
      world.add(new GameObject({
        type: ghostDef.type,
        x,
        y,
        width: ghostDef.width,
        height: ghostDef.height,
        layer: ghostDef.layer
      }));

      renderer.render(selectedIds);
    }
  }

  ghost.hide();
  ghostActive = false;
  ghostDef = null;
  ghostObjectClass = null;

  // Re-open object menu after placement
  objectMenu.open();
});

// ─── Clipboard (copy / paste) ───
let clipboard = []; // array of { type, x, y, width, height, layer, offsetX, offsetY }

window.addEventListener('keydown', (e) => {
  // Ignore when typing in inputs
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  // Ctrl+C — copy selected objects
  if ((e.key === 'c' || e.key === 'с') && (e.ctrlKey || e.metaKey)) {
    if (selectedIds.size === 0) return;
    e.preventDefault();

    // find center of selection for relative offsets
    let minX = Infinity, minY = Infinity;
    for (const id of selectedIds) {
      const obj = world.get(id);
      if (!obj) continue;
      if (obj.x < minX) minX = obj.x;
      if (obj.y < minY) minY = obj.y;
    }

    clipboard = [];
    for (const id of selectedIds) {
      const obj = world.get(id);
      if (!obj) continue;
      clipboard.push({
        type: obj.type,
        width: obj.width,
        height: obj.height,
        layer: obj.layer,
        offsetX: obj.x - minX,
        offsetY: obj.y - minY
      });
    }
    return;
  }

  // Ctrl+V — paste copied objects
  if ((e.key === 'v' || e.key === 'м') && (e.ctrlKey || e.metaKey)) {
    if (clipboard.length === 0) return;
    e.preventDefault();

    // paste at current mouse world position (or center of viewport)
    const rect = viewport.getBoundingClientRect();
    const centerWorld = camera.screenToWorld(
      rect.width / 2,
      rect.height / 2
    );

    const baseX = grid.snapPoint(centerWorld.x, centerWorld.y).x;
    const baseY = grid.snapPoint(centerWorld.x, centerWorld.y).y;

    selectedIds.clear();

    for (const item of clipboard) {
      const x = baseX + item.offsetX;
      const y = baseY + item.offsetY;

      // check bounds
      const inside =
        bounds.containsPoint(x, y) &&
        bounds.containsPoint(x + item.width, y + item.height);

      if (inside) {
        const obj = new GameObject({
          type: item.type,
          x,
          y,
          width: item.width,
          height: item.height,
          layer: item.layer
        });
        world.add(obj);
        selectedIds.add(obj.id);
      }
    }

    renderer.render(selectedIds);
    return;
  }

  // Delete / Backspace — remove selected
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (selectedIds.size === 0) return;
    for (const id of selectedIds) {
      world.remove(id);
    }
    selectedIds.clear();
    renderer.render(selectedIds);
  }
});

renderer.render(selectedIds);

const boundsOverlay = new BoundsOverlay({
  bounds,
  camera,
  viewport
});

function applyCamera() {
  const rect = viewport.getBoundingClientRect();

  camera.setBounds(bounds, rect.width, rect.height, {
    padding: {
      left: 3000,
      right: 3000,
      top: 1000,
      bottom: 1000
    }
  });

  container.style.transform =
    `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`;

  const gridSize = grid.size * camera.zoom;
  viewport.style.backgroundSize = `${gridSize}px ${gridSize}px`;
  viewport.style.backgroundPosition =
    `${camera.x % gridSize}px ${camera.y % gridSize}px`;

  boundsOverlay.update();
}

applyCamera();

// zoom (skip when road tool is adjusting smoothing via scroll)
viewport.addEventListener('wheel', (e) => {
  e.preventDefault();

  // If road edit mode has a control point selected, wheel adjusts smoothing — don't zoom
  if (roadTool.isEditMode() &&
      roadTool.selectedSegment !== null &&
      roadTool.selectedPointIndex !== null &&
      roadTool.selectedPointIndex >= 0) {
    return;
  }

  const rect = viewport.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;

  camera.zoomAt(sx, sy, Math.exp(-e.deltaY * 0.001), {
    bounds,
    viewportWidth: rect.width,
    viewportHeight: rect.height,
    padding: 150,
    minZoom: 0.25,
    maxZoom: 3.0
  });

  applyCamera();
}, { passive: false });

// pan (ПКМ)
let pan = false, lx = 0, ly = 0;

viewport.addEventListener('mousedown', e => {
  if (e.button !== 2) return;
  pan = true;
  lx = e.clientX;
  ly = e.clientY;
});

window.addEventListener('mousemove', e => {
  if (!pan) return;
  camera.panBy(e.clientX - lx, e.clientY - ly);
  lx = e.clientX;
  ly = e.clientY;
  applyCamera();
});

window.addEventListener('mouseup', () => pan = false);

// ─── WASD Camera Movement ───
const keysDown = new Set();
const PAN_SPEED = 8; // pixels per frame (screen-space)

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  // Don't capture WASD when road tool is active (D = draft toggle, other keys may conflict)
  const roadActive = roadTool.isActive() || roadTool.isEditMode();

  const k = e.key.toLowerCase();
  // Arrow keys always work for camera movement
  if (k === 'arrowup')    { keysDown.add('up');    e.preventDefault(); }
  if (k === 'arrowdown')  { keysDown.add('down');  e.preventDefault(); }
  if (k === 'arrowleft')  { keysDown.add('left');  e.preventDefault(); }
  if (k === 'arrowright') { keysDown.add('right'); e.preventDefault(); }

  // WASD only when road tool is NOT active
  if (!roadActive) {
    if (k === 'w' || k === 'ц')  { keysDown.add('up');    e.preventDefault(); }
    if (k === 's' || k === 'ы')  { keysDown.add('down');  e.preventDefault(); }
    if (k === 'a' || k === 'ф')  { keysDown.add('left');  e.preventDefault(); }
    if (k === 'd' || k === 'в')  { keysDown.add('right'); e.preventDefault(); }
  }
});

window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'w' || k === 'ц' || k === 'arrowup')    keysDown.delete('up');
  if (k === 's' || k === 'ы' || k === 'arrowdown')   keysDown.delete('down');
  if (k === 'a' || k === 'ф' || k === 'arrowleft')   keysDown.delete('left');
  if (k === 'd' || k === 'в' || k === 'arrowright')   keysDown.delete('right');
});

// Clear keys on blur (prevent stuck keys when switching windows)
window.addEventListener('blur', () => keysDown.clear());

function wasdLoop() {
  if (keysDown.size > 0) {
    let dx = 0, dy = 0;
    if (keysDown.has('left'))  dx += PAN_SPEED;
    if (keysDown.has('right')) dx -= PAN_SPEED;
    if (keysDown.has('up'))    dy += PAN_SPEED;
    if (keysDown.has('down'))  dy -= PAN_SPEED;

    if (dx !== 0 || dy !== 0) {
      camera.panBy(dx, dy);
      applyCamera();
    }
  }
  requestAnimationFrame(wasdLoop);
}
requestAnimationFrame(wasdLoop);

// ─── Input controller (selection + drag + selection box) ───
new InputController({
  world,
  camera,
  renderer,
  viewport,
  grid,
  bounds,
  selectedIds,
  selectionBox,
  roadTool,
  onSelectionChange: () => {
    // called whenever selection changes — can be used for future UI updates
  }
});

new DebugOverlay({
  world,
  camera,
  grid,
  viewport,
  bounds,
  selectedIds
});
