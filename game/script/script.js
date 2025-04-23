const startScreen = document.getElementById('startScreen');
const gameArea = document.getElementById('gameArea');
const startButton = document.getElementById('startButton');
const canvas = document.getElementById('canvas');
const canvasContainer = document.getElementById('canvasContainer');
const toolbox = document.getElementById('toolbox');
const BASE_GRID_SIZE = 12.5; // Базовый размер сетки при zoomLevel = 1
let zoomLevel = 1; // Текущий уровень зума (1 = 100%)
const MIN_ZOOM = 0.5; // Минимальный зум (половина размера)
const MAX_ZOOM = 2;   // Максимальный зум (двойной размер)
const ZOOM_STEP = 0.1; // Шаг изменения зума
let draggedBlock = null;
let previewBlock = null;
let dragDataFallback = null;

// Проверка существования текстуры или скрипта
async function checkResource(folder, resourcePath) {
    try {
        const response = await fetch(`assets/${folder}/${resourcePath}`);
        return response.ok;
    } catch {
        return false;
    }
}

// Загрузка списка папок из folders.json
async function getFolders() {
    try {
        const response = await fetch('assets/folders.json');
        if (!response.ok) {
            throw new Error('Не удалось загрузить folders.json');
        }
        const data = await response.json();
        return data.folders || [];
    } catch (error) {
        console.error(`Ошибка загрузки folders.json: ${error.message}`);
        return [];
    }
}

// Динамическая загрузка скрипта
function loadLogicScript(folder, logicPath) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `assets/${folder}/${logicPath}`;
        script.async = true;
        script.onload = () => {
            console.log(`Скрипт ${logicPath} успешно загружен для ${folder}`);
            resolve();
        };
        script.onerror = () => {
            console.error(`Не удалось загрузить скрипт ${logicPath} для ${folder}`);
            reject(new Error(`Не удалось загрузить скрипт ${logicPath}`));
        };
        document.head.appendChild(script);
    });
}

// Загрузка конфигураций и инициализация toolbox
async function initToolbox() {
    const trash = document.createElement('div');
    trash.id = 'trash';
    trash.innerHTML = '🗑️';
    toolbox.appendChild(trash);

    const folders = await getFolders();

    for (const folder of folders) {
        try {
            const response = await fetch(`assets/${folder}/config.json`);
            if (!response.ok) {
                console.warn(`config.json не найден в assets/${folder}`);
                continue;
            }
            const config = await response.json();

            if (!config.name || !config.version || !config.width || !config.height || !Array.isArray(config.texture) || config.texture.length === 0) {
                console.warn(`Некорректный config.json в assets/${folder}: отсутствуют обязательные поля`);
                continue;
            }

            let textureValid = true;
            for (const texture of config.texture) {
                if (!(await checkResource(folder, texture))) {
                    console.warn(`Текстура ${texture} не найдена в assets/${folder}`);
                    textureValid = false;
                    break;
                }
            }
            if (!textureValid) continue;

            if (config.logic) {
                if (await checkResource(folder, config.logic)) {
                    try {
                        await loadLogicScript(folder, config.logic);
                        console.info(`Скрипт ${config.logic} загружен для ${folder}`);
                    } catch (error) {
                        console.warn(`Ошибка загрузки скрипта ${config.logic} для ${folder}: ${error.message}`);
                    }
                } else {
                    console.warn(`Скрипт ${config.logic} не найден в assets/${folder}`);
                }
            }

            const block = document.createElement('div');
            block.className = 'block';
            block.style.width = `${config.width}px`;
            block.style.height = `${config.height}px`;
            block.draggable = true;
            block.dataset.config = JSON.stringify(config);
            block.dataset.folder = folder;
            if (!block.dataset.config || !block.dataset.folder) {
                console.warn(`Ошибка: dataset.config или dataset.folder не заданы для блока в ${folder}`);
                continue;
            }
            const img = document.createElement('img');
            img.src = `assets/${folder}/${config.texture[0]}`;
            img.onerror = () => {
                console.error(`Не удалось загрузить текстуру для ${folder}`);
                img.src = 'https://via.placeholder.com/50x50/cccccc?text=Error';
            };
            block.appendChild(img);
            toolbox.appendChild(block);
        } catch (error) {
            console.warn(`Ошибка обработки папки assets/${folder}: ${error.message}`);
        }
    }

    if (toolbox.children.length <= 1) {
        const errorDiv = document.createElement('div');
        errorDiv.id = 'error';
        errorDiv.textContent = 'Нет валидных объектов в assets';
        toolbox.appendChild(errorDiv);
    }
}

