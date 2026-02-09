// ui/ghostRenderer.js
export class GhostRenderer {
  constructor({ container }) {
    this.container = container;
    this.node = null;
  }

  show(definition) {
    this.hide();

    const el = document.createElement('div');
    el.className = 'ghost';
    el.style.position = 'absolute';
    el.style.width = `${definition.width}px`;
    el.style.height = `${definition.height}px`;
    el.style.pointerEvents = 'none';
    el.style.opacity = '0.6';
    el.style.background = '#ffd700';
    el.style.border = '2px dashed #ffb700';
    el.style.boxSizing = 'border-box';

    this.container.appendChild(el);
    this.node = el;
  }

  move(x, y) {
    if (!this.node) return;
    this.node.style.left = `${x}px`;
    this.node.style.top = `${y}px`;
  }

  hide() {
    if (this.node) {
      this.node.remove();
      this.node = null;
    }
  }
}
