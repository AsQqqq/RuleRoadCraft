export class Renderer {
  constructor({ world, container }) {
    this.world = world;
    this.container = container;
    this.nodes = new Map();
  }

  render(selectedIds = new Set(), previewIds = new Set()) {
    const objects = this.world.all();

    for (const [id, node] of this.nodes) {
      if (!this.world.get(id)) {
        node.remove();
        this.nodes.delete(id);
      }
    }

    for (const obj of objects) {
      let node = this.nodes.get(obj.id);

      if (!node) {
        node = document.createElement('div');
        node.className = 'block';
        node.dataset.id = obj.id;
        node.style.position = 'absolute';
        node.style.background = '#00b4db';
        node.style.borderRadius = '4px';
        this.container.appendChild(node);
        this.nodes.set(obj.id, node);
      }

      node.style.left = `${obj.x}px`;
      node.style.top = `${obj.y}px`;
      node.style.width = `${obj.width}px`;
      node.style.height = `${obj.height}px`;

      // selection highlight via CSS classes
      const isSelected = selectedIds.has(obj.id);
      const isPreview = previewIds.has(obj.id);

      node.classList.toggle('selected', isSelected);
      node.classList.toggle('selection-preview', !isSelected && isPreview);
    }
  }
}
