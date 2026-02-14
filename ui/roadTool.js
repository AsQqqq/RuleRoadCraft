// ui/roadTool.js

import { BezierMath } from '../engine/road/BezierMath.js';

const STATE = {
  INACTIVE: 'INACTIVE',
  IDLE: 'IDLE',
  DRAWING: 'DRAWING',
  EDITING: 'EDITING',
  EDITING_DRAGGING: 'EDITING_DRAGGING'
};

export class RoadTool {
  constructor({ network, renderer, camera, viewport, bounds, grid }) {
    this.network = network;
    this.renderer = renderer;
    this.ui = null;
    this.camera = camera;
    this.viewport = viewport;
    this.bounds = bounds;
    this.grid = grid;

    this.state = STATE.INACTIVE;

    // ─── Drawing state ───
    this.points = [];
    this.startNode = null;
    this.snapTarget = null;
    this.entryPoints = [];
    this.cursorWorld = null;
    this.draftMode = true; // draft by default: straight lines

    // ─── Editing state ───
    this.selectedSegment = null;
    this.selectedPointIndex = null; // -1=start node, -2=end node, >=0=control point
    this.dragOffset = null;

    // Bind handlers
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onDblClick = this._onDblClick.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onWheel = this._onWheel.bind(this);
  }

  setUI(ui) {
    this.ui = ui;
  }

  // ─── State queries ───

  isActive() {
    return this.state === STATE.IDLE || this.state === STATE.DRAWING;
  }

  isDrawing() {
    return this.state === STATE.DRAWING;
  }

  isEditMode() {
    return this.state === STATE.EDITING || this.state === STATE.EDITING_DRAGGING;
  }

  // ─── Draft mode ───

  toggleDraftMode() {
    this.draftMode = !this.draftMode;
    if (this.state === STATE.DRAWING && this.cursorWorld) {
      this.renderer.renderPreview(this.points, this.cursorWorld, this.draftMode);
    }
    return this.draftMode;
  }

  getDraftMode() {
    return this.draftMode;
  }

  // ─── Activate / Deactivate (Create Mode) ───

  activate() {
    if (this.state !== STATE.INACTIVE) return;

    this.state = STATE.IDLE;
    this.entryPoints = this.network.generateBoundaryEntryPoints(this.bounds, 150);
    this.renderer.renderEntryPoints(this.entryPoints);

    this.viewport.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mousemove', this._onMouseMove);
    this.viewport.addEventListener('dblclick', this._onDblClick);
    window.addEventListener('keydown', this._onKeyDown);

    this.ui?.setActive();
    this.ui?.showHint('Click an entry point on the border or an existing road to start');
  }

  deactivate() {
    if (!this.isActive()) return;

    this.cancelDrawing();
    this.state = STATE.INACTIVE;

    this.renderer.clearEntryPoints();
    this.renderer.clearPreview();
    this.renderer.clearSnapIndicator();
    this.renderer.clearEntryHighlight();

    this.viewport.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mousemove', this._onMouseMove);
    this.viewport.removeEventListener('dblclick', this._onDblClick);
    window.removeEventListener('keydown', this._onKeyDown);

    this.ui?.setInactive();
    this.ui?.hideHint();
  }

  // ─── Activate / Deactivate (Edit Mode) ───

  activateEditMode() {
    if (this.state !== STATE.INACTIVE) return;

    this.state = STATE.EDITING;
    this.selectedSegment = null;
    this.selectedPointIndex = null;

    this.viewport.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mouseup', this._onMouseUp);
    this.viewport.addEventListener('dblclick', this._onDblClick);
    window.addEventListener('keydown', this._onKeyDown);
    this.viewport.addEventListener('wheel', this._onWheel, { passive: false });

    this.renderer.highlightAllRoads(true);
    this.ui?.setEditMode();
    this.ui?.showHint('Click a road to select it. Drag points to edit. Double-click road to add point.');
  }

