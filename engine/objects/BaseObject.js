export class BaseObject {
  static type = 'base';

  static getDefinition() {
    return {
      type: this.type,
      title: this.type,
      width: 0,
      height: 0,
      layer: 0,
    };
  }

  static canPlace() {
    return true;
  }
}
