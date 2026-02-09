import { BaseObject } from '../../engine/objects/BaseObject.js';

export class GoldCube extends BaseObject {
  static type = 'goldCube';

  static getDefinition() {
    return {
      type: this.type,
      title: 'GoldCube',
      width: 100,
      height: 100,
      layer: 1000, // всегда сверху
    };
  }

  static canPlace() {
    return true; // где угодно
  }
}