  deactivateEditMode() {
    if (!this.isEditMode()) return;

    this.selectedSegment = null;
    this.selectedPointIndex = null;
    this.dragOffset = null;
    this.state = STATE.INACTIVE;

    this.renderer.highlightAllRoads(false);
    this.renderer.clearEditHandles();

    this.viewport.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mouseup', this._onMouseUp);
    this.viewport.removeEventListener('dblclick', this._onDblClick);
    window.removeEventListener('keydown', this._onKeyDown);
    this.viewport.removeEventListener('wheel', this._onWheel);

    this.ui?.setInactive();
    this.ui?.hideHint();
  }

  // ─── Coordinate helpers ───

  _screenToWorld(e) {
    const rect = this.viewport.getBoundingClientRect();
    return this.camera.screenToWorld(
      e.clientX - rect.left,
      e.clientY - rect.top
    );
  }

  _clampToWorldBounds(pos) {
    const { minX, minY, maxX, maxY } = this.bounds;
    return {
      x: Math.max(minX, Math.min(maxX, pos.x)),
      y: Math.max(minY, Math.min(maxY, pos.y))
    };
  }

  // ─── Mouse Events (dispatcher) ───

  _onMouseDown(e) {
    if (e.button !== 0) return;

    const world = this._screenToWorld(e);

    if (this.state === STATE.IDLE) {
      this._handleIdleClick(world);
    } else if (this.state === STATE.DRAWING) {
      this._handleDrawingClick(world, e);
    } else if (this.state === STATE.EDITING) {
      this._handleEditingMouseDown(world);
    }
  }

  _onMouseMove(e) {
    const world = this._screenToWorld(e);
    this.cursorWorld = world;

    if (this.state === STATE.IDLE) {
      this._handleIdleMove(world);
    } else if (this.state === STATE.DRAWING) {
      this._handleDrawingMove(world);
    } else if (this.state === STATE.EDITING) {
      this._handleEditingMove(world);
    } else if (this.state === STATE.EDITING_DRAGGING) {
      this._handleEditingDragMove(world);
    }
  }

  _onMouseUp(e) {
    if (this.state === STATE.EDITING_DRAGGING) {
      this._handleEditingDragEnd();
    }
  }

  _onDblClick(e) {
    if (this.state === STATE.DRAWING) {
      e.preventDefault();
      e.stopPropagation();
      const world = this._screenToWorld(e);
      const clamped = this._clampToWorldBounds(world);
      this._finishDrawing(clamped);
      return;
    }

    if (this.state === STATE.EDITING) {
      e.preventDefault();
      e.stopPropagation();
      const world = this._screenToWorld(e);
      this._handleEditingDblClick(world);
      return;
    }
  }

  _onKeyDown(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (this.state === STATE.INACTIVE) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      if (this.state === STATE.DRAWING) {
        this.cancelDrawing();
        this.state = STATE.IDLE;
        this.entryPoints = this.network.generateBoundaryEntryPoints(this.bounds, 150);
        this.renderer.renderEntryPoints(this.entryPoints);
        this.ui?.showHint('Drawing cancelled. Click an entry point to start again');
      } else if (this.isEditMode()) {
        if (this.selectedSegment) {
          this.selectedSegment = null;
          this.selectedPointIndex = null;
          this.renderer.clearEditHandles();
          this.ui?.showHint('Selection cleared. Click a road to select.');
        } else {
          this.deactivateEditMode();
        }
      } else {
        this.deactivate();
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (this.state === STATE.DRAWING && this.points.length >= 2) {
        this._finishDrawing(this.points[this.points.length - 1]);
      }
      return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();

      // Edit mode: delete selected control point, or entire road if no point selected
      if (this.state === STATE.EDITING && this.selectedSegment) {
        // If a control point is selected (not a node), delete just that point
        if (this.selectedPointIndex !== null && this.selectedPointIndex >= 0) {
          this.selectedSegment.controlPoints.splice(this.selectedPointIndex, 1);
          this.selectedPointIndex = null;

          // Rebuild geometry
          const sn = this.network.getNode(this.selectedSegment.startNodeId);
          const en = this.network.getNode(this.selectedSegment.endNodeId);
          if (sn && en) this.selectedSegment.rebuild(sn, en);

          this.renderer.render();
          this.renderer.highlightAllRoads(true);
          this.renderer.renderEditHandles(this.selectedSegment, this.network, null);
          this.ui?.showHint('Point removed. Select another point or press Delete to remove road.');
          return;
        }

        // No point selected (or node selected) — delete entire road
        this.network.removeSegment(this.selectedSegment.id);
        this.selectedSegment = null;
        this.selectedPointIndex = null;
        this.renderer.render();
        this.renderer.highlightAllRoads(true);
        this.renderer.clearEditHandles();
        this.ui?.showHint('Road deleted. Click another road to select.');
        return;
      }

      // Drawing mode: remove last point
      if (this.state === STATE.DRAWING && this.points.length > 1) {
        this.points.pop();
        this.renderer.renderPreview(this.points, this.cursorWorld, this.draftMode);
        this.ui?.showHint(`Point removed. ${this.points.length} point(s) remaining`);
      }
      return;
    }
  }

