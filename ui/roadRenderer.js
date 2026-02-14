// ui/roadRenderer.js

import { BezierMath } from '../engine/road/BezierMath.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export class RoadRenderer {
  /**
   * @param {Object} params
   * @param {HTMLElement} params.container — #canvasContainer
   * @param {RoadNetwork} params.network
   */
  constructor({ container, network, bounds }) {
    this.container = container;
    this.network = network;
    this.bounds = bounds;

    // Create SVG element inside #canvasContainer
    this.svg = this._createSVG();

    // Layer groups (drawing order matters)
    this.roadLayer = this._createGroup('road-segments');
    this.nodeLayer = this._createGroup('road-nodes');
    this.entryLayer = this._createGroup('road-entry-points');
    this.previewLayer = this._createGroup('road-preview');
    this.editLayer = this._createGroup('road-edit-handles');
    this.snapLayer = this._createGroup('road-snap');
  }

  // ─── SVG Setup ───

  _createSVG() {
    const w = this.bounds.maxX - this.bounds.minX;
    const h = this.bounds.maxY - this.bounds.minY;

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.id = 'roadSvg';
    svg.setAttribute('viewBox', `${this.bounds.minX} ${this.bounds.minY} ${w} ${h}`);
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(h));

    // Insert as first child of container (under .block objects)
    this.container.insertBefore(svg, this.container.firstChild);
    return svg;
  }

  _createGroup(className) {
    const g = document.createElementNS(SVG_NS, 'g');
    g.classList.add(className);
    this.svg.appendChild(g);
    return g;
  }

  _clearGroup(g) {
    while (g.firstChild) g.removeChild(g.firstChild);
  }

  // ─── Full Render ───

  /**
   * Re-render the entire road network.
   */
  render() {
    this._clearGroup(this.roadLayer);
    this._clearGroup(this.nodeLayer);

    // Draw segments
    for (const seg of this.network.allSegments()) {
      this._drawSegment(seg);
    }

    // Draw nodes
    for (const node of this.network.allNodes()) {
      this._drawNode(node);
    }
  }

  _drawSegment(segment) {
    const pathData = segment.toSVGPath();
    if (!pathData) return;

    // Outline (slightly wider, darker)
    const outline = document.createElementNS(SVG_NS, 'path');
    outline.setAttribute('d', pathData);
    outline.classList.add('road-segment-outline');
    outline.dataset.segId = segment.id;
    this.roadLayer.appendChild(outline);

    // Main road
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', pathData);
    path.classList.add('road-segment');
    path.style.strokeWidth = `${segment.width}px`;
    path.dataset.segId = segment.id;
    this.roadLayer.appendChild(path);
  }

  _drawNode(node) {
    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', node.x);
    circle.setAttribute('cy', node.y);
    circle.setAttribute('r', 6);
    circle.classList.add('road-node', node.type);
    circle.dataset.nodeId = node.id;
    this.nodeLayer.appendChild(circle);
  }

  // ─── Preview (live drawing) ───

  /**
   * Render the preview while the user is drawing.
   * @param {{x:number, y:number}[]} points — user-placed points so far
   * @param {{x:number, y:number}|null} cursorPos — current cursor world position
   * @param {boolean} [draftMode=false] — if true, draw straight lines instead of curves
   */
  renderPreview(points, cursorPos, draftMode = false) {
    this._clearGroup(this.previewLayer);

    if (points.length === 0) return;

    // All points including cursor
    const allPts = cursorPos ? [...points, cursorPos] : [...points];

    if (allPts.length >= 2) {
      let pathData;

      if (draftMode) {
        pathData = BezierMath.pointsToPolylinePath(allPts);
      } else {
        const curves = BezierMath.pointsToBezierCurves(allPts);
        pathData = BezierMath.curvesToSVGPath(curves);
      }

      if (pathData) {
        // Preview road width (semi-transparent)
        const roadPreview = document.createElementNS(SVG_NS, 'path');
        roadPreview.setAttribute('d', pathData);
        roadPreview.classList.add('road-preview-road');
        if (draftMode) roadPreview.classList.add('draft');
        this.previewLayer.appendChild(roadPreview);

        // Preview center line (dashed)
        const line = document.createElementNS(SVG_NS, 'path');
        line.setAttribute('d', pathData);
        line.classList.add('road-preview-line');
        if (draftMode) line.classList.add('draft');
        this.previewLayer.appendChild(line);
      }
    }

    // Draw placed points
    for (const pt of points) {
      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('cx', pt.x);
      circle.setAttribute('cy', pt.y);
      circle.setAttribute('r', 5);
      circle.classList.add('road-preview-point');
      this.previewLayer.appendChild(circle);
    }

    // Draw cursor indicator
    if (cursorPos) {
      const cursor = document.createElementNS(SVG_NS, 'circle');
      cursor.setAttribute('cx', cursorPos.x);
      cursor.setAttribute('cy', cursorPos.y);
      cursor.setAttribute('r', 8);
      cursor.classList.add('road-preview-cursor');
      this.previewLayer.appendChild(cursor);
    }
  }

  clearPreview() {
    this._clearGroup(this.previewLayer);
  }

  // ─── Entry Points ───

  /**
   * Show available entry points on the boundary.
   * @param {{ x: number, y: number, side: string }[]} entryPoints
   */
  renderEntryPoints(entryPoints) {
    this._clearGroup(this.entryLayer);

    for (const ep of entryPoints) {
      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('cx', ep.x);
      circle.setAttribute('cy', ep.y);
      circle.setAttribute('r', 12);
      circle.classList.add('entry-point');
      circle.dataset.side = ep.side;
      circle.dataset.epX = ep.x;
      circle.dataset.epY = ep.y;
      this.entryLayer.appendChild(circle);
    }
  }

  clearEntryPoints() {
    this._clearGroup(this.entryLayer);
  }

  /**
   * Highlight a specific entry point as snapped.
   * @param {number} x
   * @param {number} y
   */
  highlightEntryPoint(x, y) {
    // Remove previous highlights
    for (const el of this.entryLayer.querySelectorAll('.entry-point')) {
      el.classList.remove('snapped');
    }

    // Find and highlight matching entry point
    for (const el of this.entryLayer.querySelectorAll('.entry-point')) {
      const epX = parseFloat(el.dataset.epX);
      const epY = parseFloat(el.dataset.epY);
      if (Math.abs(epX - x) < 1 && Math.abs(epY - y) < 1) {
        el.classList.add('snapped');
        break;
      }
    }
  }

  clearEntryHighlight() {
    for (const el of this.entryLayer.querySelectorAll('.entry-point')) {
      el.classList.remove('snapped');
    }
  }

  // ─── Snap Indicator ───

  /**
   * Show a snap indicator at a world position.
   * @param {number} x
   * @param {number} y
   */
  renderSnapIndicator(x, y) {
    this._clearGroup(this.snapLayer);

    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', y);
    circle.setAttribute('r', 10);
    circle.classList.add('snap-indicator');
    this.snapLayer.appendChild(circle);
  }

  clearSnapIndicator() {
    this._clearGroup(this.snapLayer);
  }

  // ─── Edit Mode ───

  /**
   * Toggle yellow highlight on all road segments (edit mode).
   * @param {boolean} enabled
   */
  highlightAllRoads(enabled) {
    const elements = this.roadLayer.querySelectorAll('.road-segment, .road-segment-outline');
    for (const el of elements) {
      if (enabled) {
        el.classList.add('editable');
      } else {
        el.classList.remove('editable');
      }
    }
  }

  /**
   * Render draggable edit handles for a selected segment.
   * @param {RoadSegment} segment
   * @param {RoadNetwork} network — to look up start/end nodes
   * @param {number|null} selectedIndex — currently selected point index (-1=start, -2=end, >=0=cp)
   */
  renderEditHandles(segment, network, selectedIndex) {
    this._clearGroup(this.editLayer);
    if (!segment) return;

    const startNode = network.getNode(segment.startNodeId);
    const endNode = network.getNode(segment.endNodeId);

    // Draw the segment path highlighted
    const pathData = segment.toSVGPath();
    if (pathData) {
      const highlight = document.createElementNS(SVG_NS, 'path');
      highlight.setAttribute('d', pathData);
      highlight.classList.add('edit-segment-highlight');
      this.editLayer.appendChild(highlight);
    }

    // Draw control point connections (thin lines from nodes to CPs)
    if (startNode && segment.controlPoints.length > 0) {
      const cp0 = segment.controlPoints[0];
      const connLine = document.createElementNS(SVG_NS, 'line');
      connLine.setAttribute('x1', startNode.x);
      connLine.setAttribute('y1', startNode.y);
      connLine.setAttribute('x2', cp0.x);
      connLine.setAttribute('y2', cp0.y);
      connLine.classList.add('edit-connection-line');
      this.editLayer.appendChild(connLine);
    }

    if (endNode && segment.controlPoints.length > 0) {
      const cpLast = segment.controlPoints[segment.controlPoints.length - 1];
      const connLine = document.createElementNS(SVG_NS, 'line');
      connLine.setAttribute('x1', endNode.x);
      connLine.setAttribute('y1', endNode.y);
      connLine.setAttribute('x2', cpLast.x);
      connLine.setAttribute('y2', cpLast.y);
      connLine.classList.add('edit-connection-line');
      this.editLayer.appendChild(connLine);
    }

    // Draw start node handle
    if (startNode) {
      this._drawEditHandle(startNode.x, startNode.y, 'node', selectedIndex === -1);
    }

    // Draw end node handle
    if (endNode) {
      this._drawEditHandle(endNode.x, endNode.y, 'node', selectedIndex === -2);
    }

    // Draw control point handles
    for (let i = 0; i < segment.controlPoints.length; i++) {
      const cp = segment.controlPoints[i];
      const isSelected = (selectedIndex === i);
      this._drawEditHandle(cp.x, cp.y, 'cp', isSelected, cp.smoothing);
    }
  }

  /**
   * Draw a single edit handle circle.
   * @param {number} x
   * @param {number} y
   * @param {'node'|'cp'} type
   * @param {boolean} selected
   * @param {number} [smoothing] — only for cp type, shown as ring fill
   */
  _drawEditHandle(x, y, type, selected, smoothing) {
    const r = type === 'node' ? 8 : 6;

    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', y);
    circle.setAttribute('r', r);
    circle.classList.add('edit-handle', `edit-handle-${type}`);
    if (selected) circle.classList.add('selected');

    this.editLayer.appendChild(circle);

    // For control points, show smoothing as a label
    if (type === 'cp' && smoothing !== undefined && selected) {
      const text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('x', x);
      text.setAttribute('y', y - r - 4);
      text.classList.add('edit-smoothing-label');
      text.textContent = `${Math.round(smoothing * 100)}%`;
      this.editLayer.appendChild(text);
    }
  }

  /**
   * Clear all edit handles.
   */
  clearEditHandles() {
    this._clearGroup(this.editLayer);
  }
}
