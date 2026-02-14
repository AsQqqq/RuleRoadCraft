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
    this._createEditButton();
    this._createDraftButton();
    this._bindHotkeys();

    // Sync initial draft button state
    this._updateDraftBtn();
  }

  // ─── Create Mode Toggle Button ───

  _createToggleButton() {
    this.btn = document.createElement('div');
    this.btn.className = 'road-tool-btn';
    this.btn.title = 'Создание дорог (R)';

    this.btn.innerHTML = `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <path d="M4 20 L10 4"/>
        <path d="M14 4 L20 20"/>
        <line x1="7" y1="12" x2="17" y2="12" stroke-dasharray="2 2"/>
      </svg>
    `;

    this.btn.addEventListener('click', () => this.toggleCreate());
    document.body.appendChild(this.btn);
  }

  // ─── Edit Mode Button ───

  _createEditButton() {
    this.editBtn = document.createElement('div');
    this.editBtn.className = 'road-edit-btn';
    this.editBtn.title = 'Редактирование дорог (Q)';

    this.editBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
        <path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
    `;

    this.editBtn.addEventListener('click', () => this.toggleEdit());
    document.body.appendChild(this.editBtn);
  }

  // ─── Draft Mode Button ───

  _createDraftButton() {
    this.draftBtn = document.createElement('div');
    this.draftBtn.className = 'road-draft-btn';
    this.draftBtn.title = 'Черновой режим (D)';
    this.draftBtn.textContent = 'D';

    this.draftBtn.addEventListener('click', () => {
      this.roadTool.toggleDraftMode();
      this._updateDraftBtn();
    });

    document.body.appendChild(this.draftBtn);
    // Hidden by default — shown when create mode is active
    this.draftBtn.style.display = 'none';
  }

  _updateDraftBtn() {
    if (this.roadTool.getDraftMode()) {
      this.draftBtn.classList.add('active');
      this.draftBtn.title = 'Черновой режим: ВКЛ (D)';
    } else {
      this.draftBtn.classList.remove('active');
      this.draftBtn.title = 'Черновой режим: ВЫКЛ (D)';
    }
  }

  // ─── Hotkeys ───

  _bindHotkeys() {
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // R / К — toggle create mode
      if (e.key === 'r' || e.key === 'R' || e.key === 'k' || e.key === 'K' ||
          e.key === 'к' || e.key === 'К') {
        e.preventDefault();
        this.toggleCreate();
        return;
      }

      // Q / Й — toggle edit mode
      if (e.key === 'q' || e.key === 'Q' ||
          e.key === 'й' || e.key === 'Й') {
        e.preventDefault();
        this.toggleEdit();
        return;
      }

      // D / В — toggle draft mode (only when create mode is active)
      if (e.key === 'd' || e.key === 'D' ||
          e.key === 'в' || e.key === 'В') {
        if (this.roadTool.isActive()) {
          e.preventDefault();
          this.roadTool.toggleDraftMode();
          this._updateDraftBtn();
        }
        return;
      }
    });
  }

  // ─── Toggle Logic ───

  toggleCreate() {
    // If edit mode is active, deactivate it first
    if (this.roadTool.isEditMode()) {
      this.roadTool.deactivateEditMode();
      this.editBtn.classList.remove('active');
    }

    if (this.roadTool.isActive()) {
      this.roadTool.deactivate();
      this.btn.classList.remove('active');
      this.draftBtn.style.display = 'none';
      this.hideHint();
    } else {
      this.roadTool.activate();
      this.btn.classList.add('active');
      this.draftBtn.style.display = 'flex';
      this._updateDraftBtn();
    }
  }

  toggleEdit() {
    // If create mode is active, deactivate it first
    if (this.roadTool.isActive()) {
      this.roadTool.deactivate();
      this.btn.classList.remove('active');
      this.draftBtn.style.display = 'none';
    }

    if (this.roadTool.isEditMode()) {
      this.roadTool.deactivateEditMode();
      this.editBtn.classList.remove('active');
      this.hideHint();
    } else {
      this.roadTool.activateEditMode();
      this.editBtn.classList.add('active');
    }
  }

  // ─── Called by RoadTool ───

  /** Called by RoadTool when it deactivates itself */
  setInactive() {
    this.btn.classList.remove('active');
    this.editBtn.classList.remove('active');
    this.draftBtn.style.display = 'none';
    this.hideHint();
  }

  /** Called by RoadTool when create mode activates */
  setActive() {
    this.btn.classList.add('active');
    this.draftBtn.style.display = 'flex';
    this._updateDraftBtn();
  }

  /** Called by RoadTool when edit mode activates */
  setEditMode() {
    this.editBtn.classList.add('active');
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
