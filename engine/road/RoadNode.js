// engine/road/RoadNode.js

export class RoadNode {
  /**
   * @param {Object} params
   * @param {number} params.id       — unique ID
   * @param {number} params.x        — world X
   * @param {number} params.y        — world Y
   * @param {'boundary'|'junction'|'deadend'} params.type
   */
  constructor({ id, x, y, type }) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.type = type;
    this.edgeIds = []; // IDs of connected RoadSegments
  }

  get isBoundary() {
    return this.type === 'boundary';
  }

  get isJunction() {
    return this.type === 'junction';
  }

  get isDeadEnd() {
    return this.type === 'deadend';
  }

  addEdge(segmentId) {
    if (!this.edgeIds.includes(segmentId)) {
      this.edgeIds.push(segmentId);
    }
  }

  removeEdge(segmentId) {
    const idx = this.edgeIds.indexOf(segmentId);
    if (idx !== -1) {
      this.edgeIds.splice(idx, 1);
    }
  }
}
