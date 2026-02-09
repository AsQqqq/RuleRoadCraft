// ui/axisOverlay.js
export class AxisOverlay {
  constructor() {
    this.node = document.createElement('div');
    this.node.style.position = 'fixed';
    this.node.style.left = '20px';
    this.node.style.bottom = '20px';
    this.node.style.width = '80px';
    this.node.style.height = '80px';
    this.node.style.pointerEvents = 'none';
    this.node.style.zIndex = '9999';

    this.node.innerHTML = `
      <svg width="80" height="80" viewBox="0 0 80 80">
        <!-- X axis -->
        <line x1="10" y1="70" x2="70" y2="70"
              stroke="#ff5555" stroke-width="3"/>
        <polygon points="70,70 62,65 62,75"
                 fill="#ff5555"/>
        <text x="72" y="74" fill="#ff5555"
              font-size="12" font-family="monospace">X</text>

        <!-- Y axis -->
        <line x1="10" y1="70" x2="10" y2="10"
              stroke="#55ff55" stroke-width="3"/>
        <polygon points="10,10 5,18 15,18"
                 fill="#55ff55"/>
        <text x="2" y="10" fill="#55ff55"
              font-size="12" font-family="monospace">Y</text>
      </svg>
    `;

    document.body.appendChild(this.node);
  }
}
