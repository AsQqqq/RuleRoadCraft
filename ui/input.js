// ui/input.js
export class InputController {
  constructor({ world, camera, renderer, viewport, grid, bounds, selectedIds, selectionBox, roadTool, onSelectionChange }) {
    this.world = world;
    this.camera = camera;
    this.renderer = renderer;
    this.viewport = viewport;
    this.grid = grid;
    this.bounds = bounds;

    this.selectedIds = selectedIds;               // Set<number> — shared reference
    this.selectionBox = selectionBox;             // SelectionBox instance
    this.roadTool = roadTool;                     // RoadTool — skip input when active
    this.onSelectionChange = onSelectionChange;   // () => void — notify UI

    // drag state
    this.isDragging = false;
    this.dragOffsets = new Map();                  // Map<id, {dx, dy}>

    // selection box state
    this.isBoxSelecting = false;
    this.boxShift = false;                        // was shift held when box started

    // threshold to distinguish click from drag (pixels)
    this.dragThreshold = 4;
    this.mouseDownPos = null;       // { x, y } screen
    this.hasMoved = false;
    this.pendingTarget = null;      // clicked .block element (or null)
    this.pendingShift = false;

    this.bind();
  }

  bind() {
    this.viewport.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);

    // контекстное меню уже отключено глобально в index.html, но пусть будет и тут
    this.viewport.addEventListener('contextmenu', e => e.preventDefault());
  }

  // ─── helpers ───

  screenToWorld(e) {
    const rect = this.viewport.getBoundingClientRect();
    return this.camera.screenToWorld(
      e.clientX - rect.left,
      e.clientY - rect.top
    );
  }

  rerender(previewIds) {
    this.renderer.render(this.selectedIds, previewIds);
    this.onSelectionChange?.();
  }

  // ─── MOUSE DOWN ───

  onMouseDown = (e) => {
    if (e.button !== 0) return; // only LMB
    if (this.roadTool?.isActive() || this.roadTool?.isEditMode()) return; // road tool handles its own input

    const target = e.target.closest('.block');
    const shift = e.shiftKey;

    this.mouseDownPos = { x: e.clientX, y: e.clientY };
    this.hasMoved = false;
    this.pendingTarget = target;
    this.pendingShift = shift;

    if (target) {
      // ── clicked on an object ──
      e.preventDefault();

      const id = Number(target.dataset.id);
      const object = this.world.get(id);
      if (!object) return;

      if (shift) {
        // Shift+click: toggle in selection
        if (this.selectedIds.has(id)) {
          this.selectedIds.delete(id);
        } else {
          this.selectedIds.add(id);
        }
        this.rerender();
      } else {
        // No shift: if not already selected, select only this one
        if (!this.selectedIds.has(id)) {
          this.selectedIds.clear();
          this.selectedIds.add(id);
          this.rerender();
        }
        // (if already selected — wait for drag or click-up to decide)
      }

      // prepare drag for all selected objects
      this.prepareDrag(e);

    } else {
      // ── clicked on empty space ──
      if (!shift) {
        this.selectedIds.clear();
        this.rerender();
      }

      // prepare selection box
      this.boxShift = shift;
      // don't start box yet — wait for drag threshold
    }
  };

  prepareDrag(e) {
    const pos = this.screenToWorld(e);
    this.dragOffsets.clear();

    for (const id of this.selectedIds) {
      const obj = this.world.get(id);
      if (!obj) continue;
      this.dragOffsets.set(id, {
        dx: pos.x - obj.x,
        dy: pos.y - obj.y
      });
    }
  }

  // ─── MOUSE MOVE ───

  onMouseMove = (e) => {
    if (this.roadTool?.isActive() || this.roadTool?.isEditMode()) return;
    if (!this.mouseDownPos) return;

    // check drag threshold
    if (!this.hasMoved) {
      const dx = e.clientX - this.mouseDownPos.x;
      const dy = e.clientY - this.mouseDownPos.y;
      if (Math.abs(dx) < this.dragThreshold && Math.abs(dy) < this.dragThreshold) {
        return;
      }
      this.hasMoved = true;

      // now decide: object drag or box select?
      if (this.pendingTarget) {
        this.isDragging = true;
      } else {
        this.isBoxSelecting = true;
        this.selectionBox.start(this.mouseDownPos.x, this.mouseDownPos.y);
      }
    }

    if (this.isDragging) {
      this.handleDragMove(e);
    } else if (this.isBoxSelecting) {
      this.handleBoxMove(e);
    }
  };

  handleDragMove(e) {
    const pos = this.screenToWorld(e);

    for (const id of this.selectedIds) {
      const obj = this.world.get(id);
      if (!obj) continue;

      const offset = this.dragOffsets.get(id);
      if (!offset) continue;

      const rawX = pos.x - offset.dx;
      const rawY = pos.y - offset.dy;

      const snapped = this.grid.snapPoint(rawX, rawY);
      obj.x = snapped.x;
      obj.y = snapped.y;
    }

    this.rerender();
  }

  handleBoxMove(e) {
    this.selectionBox.update(e.clientX, e.clientY);

    // real-time preview: highlight objects inside the box
    const previewIds = new Set(this.selectionBox.getIntersectingIds());
    this.rerender(previewIds);
  }

  // ─── MOUSE UP ───

  onMouseUp = (e) => {
    if (this.roadTool?.isActive() || this.roadTool?.isEditMode()) return;
    if (this.isDragging) {
      this.finishDrag();
    } else if (this.isBoxSelecting) {
      this.finishBoxSelect();
    } else if (this.pendingTarget && !this.hasMoved && !this.pendingShift) {
      // simple click on already-selected object without moving:
      // select only this one (deselect others)
      const id = Number(this.pendingTarget.dataset.id);
      if (this.selectedIds.size > 1) {
        this.selectedIds.clear();
        this.selectedIds.add(id);
        this.rerender();
      }
    }

    // reset state
    this.isDragging = false;
    this.isBoxSelecting = false;
    this.mouseDownPos = null;
    this.pendingTarget = null;
    this.pendingShift = false;
    this.hasMoved = false;
    this.dragOffsets.clear();
  };

  finishDrag() {
    const toRemove = [];

    for (const id of this.selectedIds) {
      const obj = this.world.get(id);
      if (!obj) continue;

      const outside =
        !this.bounds.containsPoint(obj.x, obj.y) ||
        !this.bounds.containsPoint(obj.x + obj.width, obj.y + obj.height);

      if (outside) {
        toRemove.push(id);
      } else {
        this.bounds.clampObject(obj);
      }
    }

    for (const id of toRemove) {
      this.world.remove(id);
      this.selectedIds.delete(id);
    }

    this.rerender();
  }

  finishBoxSelect() {
    const ids = this.selectionBox.getIntersectingIds();

    for (const id of ids) {
      this.selectedIds.add(id);
    }

    this.selectionBox.end();
    this.rerender();
  }
}