  _onWheel(e) {
    if (this.state !== STATE.EDITING) return;
    if (this.selectedSegment === null || this.selectedPointIndex === null) return;
    if (this.selectedPointIndex < 0) return; // only control points have smoothing

    e.preventDefault();
    e.stopPropagation();

    const cp = this.selectedSegment.controlPoints[this.selectedPointIndex];
    if (!cp) return;

    const delta = -Math.sign(e.deltaY) * 0.1;
    cp.smoothing = Math.max(0, Math.min(1, (cp.smoothing || 0) + delta));

    // Rebuild and re-render
    const startNode = this.network.getNode(this.selectedSegment.startNodeId);
    const endNode = this.network.getNode(this.selectedSegment.endNodeId);
    if (startNode && endNode) {
      this.selectedSegment.rebuild(startNode, endNode);
      this.renderer.render();
      this.renderer.highlightAllRoads(true);
      this.renderer.renderEditHandles(this.selectedSegment, this.network, this.selectedPointIndex);
    }

    this.ui?.showHint(`Smoothing: ${Math.round(cp.smoothing * 100)}%`);
  }

  // ─── IDLE State ───

  _handleIdleClick(world) {
    const ep = this._findNearestEntryPoint(world, 20);
    if (ep) {
      this.startNode = this.network.addNode(ep.x, ep.y, 'boundary');
      this.points = [{ x: ep.x, y: ep.y }];
      this.state = STATE.DRAWING;
      this.renderer.clearEntryPoints();
      this.renderer.clearSnapIndicator();
      this.renderer.renderPreview(this.points, null, this.draftMode);
      this.ui?.showHint('Click to add points. Double-click or click border to finish');
      return;
    }

    const nearNode = this.network.findNodeAt(world.x, world.y, 20);
    if (nearNode) {
      this.startNode = nearNode;
      this.points = [{ x: nearNode.x, y: nearNode.y }];
      this.state = STATE.DRAWING;
      this.renderer.clearEntryPoints();
      this.renderer.clearSnapIndicator();
      this.renderer.renderPreview(this.points, null, this.draftMode);
      this.ui?.showHint('Click to add points. Double-click or click border to finish');
      return;
    }

    const nearSeg = this.network.findSegmentNear(world.x, world.y, 25);
    if (nearSeg) {
      const junction = this.network.splitSegmentAt(
        nearSeg.segment.id, nearSeg.curveIndex, nearSeg.t
      );
      this.startNode = junction;
      this.points = [{ x: junction.x, y: junction.y }];
      this.state = STATE.DRAWING;
      this.renderer.render();
      this.renderer.clearEntryPoints();
      this.renderer.clearSnapIndicator();
      this.renderer.renderPreview(this.points, null, this.draftMode);
      this.ui?.showHint('Branching from existing road. Click to add points');
      return;
    }

    this.ui?.showHint('Start from a border entry point or an existing road');
  }

