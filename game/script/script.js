const startScreen = document.getElementById('startScreen');
const gameArea = document.getElementById('gameArea');
const startButton = document.getElementById('startButton');
const canvas = document.getElementById('canvas');
const toolbox = document.getElementById('toolbox');
const gridSize = 12.5;
let draggedBlock = null;

// Проверка существования текстуры
async function checkTexture(folder, texturePath) {
    try {
        const response = await fetch(`assets/${folder}/${texturePath}`);
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

// Загрузка конфигураций и инициализация toolbox
async function initToolbox() {
    const trash = document.createElement('div');
    trash.id = 'trash';
    trash.innerHTML = '🗑️';
    toolbox.appendChild(trash);

    const folders = await getFolders();

    for (const folder of folders) {
        try {
            // Проверка наличия config.json
            const response = await fetch(`assets/${folder}/config.json`);
            if (!response.ok) {
                console.warn(`config.json не найден в assets/${folder}`);
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
                if (!(await checkTexture(folder, texture))) {
                    console.warn(`Текстура ${texture} не найдена в assets/${folder}`);
                    textureValid = false;
                    break;
                }
            }
            if (!textureValid) continue;

            // Добавление валидного объекта в toolbox
            const block = document.createElement('div');
            block.className = 'block';
            block.style.width = `${config.width}px`;
            block.style.height = `${config.height}px`;
            block.draggable = true;
            block.dataset.config = JSON.stringify(config);
            block.dataset.folder = folder;
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

    if (toolbox.children.length <= 1) { // Только мусорка
        const errorDiv = document.createElement('div');
        errorDiv.id = 'error';
        errorDiv.textContent = 'Нет валидных объектов в assets';
        toolbox.appendChild(errorDiv);
    }
}

startButton.addEventListener('click', () => {
    startScreen.style.display = 'none';
    gameArea.style.display = 'flex';
    initToolbox();
});

toolbox.addEventListener('dragstart', (e) => {
    let block = e.target;
    if (!block.classList.contains('block')) {
        block = block.closest('.block');
    }
    if (block) {
        console.log('Dragstart from toolbox:', {
            config: block.dataset.config,
            folder: block.dataset.folder
        });
        e.dataTransfer.setData('text/plain', ''); // Для совместимости с браузерами
        e.dataTransfer.setData('config', block.dataset.config || '');
        e.dataTransfer.setData('folder', block.dataset.folder || '');
    } else {
        console.warn('Dragstart failed: no block found');
    }
});

canvas.addEventListener('dragstart', (e) => {
    let block = e.target;
    if (!block.classList.contains('block')) {
        block = block.closest('.block');
    }
    if (block) {
        console.log('Dragstart from canvas:', {
            config: block.dataset.config,
            folder: block.dataset.folder
        });
        draggedBlock = block;
        e.dataTransfer.setData('text/plain', '');
        e.dataTransfer.setData('isFromCanvas', 'true');
    } else {
        console.warn('Dragstart failed: no block found');
    }
});

canvas.addEventListener('dragover', (e) => {
    e.preventDefault();
});

canvas.addEventListener('drop', (e) => {
    e.preventDefault();
    const configData = e.dataTransfer.getData('config');
    const folder = e.dataTransfer.getData('folder');
    const isFromCanvas = e.dataTransfer.getData('isFromCanvas');
    console.log('Drop on canvas:', {
        config: configData,
        folder: folder,
        isFromCanvas: isFromCanvas,
        offsetX: e.offsetX,
        offsetY: e.offsetY
    });

    if (configData && folder) {
        // Новый блок из toolbox
        try {
            const config = JSON.parse(configData);
            const snappedX = Math.round((e.offsetX - config.width / 2) / gridSize) * gridSize;
            const snappedY = Math.round((e.offsetY - config.height / 2) / gridSize) * gridSize;
            console.log('Creating new block:', { snappedX, snappedY, config });

            const block = document.createElement('div');
            block.className = 'block draggable';
            block.style.width = `${config.width}px`;
            block.style.height = `${config.height}px`;
            block.style.left = `${snappedX}px`;
            block.style.top = `${snappedY}px`;
            block.style.position = 'absolute';
            block.draggable = true;
            block.dataset.config = configData;
            block.dataset.folder = folder;
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
        } catch (error) {
            console.error(`Ошибка создания блока: ${error.message}`);
        }
    } else if (isFromCanvas && draggedBlock) {
        // Перемещение существующего блока на canvas
        try {
            const blockConfig = JSON.parse(draggedBlock.dataset.config || '{"width": 50, "height": 50}');
            const snappedX = Math.round((e.offsetX - blockConfig.width / 2) / gridSize) * gridSize;
            const snappedY = Math.round((e.offsetY - blockConfig.height / 2) / gridSize) * gridSize;
            console.log('Moving existing block:', { snappedX, snappedY });
            draggedBlock.style.left = `${snappedX}px`;
            draggedBlock.style.top = `${snappedY}px`;
            draggedBlock = null;
        } catch (error) {
            console.error(`Ошибка перемещения блока: ${error.message}`);
        }
    } else {
        console.warn('Drop failed: no valid config or folder data');
    }
});

toolbox.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (e.target.id === 'trash') {
        e.target.classList.add('dragover');
    }
});

toolbox.addEventListener('dragleave', (e) => {
    if (e.target.id === 'trash') {
        e.target.classList.remove('dragover');
    }
});

toolbox.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.target.id === 'trash' && draggedBlock) {
        console.log('Removing block via trash');
        e.target.classList.remove('dragover');
        draggedBlock.remove();
        draggedBlock = null;
    }
});