const DEPENDENCIES = {
    'road': { parent: null },
    'lane': { parent: ['road'] },
    'road_marking': { parent: ['road', 'lane'] },
    'traffic_light': { parent: ['intersection', 'road'] },
    'intersection': { parent: ['road'] },
    'crosswalk': { parent: ['road'] },
    'road_sign': { parent: ['road'] },
    'vehicle': { parent: ['lane'] },
    'pedestrian': { parent: ['crosswalk', 'road'] },
    'barrier': { parent: ['road', 'intersection'] }
};

// Проверка, является ли parent допустимым родителем для child
function isValidParent(childType, parentType) {
    const childConfig = DEPENDENCIES[childType];
    if (!childConfig) {
        console.warn(`Тип ${childType} не найден в DEPENDENCIES`);
        return false;
    }
    if (!childConfig.parent) return true; // Если родитель не требуется
    return childConfig.parent.includes(parentType);
}

// Проверка, находится ли точка на грани объекта road
function isOnRoadEdge(road, signX, signY, signWidth, signHeight) {
    const roadConfig = JSON.parse(road.dataset.config);
    const roadX = parseFloat(road.dataset.baseLeft || 0);
    const roadY = parseFloat(road.dataset.baseTop || 0);
    const roadWidth = roadConfig.width;
    const roadHeight = roadConfig.height;

    // Определяем границы знака
    const signLeft = signX - signWidth / 2;
    const signRight = signX + signWidth / 2;
    const signTop = signY - signHeight / 2;
    const signBottom = signY + signHeight / 2;

    // Определяем границы дороги
    const roadLeft = roadX;
    const roadRight = roadX + roadWidth;
    const roadTop = roadY;
    const roadBottom = roadY + roadHeight;

    // Проверяем, находится ли знак на грани дороги
    const tolerance = 5; // Допуск в пикселях для упрощения размещения
    const isOnLeftEdge = Math.abs(signRight - roadLeft) <= tolerance && signTop < roadBottom && signBottom > roadTop;
    const isOnRightEdge = Math.abs(signLeft - roadRight) <= tolerance && signTop < roadBottom && signBottom > roadTop;
    const isOnTopEdge = Math.abs(signBottom - roadTop) <= tolerance && signLeft < roadRight && signRight > roadLeft;
    const isOnBottomEdge = Math.abs(signTop - roadBottom) <= tolerance && signLeft < roadRight && signRight > roadLeft;

    return isOnLeftEdge || isOnRightEdge || isOnTopEdge || isOnBottomEdge;
}

// Проверка валидности размещения объекта
function canPlaceObject(block, x, y, canvas) {
    const config = JSON.parse(block.dataset.config);
    const folder = block.dataset.folder;
    const objectType = config.type || config.name; // Используем type, если есть, иначе name

    console.log(`Проверка размещения объекта: type=${objectType}, folder=${folder}, x=${x}, y=${y}`);

    if (!DEPENDENCIES[objectType]) {
        console.warn(`Тип объекта ${objectType} не определён в DEPENDENCIES, folder=${folder}, config=${JSON.stringify(config)}`);
        return false; // Запрещаем размещение для неизвестных типов
    }

    if (!DEPENDENCIES[objectType].parent) {
        return true; // Объекты без родителей (например, road) можно размещать везде
    }

    // Проверяем все объекты на канвасе
    const canvasBlocks = canvas.querySelectorAll('.block.draggable');
    let isValid = false;

    for (const canvasBlock of canvasBlocks) {
        const canvasConfig = JSON.parse(canvasBlock.dataset.config);
        if (isValidParent(objectType, canvasConfig.name)) {
            // Проверяем, находится ли знак на грани родительского объекта
            if (isOnRoadEdge(canvasBlock, x, y, config.width, config.height)) {
                isValid = true;
                break;
            }
        }
    }

    return isValid;
}

export { canPlaceObject };