const gameArea = document.getElementById('gameArea');
const canvas = document.getElementById('canvas');
const canvasContainer = document.getElementById('canvasContainer');
const toolbox = document.getElementById('toolbox');
const BASE_GRID_SIZE = 12.5; // Базовый размер сетки при zoomLevel = 1
let zoomLevel = 1; // Текущий уровень зума (1 = 100%)
let draggedBlock = null;
let draggedBlocks = []; // For multi-block dragging
let previewBlock = null;
let dragDataFallback = null;
let panOffsetX = 0; // Смещение по X для панорамирования
let panOffsetY = 0; // Смещение по Y для панорамирования
let selectedBlocks = []; // Список выделенных блоков

document.addEventListener('contextmenu', function(event) {
    event.preventDefault();
});

// Проверка существования текстуры или скрипта
async function checkResource(folder, resourcePath) {
    try {
        const response = await fetch(`assets/${folder}/${resourcePath}`, { method: 'HEAD' });
        return response.ok;
    } catch (error) {
        console.error(`Ошибка проверки ресурса ${resourcePath} в папке ${folder}: ${error.message}`);
        return false;
    }
}

// Загрузка списка папок из folders.json
async function getFolders() {
    try {
        const response = await fetch('assets/folders.json');
        if (!response.ok) {
            throw new Error(`HTTP ошибка ${response.status}: Не удалось загрузить folders.json`);
        }
        const data = await response.json();
        if (!Array.isArray(data.folders)) {
            throw new Error('folders.json не содержит массив folders');
        }
        console.log('Загруженные папки:', data.folders);
        return data.folders;
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
    // Очистка toolbox перед инициализацией
    toolbox.innerHTML = '';

    // Создание и добавление мусорки
    const trash = document.createElement('div');
    trash.id = 'trash';
    trash.innerHTML = '🗑️';
    trash.style.display = 'flex';
    trash.style.alignItems = 'center';
    trash.style.justifyContent = 'center';
    toolbox.appendChild(trash);
    console.log('Мусорка добавлена в toolbox');

    const folders = await getFolders();
    if (folders.length === 0) {
        console.warn('Нет доступных папок в folders.json');
    }

    for (const folder of folders) {
        try {
            const response = await fetch(`assets/${folder}/config.json`);
            if (!response.ok) {
                console.warn(`config.json не найден в assets/${folder}: HTTP ${response.status}`);
                continue;
            }
            const config = await response.json();

            // Проверка обязательных полей
            if (!config.name || !config.version || !config.width || !config.height || !Array.isArray(config.texture) || config.texture.length === 0) {
                console.warn(`Некорректный config.json в assets/${folder}: отсутствуют обязательные поля`);
                continue;
            }

            // Проверка текстур
            let textureValid = true;
            for (const texture of config.texture) {
                if (!(await checkResource(folder, texture))) {
                    console.warn(`Текстура ${texture} не найдена в assets/${folder}`);
                    textureValid = false;
                    break;
                }
            }
            if (!textureValid) continue;

            // Загрузка скрипта логики, если он есть
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

            // Создание блока для toolbox
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
            img.style.width = '100%';
            img.style.height = '100%';
            img.onerror = () => {
                console.error(`Не удалось загрузить текстуру ${config.texture[0]} для ${folder}`);
                img.src = 'https://via.placeholder.com/50x50/cccccc?text=Error';
            };
            block.appendChild(img);
            toolbox.appendChild(block);
            console.log(`Блок для ${folder} добавлен в toolbox`);
        } catch (error) {
            console.warn(`Ошибка обработки папки assets/${folder}: ${error.message}`);
        }
    }

    // Проверка, есть ли блоки в toolbox
    const blockCount = toolbox.querySelectorAll('.block').length;
    if (blockCount === 0) {
        const errorDiv = document.createElement('div');
        errorDiv.id = 'error';
        errorDiv.textContent = 'Нет валидных объектов в assets';
        toolbox.appendChild(errorDiv);
        console.warn('Нет валидных блоков для отображения в toolbox');
    } else {
        console.log(`Успешно добавлено ${blockCount} блоков в toolbox`);
    }
}

// Обновление визуального масштаба и панорамирования
function updateTransform() {
    const transform = `translate(${panOffsetX}px, ${panOffsetY}px) scale(${zoomLevel})`;
    canvasContainer.style.transform = transform;
    console.log('Applied transform:', transform);
    canvas.style.setProperty('--grid-size', `${BASE_GRID_SIZE * zoomLevel}px`);
    const blocks = canvas.querySelectorAll('.block.draggable');
    blocks.forEach(block => {
        const config = JSON.parse(block.dataset.config || '{"width": 50, "height": 50}');
        block.style.width = `${config.width * zoomLevel}px`;
        block.style.height = `${config.height * zoomLevel}px`;
        const baseLeft = parseFloat(block.dataset.baseLeft || block.style.left || 0);
        const baseTop = parseFloat(block.dataset.baseTop || block.style.top || 0);
        block.style.left = `${baseLeft * zoomLevel}px`;
        block.style.top = `${baseTop * zoomLevel}px`;
    });
}

// Очистка выделения
function clearSelection() {
    selectedBlocks.forEach(block => block.classList.remove('selected'));
    selectedBlocks = [];
}

// Проверка, пересекаются ли два прямоугольника
function rectanglesIntersect(rect1, rect2) {
    return !(rect1.right < rect2.left ||
             rect1.left > rect2.right ||
             rect1.bottom < rect2.top ||
             rect1.top > rect2.bottom);
}

// Инициализация игры
gameArea.style.display = 'flex';
initToolbox();
updateTransform();

// Создание пустого изображения для drag
const blankImage = new Image();
blankImage.src = 'data:image/gif;base64,R0lGODlkAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

// Обработка клика для выделения одного блока или очистки выделения
canvas.addEventListener('click', (e) => {
    const target = e.target.closest('.block.draggable');
    if (target) {
        if (!e.ctrlKey) {
            clearSelection();
        }
        target.classList.add('selected');
        if (!selectedBlocks.includes(target)) {
            selectedBlocks.push(target);
        }
    } else {
        clearSelection();
    }
});

// Dragstart для блоков из toolbox
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

// Dragstart для блоков на канвасе
canvas.addEventListener('dragstart', (e) => {
    let block = e.target;
    if (!block.classList.contains('block')) {
        block = block.closest('.block');
    }
    if (block && block.dataset.config && block.dataset.folder) {
        draggedBlock = block;
        // Используем selectedBlocks, если блок входит в выделение
        draggedBlocks = selectedBlocks.includes(block) && selectedBlocks.length > 0 ? [...selectedBlocks] : [block];
        const dragData = {
            config: block.dataset.config,
            folder: block.dataset.folder,
            isFromCanvas: true,
            isMultiDrag: draggedBlocks.length > 1
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
        // Сохраняем выделение для перетаскиваемых блоков
        draggedBlocks.forEach(b => b.classList.add('selected'));
    } else {
        console.warn('Dragstart failed: no block or invalid dataset');
    }
});

// Dragover для канваса
canvas.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (!dragDataFallback) {
        console.warn('Dragover failed: no data in dragDataFallback');
        return;
    }

    const dragData = dragDataFallback;
    const rect = canvas.getBoundingClientRect();
    const offsetX = ((e.clientX - rect.left) / zoomLevel);
    const offsetY = ((e.clientY - rect.top) / zoomLevel);

    console.log('Dragover on canvas:', {
        dragData: dragData,
        offsetX: offsetX,
        offsetY: offsetY,
        clientX: e.clientX,
        clientY: e.clientY,
        rectLeft: rect.left,
        rectTop: rect.top,
        zoomLevel
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
    } else if (dragData.isFromCanvas) {
        try {
            if (dragData.isMultiDrag && draggedBlocks.length > 0) {
                const mouseBaseX = Math.round(offsetX / BASE_GRID_SIZE) * BASE_GRID_SIZE;
                const mouseBaseY = Math.round(offsetY / BASE_GRID_SIZE) * BASE_GRID_SIZE;
                const refLeft = parseFloat(draggedBlock.dataset.baseLeft || 0);
                const refTop = parseFloat(draggedBlock.dataset.baseTop || 0);
                draggedBlocks.forEach(block => {
                    const blockConfig = JSON.parse(block.dataset.config || '{"width": 50, "height": 50}');
                    const baseLeft = parseFloat(block.dataset.baseLeft || 0);
                    const baseTop = parseFloat(block.dataset.baseTop || 0);
                    const offsetLeft = baseLeft - refLeft;
                    const offsetTop = baseTop - refTop;
                    const snappedX = mouseBaseX + offsetLeft;
                    const snappedY = mouseBaseY + offsetTop;
                    block.classList.add('preview');
                    block.style.left = `${snappedX * zoomLevel}px`;
                    block.style.top = `${snappedY * zoomLevel}px`;
                });
            } else if (draggedBlock) {
                const blockConfig = JSON.parse(draggedBlock.dataset.config || '{"width": 50, "height": 50}');
                const snappedX = Math.round((offsetX - blockConfig.width / 2) / BASE_GRID_SIZE) * BASE_GRID_SIZE;
                const snappedY = Math.round((offsetY - blockConfig.height / 2) / BASE_GRID_SIZE) * BASE_GRID_SIZE;
                console.log('Moving existing block preview:', { snappedX, snappedY });
                draggedBlock.classList.add('preview');
                draggedBlock.style.left = `${snappedX * zoomLevel}px`;
                draggedBlock.style.top = `${snappedY * zoomLevel}px`;
            }
        } catch (error) {
            console.error(`Ошибка предпросмотра перемещения: ${error.message}`);
        }
    } else {
        console.warn('Dragover failed: invalid drag data');
    }
});

// Dragleave для канваса
canvas.addEventListener('dragleave', (e) => {
    if (previewBlock && !canvas.contains(e.relatedTarget)) {
        console.log('Removing preview block on dragleave');
        previewBlock.remove();
        previewBlock = null;
    }
});

// Drop для канваса
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
        offsetY: e.offsetY,
        clientX: e.clientX,
        clientY: e.clientY
    });

    const rect = canvas.getBoundingClientRect();
    const offsetX = ((e.clientX - rect.left) / zoomLevel);
    const offsetY = ((e.clientY - rect.top) / zoomLevel);

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
                block.style.height = `${config.width * zoomLevel}px`;
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
            // Очищаем выделение после размещения нового блока
            clearSelection();
        } catch (error) {
            console.error(`Ошибка создания блока: ${error.message}`);
            if (previewBlock) {
                previewBlock.remove();
                previewBlock = null;
            }
        }
    } else if (dragData.isFromCanvas) {
        try {
            if (dragData.isMultiDrag && draggedBlocks.length > 0) {
                const mouseBaseX = Math.round(offsetX / BASE_GRID_SIZE) * BASE_GRID_SIZE;
                const mouseBaseY = Math.round(offsetY / BASE_GRID_SIZE) * BASE_GRID_SIZE;
                const refLeft = parseFloat(draggedBlock.dataset.baseLeft || 0);
                const refTop = parseFloat(draggedBlock.dataset.baseTop || 0);
                draggedBlocks.forEach(block => {
                    const blockConfig = JSON.parse(block.dataset.config || '{"width": 50, "height": 50}');
                    const baseLeft = parseFloat(block.dataset.baseLeft || 0);
                    const baseTop = parseFloat(block.dataset.baseTop || 0);
                    const offsetLeft = baseLeft - refLeft;
                    const offsetTop = baseTop - refTop;
                    const snappedX = mouseBaseX + offsetLeft;
                    const snappedY = mouseBaseY + offsetTop;
                    block.classList.remove('preview');
                    block.classList.add('selected'); // Сохраняем выделение после перетаскивания
                    block.style.left = `${snappedX * zoomLevel}px`;
                    block.style.top = `${snappedY * zoomLevel}px`;
                    block.dataset.baseLeft = snappedX;
                    block.dataset.baseTop = snappedY;
                    block.style.width = `${blockConfig.width * zoomLevel}px`;
                    block.style.height = `${blockConfig.height * zoomLevel}px`;
                });
                draggedBlocks = [];
            } else if (draggedBlock) {
                const blockConfig = JSON.parse(draggedBlock.dataset.config || '{"width": 50, "height": 50}');
                const snappedX = Math.round((offsetX - blockConfig.width / 2) / BASE_GRID_SIZE) * BASE_GRID_SIZE;
                const snappedY = Math.round((offsetY - blockConfig.height / 2) / BASE_GRID_SIZE) * BASE_GRID_SIZE;
                console.log('Fixing existing block:', { snappedX, snappedY });
                draggedBlock.classList.remove('preview');
                draggedBlock.classList.add('selected'); // Сохраняем выделение после перетаскивания
                draggedBlock.style.left = `${snappedX * zoomLevel}px`;
                draggedBlock.style.top = `${snappedY * zoomLevel}px`;
                draggedBlock.dataset.baseLeft = snappedX;
                draggedBlock.dataset.baseTop = snappedY;
                draggedBlock.style.width = `${blockConfig.width * zoomLevel}px`;
                draggedBlock.style.height = `${blockConfig.height * zoomLevel}px`;
                draggedBlock = null;
            }
            // Обновляем selectedBlocks после перетаскивания
            selectedBlocks = [...canvas.querySelectorAll('.block.draggable.selected')];
        } catch (error) {
            console.error(`Ошибка перемещения блока: ${error.message}`);
        }
    } else {
        console.warn('Drop failed: invalid drag data');
    }
    dragDataFallback = null;
});

// Dragover для toolbox
toolbox.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (e.target.id === 'trash') {
        e.target.classList.add('dragover');
    }
});

// Drop для toolbox (удаление в мусорку)
toolbox.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.target.id === 'trash') {
        console.log('Removing block(s) via trash');
        e.target.classList.remove('dragover');
        if (draggedBlocks.length > 0) {
            draggedBlocks.forEach(block => block.remove());
            draggedBlocks = [];
            clearSelection();
        } else if (draggedBlock) {
            draggedBlock.remove();
            draggedBlock = null;
            clearSelection();
        }
        if (previewBlock) {
            previewBlock.remove();
            previewBlock = null;
        }
    }
    dragDataFallback = null;
});


// Обработка нажатия клавиш Delete или Backspace для удаления выделенных блоков
document.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault(); // Предотвращаем стандартное поведение браузера
        const selected = canvas.querySelectorAll('.block.draggable.selected');
        if (selected.length > 0) {
            console.log(`Удаление ${selected.length} выделенных блоков`);
            selected.forEach(block => block.remove());
            clearSelection(); // Очищаем массив selectedBlocks
        }
    }
});