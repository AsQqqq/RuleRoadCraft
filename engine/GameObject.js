let NEXT_ID = 1;

export class GameObject {
    constructor({ type, x, y, width, height }) {
        this.id = NEXT_ID++;
        this.type = type;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }
}