  _handleIdleMove(world) {
    this.renderer.clearSnapIndicator();
    this.renderer.clearEntryHighlight();

    const ep = this._findNearestEntryPoint(world, 25);
    if (ep) {
      this.renderer.highlightEntryPoint(ep.x, ep.y);
      this.renderer.renderSnapIndicator(ep.x, ep.y);
      return;
    }

    const nearNode = this.network.findNodeAt(world.x, world.y, 20);
    if (nearNode) {
      this.renderer.renderSnapIndicator(nearNode.x, nearNode.y);
      return;
    }

    const nearSeg = this.network.findSegmentNear(world.x, world.y, 25);
    if (nearSeg) {
      this.renderer.renderSnapIndicator(nearSeg.x, nearSeg.y);
    }
  }

  // ─── DRAWING State ───

  _handleDrawingClick(world, event) {
    const clamped = this._clampToWorldBounds(world);
    const snapResult = this._getSnapTarget(clamped);

    if (snapResult) {
      this._finishDrawing({ x: snapResult.x, y: snapResult.y }, snapResult);
      return;
    }

    // Add intermediate point with default smoothing = 0 (sharp)
    this.points.push({ x: clamped.x, y: clamped.y, smoothing: 0 });
    this.renderer.renderPreview(this.points, null, this.draftMode);
  }

  _handleDrawingMove(world) {
    const clamped = this._clampToWorldBounds(world);
    this.renderer.clearSnapIndicator();

    const snapResult = this._getSnapTarget(clamped);
    if (snapResult) {
      this.renderer.renderSnapIndicator(snapResult.x, snapResult.y);
      this.renderer.renderPreview(this.points, { x: snapResult.x, y: snapResult.y }, this.draftMode);
    } else {
      this.renderer.renderPreview(this.points, clamped, this.draftMode);
    }
  }

  // ─── EDITING State ───

  _handleEditingMouseDown(world) {
    // If a segment is selected and a point is selected, try to start dragging
    if (this.selectedSegment && this.selectedPointIndex !== null) {
      const hit = this._findControlPointAt(world, this.selectedSegment, 15);
      if (hit === this.selectedPointIndex) {
        // Start dragging this point
        const pos = this._getControlPointPosition(this.selectedSegment, this.selectedPointIndex);
        if (pos) {
          this.dragOffset = { x: world.x - pos.x, y: world.y - pos.y };
          this.state = STATE.EDITING_DRAGGING;
          return;
        }
      }
    }

    // Try to select a control point on selected segment
    if (this.selectedSegment) {
      const hit = this._findControlPointAt(world, this.selectedSegment, 15);
      if (hit !== null) {
        this.selectedPointIndex = hit;
        this.renderer.renderEditHandles(this.selectedSegment, this.network, this.selectedPointIndex);

        if (hit >= 0) {
          const cp = this.selectedSegment.controlPoints[hit];
          this.ui?.showHint(`Point selected. Drag to move. Scroll to smooth (${Math.round((cp.smoothing || 0) * 100)}%)`);
        } else {
          this.ui?.showHint('Node selected. Drag to move.');
        }
        return;
      }
    }

    // Try to select a road segment
    const nearSeg = this.network.findSegmentNear(world.x, world.y, 30);
    if (nearSeg) {
      this.selectedSegment = nearSeg.segment;
      this.selectedPointIndex = null;
      this.renderer.renderEditHandles(this.selectedSegment, this.network, null);
      this.ui?.showHint('Road selected. Click control points to edit, Delete to remove.');
      return;
    }

    // Click on empty space — deselect
    this.selectedSegment = null;
    this.selectedPointIndex = null;
    this.renderer.clearEditHandles();
    this.ui?.showHint('Click a road to select it.');
  }

  _handleEditingMove(world) {
    if (this.selectedSegment) {
      const hit = this._findControlPointAt(world, this.selectedSegment, 15);
      this.renderer.renderEditHandles(this.selectedSegment, this.network, hit !== null ? hit : this.selectedPointIndex);
    }
  }

