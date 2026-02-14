// engine/road/RoadSegment.js

import { BezierMath } from './BezierMath.js';

export class RoadSegment {
  /**
   * @param {Object} params
   * @param {number} params.id
   * @param {number} params.startNodeId
   * @param {number} params.endNodeId
   * @param {{x:number, y:number}[]} params.controlPoints — user-placed intermediate points
   * @param {number} [params.width=50]
   */
  constructor({ id, startNodeId, endNodeId, controlPoints = [], width = 50 }) {
    this.id = id;
    this.startNodeId = startNodeId;
    this.endNodeId = endNodeId;
    // Normalize: ensure each control point has a smoothing value
    this.controlPoints = controlPoints.map(cp => ({
      x: cp.x,
      y: cp.y,
      smoothing: cp.smoothing !== undefined ? cp.smoothing : 0
    }));
    this.width = width;

    /** @type {{ p0, p1, p2, p3 }[]} computed cubic Bezier segments */
    this.bezierCurves = [];

    /** @type {string} cached SVG path data */
    this._svgPath = '';
  }

  /**
   * Rebuild bezier curves from control points + start/end nodes.
   * Must be called after control points change.
   * @param {RoadNode} startNode
   * @param {RoadNode} endNode
   */
  rebuild(startNode, endNode) {
    // Full point sequence: start → controlPoints → end
    // Nodes get smoothing: 0 (sharp) so they don't round the first/last corner
    const allPoints = [
      { x: startNode.x, y: startNode.y, smoothing: 0 },
      ...this.controlPoints,
      { x: endNode.x, y: endNode.y, smoothing: 0 }
    ];

    this.bezierCurves = BezierMath.pointsToBezierCurves(allPoints);
    this._svgPath = BezierMath.curvesToSVGPath(this.bezierCurves);
  }

  /**
   * Get SVG path data string: "M ... C ... C ..."
   */
  toSVGPath() {
    return this._svgPath;
  }

  /**
   * Find closest point on this road segment to a world position.
   * @param {number} worldX
   * @param {number} worldY
   * @returns {{ x, y, t, curveIndex, dist }}
   */
  closestPoint(worldX, worldY) {
    const point = { x: worldX, y: worldY };
    let best = { dist: Infinity, t: 0, curveIndex: 0, x: 0, y: 0 };

    for (let i = 0; i < this.bezierCurves.length; i++) {
      const { p0, p1, p2, p3 } = this.bezierCurves[i];
      const result = BezierMath.distanceToCubic(point, p0, p1, p2, p3);

      if (result.dist < best.dist) {
        best = {
          dist: result.dist,
          t: result.t,
          curveIndex: i,
          x: result.point.x,
          y: result.point.y
        };
      }
    }

    return best;
  }

  /**
   * Get total arc length of the segment
   */
  getLength() {
    let total = 0;
    for (const { p0, p1, p2, p3 } of this.bezierCurves) {
      total += BezierMath.cubicLength(p0, p1, p2, p3);
    }
    return total;
  }
}