// Обновление визуального масштаба
function updateZoom() {
    // Применяем масштаб к контейнеру канваса
    canvasContainer.style.transform = `scale(${zoomLevel})`;
    // Обновляем размер сетки
    canvas.style.setProperty('--grid-size', `${BASE_GRID_SIZE * zoomLevel}px`);
    // Обновляем размеры и позиции блоков на канвасе
    const blocks = canvas.querySelectorAll('.block.draggable');
    blocks.forEach(block => {
        const config = JSON.parse(block.dataset.config || '{"width": 50, "height": 50}');
        // Масштабируем размеры блока
        block.style.width = `${config.width * zoomLevel}px`;
        block.style.height = `${config.height * zoomLevel}px`;
        // Масштабируем позицию блока
        const baseLeft = parseFloat(block.dataset.baseLeft || block.style.left || 0);
        const baseTop = parseFloat(block.dataset.baseTop || block.style.top || 0);
        block.style.left = `${baseLeft * zoomLevel}px`;
        block.style.top = `${baseTop * zoomLevel}px`;
    });
}

// Обработка масштабирования колесом мыши
canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1 : -1; // Направление прокрутки
    const newZoomLevel = zoomLevel + delta * ZOOM_STEP;

    // Ограничение масштаба
    if (newZoomLevel >= MIN_ZOOM && newZoomLevel <= MAX_ZOOM) {
        zoomLevel = newZoomLevel;
        updateZoom();
        console.log(`Zoom level updated to: ${zoomLevel}`);
    }
});

startButton.addEventListener('click', () => {
    startScreen.style.display = 'none';
    gameArea.style.display = 'flex';
    initToolbox();
    updateZoom(); // Инициализация масштаба
});

// Создание пустого изображения для drag
const blankImage = new Image();
blankImage.src = 'data:image/gif;base64,R0lGODlkAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

toolbox.addEventListener('dragstart', (e) => {
    let block = e.target;
    if (!block.classList.contains('block')) {
        block = block.closest('.block');
    }
    if (block && block.dataset.config && block.dataset.folder) {
        const dragData = {
            config: block.dataset.config,
            folder: block.dataset.folder,
            isFromCanvas: false
        };
        console.log('Dragstart from toolbox:', dragData);
        try {
            const serializedData = JSON.stringify(dragData);
            console.log('Setting dataTransfer:', serializedData);
            e.dataTransfer.setData('text/plain', serializedData);
            dragDataFallback = dragData;
        } catch (error) {
            console.error(`Ошибка записи dataTransfer: ${error.message}`);
            dragDataFallback = dragData;
        }
        e.dataTransfer.setDragImage(blankImage, 0, 0);
    } else {
        console.warn('Dragstart failed: no block or invalid dataset', { block });
    }
});

canvas.addEventListener('dragstart', (e) => {
    let block = e.target;
    if (!block.classList.contains('block')) {
        block = block.closest('.block');
    }
    if (block && block.dataset.config && block.dataset.folder) {
        draggedBlock = block;
        const dragData = {
            config: block.dataset.config,
            folder: block.dataset.folder,
            isFromCanvas: true
        };
        console.log('Dragstart from canvas:', dragData);
        try {
            const serializedData = JSON.stringify(dragData);
            console.log('Setting dataTransfer:', serializedData);
            e.dataTransfer.setData('text/plain', serializedData);
            dragDataFallback = dragData;
        } catch (error) {
            console.error(`Ошибка записи dataTransfer: ${error.message}`);
            dragDataFallback = dragData;
        }
        e.dataTransfer.setDragImage(blankImage, 0, 0);
    } else {
        console.warn('Dragstart failed: no block or invalid dataset');
    }
});