  _handleEditingDragMove(world) {
    if (!this.dragOffset || !this.selectedSegment || this.selectedPointIndex === null) return;

    let newPos = this._clampToWorldBounds({
      x: world.x - this.dragOffset.x,
      y: world.y - this.dragOffset.y
    });

    // Boundary nodes can only slide along their boundary edge
    if (this.selectedPointIndex === -1 || this.selectedPointIndex === -2) {
      const nodeId = this.selectedPointIndex === -1
        ? this.selectedSegment.startNodeId
        : this.selectedSegment.endNodeId;
      const node = this.network.getNode(nodeId);

      if (node && node.isBoundary) {
        newPos = this._constrainToBoundaryEdge(node, newPos);
      }
    }

    this._setControlPointPosition(this.selectedSegment, this.selectedPointIndex, newPos);

    // Rebuild segment geometry
    const startNode = this.network.getNode(this.selectedSegment.startNodeId);
    const endNode = this.network.getNode(this.selectedSegment.endNodeId);
    if (startNode && endNode) {
      this.selectedSegment.rebuild(startNode, endNode);

      // Also rebuild any other segments connected to the moved node
      if (this.selectedPointIndex === -1 || this.selectedPointIndex === -2) {
        const movedNode = this.selectedPointIndex === -1 ? startNode : endNode;
        for (const edgeId of movedNode.edgeIds) {
          const seg = this.network.getSegment(edgeId);
          if (seg && seg !== this.selectedSegment) {
            const sn = this.network.getNode(seg.startNodeId);
            const en = this.network.getNode(seg.endNodeId);
            if (sn && en) seg.rebuild(sn, en);
          }
        }
      }
    }

    this.renderer.render();
    this.renderer.highlightAllRoads(true);
    this.renderer.renderEditHandles(this.selectedSegment, this.network, this.selectedPointIndex);
  }

  _handleEditingDragEnd() {
    this.dragOffset = null;
    this.state = STATE.EDITING;
  }

  /**
   * Double-click in edit mode: insert a new control point on the selected
   * segment (or the nearest segment) at the clicked position.
   */
  _handleEditingDblClick(world) {
    // Determine which segment to add a point to
    let segment = this.selectedSegment;

    if (!segment) {
      // Try to find a segment near the click
      const nearSeg = this.network.findSegmentNear(world.x, world.y, 30);
      if (!nearSeg) return;
      segment = nearSeg.segment;
    }

    // Find where on the segment the click landed
    const closest = segment.closestPoint(world.x, world.y);
    if (closest.dist > 40) return; // too far from road

    // Determine insertion index: the new control point goes after curveIndex - 1
    // because controlPoints[0] corresponds to the point between curve 0 and curve 1.
    // Curve i connects: allPoints[i] → allPoints[i+1]
    // allPoints = [startNode, cp0, cp1, ..., endNode]
    // So curveIndex 0 = startNode→cp0, curveIndex 1 = cp0→cp1, etc.
    // A new point on curveIndex i should be inserted at controlPoints index = i
    const insertIndex = closest.curveIndex;

    // Insert a new control point at the closest position with smoothing = 0
    const newPoint = { x: closest.x, y: closest.y, smoothing: 0 };
    segment.controlPoints.splice(insertIndex, 0, newPoint);

    // Rebuild geometry
    const startNode = this.network.getNode(segment.startNodeId);
    const endNode = this.network.getNode(segment.endNodeId);
    if (startNode && endNode) {
      segment.rebuild(startNode, endNode);
    }

    // Update selection to the new point
    this.selectedSegment = segment;
    this.selectedPointIndex = insertIndex;

    this.renderer.render();
    this.renderer.highlightAllRoads(true);
    this.renderer.renderEditHandles(segment, this.network, insertIndex);

    this.ui?.showHint('New point added. Drag to move, scroll to smooth.');
  }

  // ─── Control point helpers (edit mode) ───

  _findControlPointAt(world, segment, radius) {
    const startNode = this.network.getNode(segment.startNodeId);
    const endNode = this.network.getNode(segment.endNodeId);

    if (startNode && BezierMath.distance(world, startNode) < radius) return -1;
    if (endNode && BezierMath.distance(world, endNode) < radius) return -2;

    for (let i = 0; i < segment.controlPoints.length; i++) {
      if (BezierMath.distance(world, segment.controlPoints[i]) < radius) return i;
    }

    return null;
  }

