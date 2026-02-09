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
   * Render the preview curve while the user is drawing.
   * @param {{x:number, y:number}[]} points — user-placed points so far
   * @param {{x:number, y:number}|null} cursorPos — current cursor world position
   */
  renderPreview(points, cursorPos) {
    this._clearGroup(this.previewLayer);

    if (points.length === 0) return;

    // All points including cursor
    const allPts = cursorPos ? [...points, cursorPos] : [...points];

    if (allPts.length >= 2) {
      const curves = BezierMath.pointsToBezierCurves(allPts);
      const pathData = BezierMath.curvesToSVGPath(curves);

      if (pathData) {
        // Preview road width (semi-transparent)
        const roadPreview = document.createElementNS(SVG_NS, 'path');
        roadPreview.setAttribute('d', pathData);
        roadPreview.classList.add('road-preview-road');
        this.previewLayer.appendChild(roadPreview);

        // Preview center line (dashed)
        const line = document.createElementNS(SVG_NS, 'path');
        line.setAttribute('d', pathData);
        line.classList.add('road-preview-line');
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
}
