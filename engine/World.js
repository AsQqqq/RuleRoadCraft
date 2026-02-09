export class World {
    constructor() {
        this.objects = new Map();
    }

    add(object) {
        this.objects.set(object.id, object);
    }

    remove(id) {
        this.objects.delete(id);
    }

    get(id) {
        return this.objects.get(id);
    }

    all() {
        return Array.from(this.objects.values());
    }

    clear() {
        this.objects.clear();
    }
}
