// engine/road/BezierMath.js

export class BezierMath {

  /**
   * Point on cubic Bezier: B(t) = (1-t)^3*P0 + 3*(1-t)^2*t*P1 + 3*(1-t)*t^2*P2 + t^3*P3
   */
  static pointOnCubic(p0, p1, p2, p3, t) {
    const u = 1 - t;
    const uu = u * u;
    const uuu = uu * u;
    const tt = t * t;
    const ttt = tt * t;

    return {
      x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
      y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y
    };
  }

  /**
   * First derivative (tangent) of cubic Bezier at t
   */
  static tangentOnCubic(p0, p1, p2, p3, t) {
    const u = 1 - t;
    const uu = u * u;
    const tt = t * t;

    return {
      x: 3 * uu * (p1.x - p0.x) + 6 * u * t * (p2.x - p1.x) + 3 * tt * (p3.x - p2.x),
      y: 3 * uu * (p1.y - p0.y) + 6 * u * t * (p2.y - p1.y) + 3 * tt * (p3.y - p2.y)
    };
  }

  /**
   * Approximate arc length of cubic Bezier (numerical integration)
   */
  static cubicLength(p0, p1, p2, p3, steps = 64) {
    let length = 0;
    let prev = p0;

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const curr = this.pointOnCubic(p0, p1, p2, p3, t);
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      length += Math.sqrt(dx * dx + dy * dy);
      prev = curr;
    }

    return length;
  }

  /**
   * Convert Catmull-Rom segment (p0, p1, p2, p3) to cubic Bezier control points.
   * The resulting Bezier goes from p1 to p2.
   * alpha: 0 = uniform, 0.5 = centripetal, 1 = chordal
   */
  static catmullRomToBezier(p0, p1, p2, p3, smoothing1 = 1, smoothing2 = undefined) {
    // smoothing1: smoothing at p1 (for cp1), smoothing2: smoothing at p2 (for cp2)
    // 0 = sharp corner (no tangent), 1 = full Catmull-Rom smoothing
    if (smoothing2 === undefined) smoothing2 = smoothing1;

    const t1 = (1 / 3) * smoothing1;
    const t2 = (1 / 3) * smoothing2;

    return {
      cp1: {
        x: p1.x + t1 * (p2.x - p0.x),
        y: p1.y + t1 * (p2.y - p0.y)
      },
      cp2: {
        x: p2.x - t2 * (p3.x - p1.x),
        y: p2.y - t2 * (p3.y - p1.y)
      }
    };
  }

  /**
   * Convert a sequence of user points into cubic Bezier curves using Catmull-Rom.
   * Returns array of { p0, p1, p2, p3 } (cubic bezier control points).
   * Each curve goes from points[i] to points[i+1].
   */
  static pointsToBezierCurves(points) {
    if (points.length < 2) return [];

    const curves = [];
    const n = points.length;

    for (let i = 0; i < n - 1; i++) {
      // Catmull-Rom needs 4 points: prev, current, next, nextNext
      // For endpoints, mirror the point
      const prev = i > 0 ? points[i - 1] : {
        x: 2 * points[0].x - points[1].x,
        y: 2 * points[0].y - points[1].y
      };
      const curr = points[i];
      const next = points[i + 1];
      const nextNext = i + 2 < n ? points[i + 2] : {
        x: 2 * points[n - 1].x - points[n - 2].x,
        y: 2 * points[n - 1].y - points[n - 2].y
      };

      // Use per-point smoothing: curr controls cp1, next controls cp2
      const smoothingCurr = curr.smoothing !== undefined ? curr.smoothing : 1;
      const smoothingNext = next.smoothing !== undefined ? next.smoothing : 1;
      const { cp1, cp2 } = this.catmullRomToBezier(prev, curr, next, nextNext, smoothingCurr, smoothingNext);

      curves.push({
        p0: curr,
        p1: cp1,
        p2: cp2,
        p3: next
      });
    }

    return curves;
  }

  /**
   * Sample points along a cubic Bezier curve
   */
  static sampleCubic(p0, p1, p2, p3, count = 32) {
    const points = [];
    for (let i = 0; i <= count; i++) {
      points.push(this.pointOnCubic(p0, p1, p2, p3, i / count));
    }
    return points;
  }

  /**
   * Find closest point on a cubic Bezier to a given point.
   * Returns { dist, t, point }
   */
  static distanceToCubic(point, p0, p1, p2, p3, steps = 64) {
    let minDist = Infinity;
    let minT = 0;
    let closest = p0;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const p = this.pointOnCubic(p0, p1, p2, p3, t);
      const dx = p.x - point.x;
      const dy = p.y - point.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < minDist) {
        minDist = dist;
        minT = t;
        closest = p;
      }
    }

    return { dist: minDist, t: minT, point: closest };
  }

  /**
   * Split a cubic Bezier at parameter t using De Casteljau's algorithm.
   * Returns { left: [p0, p1, p2, p3], right: [p0, p1, p2, p3] }
   */
  static splitCubic(p0, p1, p2, p3, t) {
    const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

    const a = lerp(p0, p1, t);
    const b = lerp(p1, p2, t);
    const c = lerp(p2, p3, t);

    const d = lerp(a, b, t);
    const e = lerp(b, c, t);

    const f = lerp(d, e, t);

    return {
      left: [p0, a, d, f],
      right: [f, e, c, p3]
    };
  }

  /**
   * Generate SVG path data string from an array of Bezier curves.
   * Each curve = { p0, p1, p2, p3 }
   */
  static curvesToSVGPath(curves) {
    if (curves.length === 0) return '';

    let d = `M ${curves[0].p0.x} ${curves[0].p0.y}`;

    for (const c of curves) {
      d += ` C ${c.p1.x} ${c.p1.y}, ${c.p2.x} ${c.p2.y}, ${c.p3.x} ${c.p3.y}`;
    }

    return d;
  }

  /**
   * Generate SVG path data for straight line segments (polyline).
   * Used in draft mode for angular preview.
   * @param {{x:number, y:number}[]} points
   * @returns {string}
   */
  static pointsToPolylinePath(points) {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x} ${points[i].y}`;
    }
    return d;
  }

  /**
   * Distance between two points
   */
  static distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}
