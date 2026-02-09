export class ObjectRegistry {
  constructor() {
    this.types = new Map(); // type -> entry
  }

  register({ ObjectClass, config }) {
    const def = ObjectClass.getDefinition();
    if (!def?.type) {
      throw new Error('Object definition must have "type"');
    }

    this.types.set(def.type, {
      ObjectClass,
      config,
      definition: def
    });
  }

  get(type) {
    return this.types.get(type);
  }

  all() {
    return Array.from(this.types.values());
  }
}
