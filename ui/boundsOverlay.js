// ui/boundsOverlay.js
export class BoundsOverlay {
  constructor({ bounds, camera, viewport }) {
    this.bounds = bounds;
    this.camera = camera;
    this.viewport = viewport;

    this.node = document.createElement('div');
    this.node.style.position = 'absolute';
    this.node.style.top = '0';
    this.node.style.left = '0';
    this.node.style.width = '100%';
    this.node.style.height = '100%';
    this.node.style.pointerEvents = 'none';
    this.node.style.zIndex = '5';

    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('width', '100%');
    this.svg.setAttribute('height', '100%');

    this.rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    this.rect.setAttribute('fill', 'none');
    this.rect.setAttribute('stroke', 'red');
    this.rect.setAttribute('stroke-width', '2');
    this.rect.setAttribute('stroke-dasharray', '6 4');

    this.svg.appendChild(this.rect);
    this.node.appendChild(this.svg);
    this.viewport.appendChild(this.node);

    this.update();
  }

  update() {
    const tl = this.camera.worldToScreen(
      this.bounds.minX,
      this.bounds.minY
    );
    const br = this.camera.worldToScreen(
      this.bounds.maxX,
      this.bounds.maxY
    );

    this.rect.setAttribute('x', tl.x);
    this.rect.setAttribute('y', tl.y);
    this.rect.setAttribute('width', br.x - tl.x);
    this.rect.setAttribute('height', br.y - tl.y);
  }
}
