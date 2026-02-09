// engine/road/RoadNetwork.js

import { RoadNode } from './RoadNode.js';
import { RoadSegment } from './RoadSegment.js';
import { BezierMath } from './BezierMath.js';

export class RoadNetwork {
  constructor() {
    /** @type {Map<number, RoadNode>} */
    this.nodes = new Map();

    /** @type {Map<number, RoadSegment>} */
    this.segments = new Map();

    this._nextId = 1;
  }

  _genId() {
    return this._nextId++;
  }

  // ─── Creation ───

  /**
   * Add a node to the network.
   * @param {number} x
   * @param {number} y
   * @param {'boundary'|'junction'|'deadend'} type
   * @returns {RoadNode}
   */
  addNode(x, y, type) {
    const node = new RoadNode({ id: this._genId(), x, y, type });
    this.nodes.set(node.id, node);
    return node;
  }

  /**
   * Add a road segment between two nodes.
   * @param {number} startNodeId
   * @param {number} endNodeId
   * @param {{x:number, y:number}[]} controlPoints
   * @param {number} [width=50]
   * @returns {RoadSegment}
   */
  addSegment(startNodeId, endNodeId, controlPoints = [], width = 50) {
    const startNode = this.nodes.get(startNodeId);
    const endNode = this.nodes.get(endNodeId);

    if (!startNode || !endNode) {
      throw new Error(`RoadNetwork.addSegment: node not found (${startNodeId} → ${endNodeId})`);
    }

    const segment = new RoadSegment({
      id: this._genId(),
      startNodeId,
      endNodeId,
      controlPoints,
      width
    });

    // Build bezier curves
    segment.rebuild(startNode, endNode);

    // Register edges
    startNode.addEdge(segment.id);
    endNode.addEdge(segment.id);

    this.segments.set(segment.id, segment);
    return segment;
  }

  // ─── Removal ───

  /**
   * Remove a segment and clean up node references.
   * @param {number} id
   */
  removeSegment(id) {
    const seg = this.segments.get(id);
    if (!seg) return;

    const startNode = this.nodes.get(seg.startNodeId);
    const endNode = this.nodes.get(seg.endNodeId);

    if (startNode) startNode.removeEdge(id);
    if (endNode) endNode.removeEdge(id);

    this.segments.delete(id);
  }

  /**
   * Remove a node and cascade-delete all connected segments.
   * @param {number} id
   */
  removeNode(id) {
    const node = this.nodes.get(id);
    if (!node) return;

    // Remove all connected segments (copy array since it mutates)
    const edgesCopy = [...node.edgeIds];
    for (const segId of edgesCopy) {
      this.removeSegment(segId);
    }

    this.nodes.delete(id);
  }

  // ─── Queries ───

  /** @returns {RoadNode|undefined} */
  getNode(id) {
    return this.nodes.get(id);
  }

  /** @returns {RoadSegment|undefined} */
  getSegment(id) {
    return this.segments.get(id);
  }

  /** @returns {RoadNode[]} */
  allNodes() {
    return Array.from(this.nodes.values());
  }

  /** @returns {RoadSegment[]} */
  allSegments() {
    return Array.from(this.segments.values());
  }

  // ─── Search ───

  /**
   * Find all boundary nodes.
   * @returns {RoadNode[]}
   */
  findBoundaryNodes() {
    return this.allNodes().filter(n => n.isBoundary);
  }

  /**
   * Find a node near a world position.
   * @param {number} x
   * @param {number} y
   * @param {number} [radius=15]
   * @returns {RoadNode|null}
   */
  findNodeAt(x, y, radius = 15) {
    let best = null;
    let bestDist = radius;

    for (const node of this.nodes.values()) {
      const dist = BezierMath.distance({ x, y }, node);
      if (dist < bestDist) {
        bestDist = dist;
        best = node;
      }
    }

    return best;
  }