  _getControlPointPosition(segment, index) {
    if (index === -1) {
      const n = this.network.getNode(segment.startNodeId);
      return n ? { x: n.x, y: n.y } : null;
    }
    if (index === -2) {
      const n = this.network.getNode(segment.endNodeId);
      return n ? { x: n.x, y: n.y } : null;
    }
    if (index >= 0 && index < segment.controlPoints.length) {
      return segment.controlPoints[index];
    }
    return null;
  }

  _setControlPointPosition(segment, index, pos) {
    if (index === -1) {
      const n = this.network.getNode(segment.startNodeId);
      if (n) { n.x = pos.x; n.y = pos.y; }
    } else if (index === -2) {
      const n = this.network.getNode(segment.endNodeId);
      if (n) { n.x = pos.x; n.y = pos.y; }
    } else if (index >= 0 && index < segment.controlPoints.length) {
      segment.controlPoints[index].x = pos.x;
      segment.controlPoints[index].y = pos.y;
    }
  }

  // ─── Snap Logic ───

  _findNearestEntryPoint(world, radius) {
    let best = null;
    let bestDist = radius;

    for (const ep of this.entryPoints) {
      const dist = BezierMath.distance(world, ep);
      if (dist < bestDist) {
        bestDist = dist;
        best = ep;
      }
    }

    return best;
  }

  _findNearestBoundaryEdge(pos, threshold = 25) {
    const { minX, minY, maxX, maxY } = this.bounds;

    const edges = [
      { side: 'left', dist: Math.abs(pos.x - minX), x: minX, y: Math.max(minY, Math.min(maxY, pos.y)) },
      { side: 'right', dist: Math.abs(pos.x - maxX), x: maxX, y: Math.max(minY, Math.min(maxY, pos.y)) },
      { side: 'top', dist: Math.abs(pos.y - minY), x: Math.max(minX, Math.min(maxX, pos.x)), y: minY },
      { side: 'bottom', dist: Math.abs(pos.y - maxY), x: Math.max(minX, Math.min(maxX, pos.x)), y: maxY }
    ];

    edges.sort((a, b) => a.dist - b.dist);
    const nearest = edges[0];

    return nearest.dist <= threshold ? { x: nearest.x, y: nearest.y, side: nearest.side } : null;
  }

  _getSnapTarget(world) {
    const startDist = this.startNode
      ? BezierMath.distance(world, this.startNode)
      : Infinity;

    // Check boundary edges (any point on border finishes the road)
    if (this.state === STATE.DRAWING) {
      const boundaryEdge = this._findNearestBoundaryEdge(world, 25);
      if (boundaryEdge && startDist > 30) {
        return { type: 'boundary', x: boundaryEdge.x, y: boundaryEdge.y, side: boundaryEdge.side };
      }
    }

    // Check entry points
    const ep = this._findNearestEntryPoint(world, 20);
    if (ep) {
      return { type: 'boundary', x: ep.x, y: ep.y, side: ep.side };
    }

    // Check existing nodes (not start)
    const nearNode = this.network.findNodeAt(world.x, world.y, 20);
    if (nearNode && nearNode !== this.startNode) {
      return { type: 'node', x: nearNode.x, y: nearNode.y, node: nearNode };
    }

    // Check existing segments
    const nearSeg = this.network.findSegmentNear(world.x, world.y, 25);
    if (nearSeg) {
      return {
        type: 'segment',
        x: nearSeg.x,
        y: nearSeg.y,
        segment: nearSeg.segment,
        curveIndex: nearSeg.curveIndex,
        t: nearSeg.t
      };
    }

    return null;
  }

  // ─── Finish Drawing ───

