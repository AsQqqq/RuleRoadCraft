document.addEventListener('DOMContentLoaded', () => {
    const helpIcon = document.getElementById('helpIcon');
    let helpMenu = null;

    // Create the help menu dynamically
    function createHelpMenu() {
        helpMenu = document.createElement('div');
        helpMenu.id = 'helpMenu';
        helpMenu.style.position = 'fixed';
        helpMenu.style.bottom = '50px';
        helpMenu.style.left = '10px';
        helpMenu.style.background = 'linear-gradient(to bottom, #2a2a2a, #1e1e1e)';
        helpMenu.style.border = '1px solid #00b4db';
        helpMenu.style.borderRadius = '10px';
        helpMenu.style.padding = '15px';
        helpMenu.style.color = '#ffffff';
        helpMenu.style.fontFamily = "'Roboto', Arial, sans-serif";
        helpMenu.style.fontSize = '14px';
        helpMenu.style.lineHeight = '1.5';
        helpMenu.style.boxShadow = '0 4px 15px rgba(0, 180, 219, 0.2)';
        helpMenu.style.zIndex = '101';
        helpMenu.style.maxWidth = '300px';
        helpMenu.style.opacity = '0';
        helpMenu.style.transform = 'translateY(10px)';
        helpMenu.style.transition = 'opacity 0.3s ease, transform 0.3s ease';

        const ul = document.createElement('ul');
        ul.style.listStyleType = 'disc';
        ul.style.paddingLeft = '20px';
        ul.style.margin = '0';

        const hints = [
            'Используйте значок мусорки для удаления объектов, перетаскивая выделенные блоки на него, так же можно просто выделить и нажать delete или backspace.',
            'Чтобы выделить несколько объектов на сетке, удерживайте клавишу Ctrl и щелкайте по каждому объекту левой кнопкой мыши.'
        ];

        hints.forEach(hint => {
            const li = document.createElement('li');
            li.textContent = hint;
            li.style.marginBottom = '10px';
            ul.appendChild(li);
        });

        helpMenu.appendChild(ul);
        document.body.appendChild(helpMenu);

        // Show the menu with animation
        setTimeout(() => {
            helpMenu.style.opacity = '1';
            helpMenu.style.transform = 'translateY(0)';
        }, 10);
    }

    // Remove the help menu
    function removeHelpMenu() {
        if (helpMenu) {
            helpMenu.style.opacity = '0';
            helpMenu.style.transform = 'translateY(10px)';
            setTimeout(() => {
                helpMenu.remove();
                helpMenu = null;
            }, 300);
        }
    }

    // Toggle the help menu
    helpIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        if (helpMenu) {
            removeHelpMenu();
        } else {
            createHelpMenu();
        }
    });

    // Close the menu when clicking outside
    document.addEventListener('click', (e) => {
        if (helpMenu && !helpMenu.contains(e.target) && e.target !== helpIcon) {
            removeHelpMenu();
        }
    });

    // Prevent context menu on help icon
    helpIcon.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });
});