canvas.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (!dragDataFallback) {
        console.warn('Dragover failed: no data in dragDataFallback');
        return;
    }

    const dragData = dragDataFallback;
    const rect = canvas.getBoundingClientRect();
    // Учитываем масштаб при вычислении координат
    const offsetX = (e.clientX - rect.left) / zoomLevel;
    const offsetY = (e.clientY - rect.top) / zoomLevel;

    console.log('Dragover on canvas:', {
        dragData: dragData,
        offsetX: offsetX,
        offsetY: offsetY
    });

    if (dragData.config && dragData.folder && !dragData.isFromCanvas) {
        try {
            const config = JSON.parse(dragData.config);
            const folder = dragData.folder;
            const snappedX = Math.round((offsetX - config.width / 2) / BASE_GRID_SIZE) * BASE_GRID_SIZE;
            const snappedY = Math.round((offsetY - config.height / 2) / BASE_GRID_SIZE) * BASE_GRID_SIZE;
            console.log('Updating preview block:', { snappedX, snappedY, config });

            if (!previewBlock) {
                console.log('Creating new preview block');
                previewBlock = document.createElement('div');
                previewBlock.className = 'block preview';
                previewBlock.style.width = `${config.width * zoomLevel}px`;
                previewBlock.style.height = `${config.height * zoomLevel}px`;
                previewBlock.style.position = 'absolute';
                previewBlock.dataset.config = dragData.config;
                previewBlock.dataset.folder = folder;
                const img = document.createElement('img');
                img.src = `assets/${folder}/${config.texture[0]}`;
                img.style.width = '100%';
                img.style.height = '100%';
                img.onerror = () => {
                    console.error(`Не удалось загрузить текстуру для ${config.name}`);
                    img.src = 'https://via.placeholder.com/50x50/cccccc?text=Error';
                };
                previewBlock.appendChild(img);
                canvas.appendChild(previewBlock);
            }
            previewBlock.style.left = `${snappedX * zoomLevel}px`;
            previewBlock.style.top = `${snappedY * zoomLevel}px`;
        } catch (error) {
            console.error(`Ошибка предпросмотра блока: ${error.message}`);
        }
    } else if (dragData.isFromCanvas && draggedBlock) {
        try {
            const blockConfig = JSON.parse(draggedBlock.dataset.config || '{"width": 50, "height": 50}');
            const snappedX = Math.round((offsetX - blockConfig.width / 2) / BASE_GRID_SIZE) * BASE_GRID_SIZE;
            const snappedY = Math.round((offsetY - blockConfig.height / 2) / BASE_GRID_SIZE) * BASE_GRID_SIZE;
            console.log('Moving existing block preview:', { snappedX, snappedY });
            draggedBlock.classList.add('preview');
            draggedBlock.style.left = `${snappedX * zoomLevel}px`;
            draggedBlock.style.top = `${snappedY * zoomLevel}px`;
        } catch (error) {
            console.error(`Ошибка предпросмотра перемещения: ${error.message}`);
        }
    } else {
        console.warn('Dragover failed: invalid drag data');
    }
});

canvas.addEventListener('dragleave', (e) => {
    if (previewBlock && !canvas.contains(e.relatedTarget)) {
        console.log('Removing preview block on dragleave');
        previewBlock.remove();
        previewBlock = null;
    }
});

