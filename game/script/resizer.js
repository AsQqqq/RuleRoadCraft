// Настраиваемые ограничения для ширины toolbox
const TOOLBOX_MIN_WIDTH = 200; // Минимальная ширина в пикселях
const TOOLBOX_MAX_WIDTH = 600; // Максимальная ширина в пикселях


// Обработка изменения размера toolbox
let isResizing = false;

resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    document.body.style.cursor = 'ew-resize';
    e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;

    const newWidth = e.clientX;
    if (newWidth >= TOOLBOX_MIN_WIDTH && newWidth <= TOOLBOX_MAX_WIDTH) {
        toolbox.style.width = `${newWidth}px`;
    } else if (newWidth < TOOLBOX_MIN_WIDTH) {
        toolbox.style.width = `${TOOLBOX_MIN_WIDTH}px`;
    } else if (newWidth > TOOLBOX_MAX_WIDTH) {
        toolbox.style.width = `${TOOLBOX_MAX_WIDTH}px`;
    }
});

document.addEventListener('mouseup', () => {
    if (isResizing) {
        isResizing = false;
        document.body.style.cursor = 'default';
    }
});