  async _finishDrawing(endPos, snapResult = null) {
    if (this.points.length < 1) {
      this.cancelDrawing();
      this.state = STATE.IDLE;
      return;
    }

    let endNode;

    if (snapResult) {
      if (snapResult.type === 'boundary') {
        endNode = this.network.addNode(snapResult.x, snapResult.y, 'boundary');
      } else if (snapResult.type === 'node') {
        endNode = snapResult.node;
        if (endNode.type !== 'boundary') {
          endNode.type = 'junction';
        }
      } else if (snapResult.type === 'segment') {
        endNode = this.network.splitSegmentAt(
          snapResult.segment.id,
          snapResult.curveIndex,
          snapResult.t
        );
      }
    } else {
      // No snap — check if near boundary
      const onBoundary = this._isOnBoundary(endPos);

      if (onBoundary) {
        const snapped = this._snapToBoundary(endPos);
        endNode = this.network.addNode(snapped.x, snapped.y, 'boundary');
      } else {
        // Dead end
        if (this.ui) {
          const confirmed = await this.ui.showDeadEndConfirm();
          if (!confirmed) return;
        }
        endNode = this.network.addNode(endPos.x, endPos.y, 'deadend');
      }
    }

    // Control points = all intermediate points (skip start point)
    const controlPoints = this.points.slice(1).map(p => ({
      x: p.x,
      y: p.y,
      smoothing: p.smoothing !== undefined ? p.smoothing : 0
    }));

    this.network.addSegment(this.startNode.id, endNode.id, controlPoints);

    this.points = [];
    this.startNode = null;
    this.renderer.render();
    this.renderer.clearPreview();
    this.renderer.clearSnapIndicator();

    this.state = STATE.IDLE;
    this.entryPoints = this.network.generateBoundaryEntryPoints(this.bounds, 150);
    this.renderer.renderEntryPoints(this.entryPoints);

    this.ui?.showHint('Road created! Click an entry point or road to draw another');
  }

  // ─── Boundary helpers ───

  /**
   * Constrain a boundary node to slide only along the boundary edge it's on.
   * Determines which edge the node is on based on its current position,
   * then locks the perpendicular axis while allowing movement along the edge.
   */
  _constrainToBoundaryEdge(node, newPos) {
    const { minX, minY, maxX, maxY } = this.bounds;

    // Determine which edge this node currently sits on
    const dLeft = Math.abs(node.x - minX);
    const dRight = Math.abs(node.x - maxX);
    const dTop = Math.abs(node.y - minY);
    const dBottom = Math.abs(node.y - maxY);
    const minDist = Math.min(dLeft, dRight, dTop, dBottom);

    if (minDist === dLeft) {
      // Left edge: lock x to minX, allow y to slide
      return { x: minX, y: Math.max(minY, Math.min(maxY, newPos.y)) };
    } else if (minDist === dRight) {
      return { x: maxX, y: Math.max(minY, Math.min(maxY, newPos.y)) };
    } else if (minDist === dTop) {
      return { x: Math.max(minX, Math.min(maxX, newPos.x)), y: minY };
    } else {
      return { x: Math.max(minX, Math.min(maxX, newPos.x)), y: maxY };
    }
  }

  _isOnBoundary(pos, threshold = 20) {
    const { minX, minY, maxX, maxY } = this.bounds;
    return (
      Math.abs(pos.x - minX) < threshold ||
      Math.abs(pos.x - maxX) < threshold ||
      Math.abs(pos.y - minY) < threshold ||
      Math.abs(pos.y - maxY) < threshold
    );
  }

  _snapToBoundary(pos) {
    const { minX, minY, maxX, maxY } = this.bounds;
    const dists = [
      { side: 'left', dist: Math.abs(pos.x - minX), x: minX, y: pos.y },
      { side: 'right', dist: Math.abs(pos.x - maxX), x: maxX, y: pos.y },
      { side: 'top', dist: Math.abs(pos.y - minY), x: pos.x, y: minY },
      { side: 'bottom', dist: Math.abs(pos.y - maxY), x: pos.x, y: maxY }
    ];
    dists.sort((a, b) => a.dist - b.dist);
    return dists[0];
  }

  // ─── Cancel ───

  cancelDrawing() {
    if (this.startNode && this.startNode.edgeIds.length === 0) {
      this.network.removeNode(this.startNode.id);
    }

    this.points = [];
    this.startNode = null;
    this.cursorWorld = null;
    this.snapTarget = null;
    this.renderer.clearPreview();
    this.renderer.clearSnapIndicator();

    if (this.state !== STATE.INACTIVE) {
      this.entryPoints = this.network.generateBoundaryEntryPoints(this.bounds, 150);
      this.renderer.renderEntryPoints(this.entryPoints);
    }
  }
}