canvas.addEventListener('drop', (e) => {
    e.preventDefault();
    if (!dragDataFallback) {
        console.warn('Drop failed: no data in dragDataFallback');
        return;
    }

    const dragData = dragDataFallback;
    console.log('Drop on canvas:', {
        dragData: dragData,
        offsetX: e.offsetX,
        offsetY: e.offsetY
    });

    const rect = canvas.getBoundingClientRect();
    const offsetX = (e.clientX - rect.left) / zoomLevel;
    const offsetY = (e.clientY - rect.top) / zoomLevel;

    if (dragData.config && dragData.folder && !dragData.isFromCanvas) {
        try {
            const config = JSON.parse(dragData.config);
            const folder = dragData.folder;
            const snappedX = Math.round((offsetX - config.width / 2) / BASE_GRID_SIZE) * BASE_GRID_SIZE;
            const snappedY = Math.round((offsetY - config.height / 2) / BASE_GRID_SIZE) * BASE_GRID_SIZE;
            console.log('Creating new block:', { snappedX, snappedY, config });

            if (previewBlock) {
                console.log('Converting preview block to permanent');
                previewBlock.className = 'block draggable';
                previewBlock.draggable = true;
                previewBlock.style.left = `${snappedX * zoomLevel}px`;
                previewBlock.style.top = `${snappedY * zoomLevel}px`;
                previewBlock.dataset.baseLeft = snappedX;
                previewBlock.dataset.baseTop = snappedY;
                previewBlock.style.width = `${config.width * zoomLevel}px`;
                previewBlock.style.height = `${config.height * zoomLevel}px`;
                previewBlock = null;
            } else {
                console.log('Creating new block (fallback)');
                const block = document.createElement('div');
                block.className = 'block draggable';
                block.style.width = `${config.width * zoomLevel}px`;
                block.style.height = `${config.height * zoomLevel}px`;
                block.style.left = `${snappedX * zoomLevel}px`;
                block.style.top = `${snappedY * zoomLevel}px`;
                block.style.position = 'absolute';
                block.draggable = true;
                block.dataset.config = dragData.config;
                block.dataset.folder = folder;
                block.dataset.baseLeft = snappedX;
                block.dataset.baseTop = snappedY;
                const img = document.createElement('img');
                img.src = `assets/${folder}/${config.texture[0]}`;
                img.style.width = '100%';
                img.style.height = '100%';
                img.onerror = () => {
                    console.error(`Не удалось загрузить текстуру для ${config.name}`);
                    img.src = 'https://via.placeholder.com/50x50/cccccc?text=Error';
                };
                block.appendChild(img);
                canvas.appendChild(block);
            }
        } catch (error) {
            console.error(`Ошибка создания блока: ${error.message}`);
            if (previewBlock) {
                previewBlock.remove();
                previewBlock = null;
            }
        }
    } else if (dragData.isFromCanvas && draggedBlock) {
        try {
            const blockConfig = JSON.parse(draggedBlock.dataset.config || '{"width": 50, "height": 50}');
            const snappedX = Math.round((offsetX - blockConfig.width / 2) / BASE_GRID_SIZE) * BASE_GRID_SIZE;
            const snappedY = Math.round((offsetY - blockConfig.height / 2) / BASE_GRID_SIZE) * BASE_GRID_SIZE;
            console.log('Fixing existing block:', { snappedX, snappedY });
            draggedBlock.classList.remove('preview');
            draggedBlock.style.left = `${snappedX * zoomLevel}px`;
            draggedBlock.style.top = `${snappedY * zoomLevel}px`;
            draggedBlock.dataset.baseLeft = snappedX;
            draggedBlock.dataset.baseTop = snappedY;
            draggedBlock.style.width = `${blockConfig.width * zoomLevel}px`;
            draggedBlock.style.height = `${blockConfig.height * zoomLevel}px`;
            draggedBlock = null;
        } catch (error) {
            console.error(`Ошибка перемещения блока: ${error.message}`);
        }
    } else {
        console.warn('Drop failed: invalid drag data');
    }
    dragDataFallback = null;
});

toolbox.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (e.target.id === 'trash') {
        e.target.classList.add('dragover');
    }
});

toolbox.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.target.id === 'trash' && draggedBlock) {
        console.log('Removing block via trash');
        e.target.classList.remove('dragover');
        draggedBlock.remove();
        draggedBlock = null;
        if (previewBlock) {
            previewBlock.remove();
            previewBlock = null;
        }
    }
    dragDataFallback = null;
});