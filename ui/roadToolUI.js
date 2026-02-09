// ui/roadToolUI.js

export class RoadToolUI {
  /**
   * @param {Object} params
   * @param {RoadTool} params.roadTool
   */
  constructor({ roadTool }) {
    this.roadTool = roadTool;
    this.hintEl = null;
    this.confirmBackdrop = null;

    this._createToggleButton();
    this._bindHotkey();
  }

  // ─── Toggle Button ───

  _createToggleButton() {
    this.btn = document.createElement('div');
    this.btn.className = 'road-tool-btn';
    this.btn.title = 'Road Tool (R)';

    // Road icon (simple SVG inline)
    this.btn.innerHTML = `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <path d="M4 20 L10 4"/>
        <path d="M14 4 L20 20"/>
        <line x1="7" y1="12" x2="17" y2="12" stroke-dasharray="2 2"/>
      </svg>
    `;

    this.btn.addEventListener('click', () => this.toggle());
    document.body.appendChild(this.btn);
  }

  _bindHotkey() {
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // R / K (Russian layout)
      if (e.key === 'r' || e.key === 'R' || e.key === 'k' || e.key === 'K' ||
          e.key === 'к' || e.key === 'К') {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  toggle() {
    if (this.roadTool.isActive()) {
      this.roadTool.deactivate();
      this.btn.classList.remove('active');
      this.hideHint();
    } else {
      this.roadTool.activate();
      this.btn.classList.add('active');
    }
  }

  /** Called by RoadTool when it deactivates itself */
  setInactive() {
    this.btn.classList.remove('active');
    this.hideHint();
  }

  /** Called by RoadTool when it activates */
  setActive() {
    this.btn.classList.add('active');
  }

  // ─── Hint ───

  /**
   * Show a hint toast at the bottom of the screen.
   * @param {string} text
   */
  showHint(text) {
    this.hideHint();

    this.hintEl = document.createElement('div');
    this.hintEl.className = 'road-hint';
    this.hintEl.textContent = text;
    document.body.appendChild(this.hintEl);
  }

  hideHint() {
    if (this.hintEl) {
      this.hintEl.remove();
      this.hintEl = null;
    }
  }

  // ─── Dead-End Confirmation ───

  /**
   * Show modal asking if user wants to create a dead-end.
   * @returns {Promise<boolean>} true = confirm dead-end, false = cancel
   */
  showDeadEndConfirm() {
    return new Promise((resolve) => {
      // Backdrop
      this.confirmBackdrop = document.createElement('div');
      this.confirmBackdrop.className = 'road-confirm-backdrop';

      // Modal
      const modal = document.createElement('div');
      modal.className = 'road-confirm-modal';
      modal.innerHTML = `
        <h3>Tупик</h3>
        <p>Здесь образуется тупик. Машины будут разворачиваться и уезжать обратно. Продолжить?</p>
        <div class="road-confirm-actions">
          <button class="btn-cancel">Отмена</button>
          <button class="btn-confirm">Создать тупик</button>
        </div>
      `;

      this.confirmBackdrop.appendChild(modal);
      document.body.appendChild(this.confirmBackdrop);

      const cleanup = (result) => {
        if (this.confirmBackdrop) {
          this.confirmBackdrop.remove();
          this.confirmBackdrop = null;
        }
        resolve(result);
      };

      modal.querySelector('.btn-cancel').addEventListener('click', () => cleanup(false));
      modal.querySelector('.btn-confirm').addEventListener('click', () => cleanup(true));

      // Escape to cancel
      const onKey = (e) => {
        if (e.key === 'Escape') {
          window.removeEventListener('keydown', onKey);
          cleanup(false);
        }
      };
      window.addEventListener('keydown', onKey);

      // Click outside to cancel
      this.confirmBackdrop.addEventListener('click', (e) => {
        if (e.target === this.confirmBackdrop) cleanup(false);
      });
    });
  }
}
