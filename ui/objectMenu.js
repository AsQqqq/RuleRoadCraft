export class ObjectMenu {
  constructor({ registry }) {
    this.registry = registry;
    this.entries = [];

    this.addButton = document.getElementById('addObjectButton');
    this.backdrop = document.getElementById('modalBackdrop');
    this.modal = document.getElementById('objectModal');
    this.closeBtn = document.getElementById('closeModal');
    this.content = document.getElementById('modalContent');
    this.searchInput = document.getElementById('modalSearchInput');

    this.bind();
  }

  bind() {
    this.addButton.addEventListener('click', () => this.open());
    this.closeBtn.addEventListener('click', () => this.close());

    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) this.close();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();

      // Hotkey E — toggle modal (ignore when typing in search)
      if ((e.key === 'e' || e.key === 'E' || e.key === 'у' || e.key === 'У') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        e.preventDefault();
        this.isOpen() ? this.close() : this.open();
      }
    });

    this.searchInput.addEventListener('input', () => {
      this.filterList(this.searchInput.value);
    });
  }

  renderList() {
    this.entries = this.registry.all();

    if (!this.entries.length) {
      this.content.innerHTML = `
        <div class="objEmpty">
          // <div class="objEmptyIcon">📦</div>
          <div class="objEmptyText">Пока объектов нет</div>
        </div>
      `;
      return;
    }

    this.renderEntries(this.entries);
  }

  renderEntries(entries) {
    if (!entries.length) {
      this.content.innerHTML = `
        <div class="objNoResults">
          <div class="objNoResultsIcon">🔍</div>
          <div class="objNoResultsText">Ничего не найдено</div>
        </div>
      `;
      return;
    }

    const itemsHtml = entries.map(({ ObjectClass, config, definition }) => {
      return `
        <div class="objItem" data-type="${definition.type}">
          <div class="objIcon">${config.icon ?? '⬛'}</div>
          <div class="objInfo">
            <div class="objTitle">${config.title ?? definition.type}</div>
            <div class="objDesc">${config.description ?? ''}</div>
          </div>
          <div class="objBadge">${definition.width}×${definition.height}</div>
        </div>
      `;
    }).join('');

    this.content.innerHTML = `<div class="objList">${itemsHtml}</div>`;
    this.bindItems();
  }

  bindItems() {
    this.content.querySelectorAll('.objItem').forEach(item => {
      item.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;

        const type = item.dataset.type;
        this.startDrag(type, e);
      });
    });
  }

  filterList(query) {
    const q = query.trim().toLowerCase();

    if (!q) {
      this.renderEntries(this.entries);
      return;
    }

    const filtered = this.entries.filter(({ config, definition }) => {
      const title = (config.title ?? definition.type).toLowerCase();
      const desc = (config.description ?? '').toLowerCase();
      return title.includes(q) || desc.includes(q);
    });

    this.renderEntries(filtered);
  }

  open() {
    this.searchInput.value = '';
    this.renderList();
    this.backdrop.classList.remove('hidden');

    // Focus search after animation
    requestAnimationFrame(() => {
      this.searchInput.focus();
    });
  }

  isOpen() {
    return !this.backdrop.classList.contains('hidden');
  }

  close() {
    this.backdrop.classList.add('hidden');
  }

  startDrag(type, e) {
    e.preventDefault();

    const entry = this.registry.get(type);
    if (!entry) return;

    // уведомляем UI, что начался drag
    window.dispatchEvent(new CustomEvent('object-drag-start', {
      detail: {
        ObjectClass: entry.ObjectClass,
        definition: entry.definition
      }
    }));

    this.close();
  }

}