  /**
   * Find the closest segment to a world position.
   * @param {number} x
   * @param {number} y
   * @param {number} [maxDist=25]
   * @returns {{ segment: RoadSegment, t: number, dist: number, x: number, y: number } | null}
   */
  findSegmentNear(x, y, maxDist = 25) {
    let best = null;

    for (const seg of this.segments.values()) {
      const result = seg.closestPoint(x, y);
      if (result.dist < maxDist && (!best || result.dist < best.dist)) {
        best = {
          segment: seg,
          t: result.t,
          dist: result.dist,
          x: result.x,
          y: result.y,
          curveIndex: result.curveIndex
        };
      }
    }

    return best;
  }

  // ─── Validation ───

  /**
   * Find nodes with only one edge that are NOT confirmed dead-ends.
   * @returns {RoadNode[]}
   */
  findUnconfirmedDeadEnds() {
    return this.allNodes().filter(n =>
      n.edgeIds.length === 1 && n.type !== 'deadend' && n.type !== 'boundary'
    );
  }

  // ─── Boundary Entry Points ───

  /**
   * Generate potential entry points along the boundary of the map.
   * @param {WorldBounds} bounds
   * @param {number} [spacing=150]
   * @returns {{ x: number, y: number, side: 'top'|'bottom'|'left'|'right' }[]}
   */
  generateBoundaryEntryPoints(bounds, spacing = 150) {
    const points = [];
    const { minX, minY, maxX, maxY } = bounds;

    // Top edge (y = minY)
    for (let x = minX + spacing / 2; x < maxX; x += spacing) {
      points.push({ x, y: minY, side: 'top' });
    }

    // Bottom edge (y = maxY)
    for (let x = minX + spacing / 2; x < maxX; x += spacing) {
      points.push({ x, y: maxY, side: 'bottom' });
    }

    // Left edge (x = minX)
    for (let y = minY + spacing / 2; y < maxY; y += spacing) {
      points.push({ x: minX, y, side: 'left' });
    }

    // Right edge (x = maxX)
    for (let y = minY + spacing / 2; y < maxY; y += spacing) {
      points.push({ x: maxX, y, side: 'right' });
    }

    // Filter out entry points that already have a boundary node nearby
    return points.filter(ep => {
      return !this.findNodeAt(ep.x, ep.y, spacing * 0.4);
    });
  }

  /**
   * Split an existing segment at parameter t, creating a junction node.
   * Used when branching from an existing road.
   * @param {number} segmentId
   * @param {number} curveIndex — which bezier sub-curve
   * @param {number} t — parameter on that sub-curve
   * @returns {RoadNode} the new junction node
   */
  splitSegmentAt(segmentId, curveIndex, t) {
    const seg = this.segments.get(segmentId);
    if (!seg) throw new Error(`Segment ${segmentId} not found`);

    const curve = seg.bezierCurves[curveIndex];
    if (!curve) throw new Error(`Curve index ${curveIndex} out of range`);

    // Find the split point
    const splitPoint = BezierMath.pointOnCubic(curve.p0, curve.p1, curve.p2, curve.p3, t);

    // Create a junction node at the split point
    const junctionNode = this.addNode(splitPoint.x, splitPoint.y, 'junction');

    // Remember the old segment info
    const startNodeId = seg.startNodeId;
    const endNodeId = seg.endNodeId;
    const oldControlPoints = [...seg.controlPoints];
    const width = seg.width;

    // Remove old segment
    this.removeSegment(segmentId);

    // We need to split the control points into two halves.
    // A simplified approach: distribute control points based on curve index.
    // Points before curveIndex go to first half, points after go to second half.
    // This is approximate but good enough for the UX.

    const startNode = this.nodes.get(startNodeId);
    const endNode = this.nodes.get(endNodeId);

    // Build the two new segments with approximate control point splitting
    // For simplicity, use the split point as a clean break
    const cp1 = oldControlPoints.slice(0, curveIndex);
    const cp2 = oldControlPoints.slice(curveIndex);

    this.addSegment(startNodeId, junctionNode.id, cp1, width);
    this.addSegment(junctionNode.id, endNodeId, cp2, width);

    return junctionNode;
  }
}
