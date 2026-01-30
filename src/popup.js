/**
 * popup.js
 * Interface de contrôle AriaML - Communication interne au monde ISOLATED.
 */

const api = typeof browser !== 'undefined' ? browser : chrome;

async function initPopup() {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });

    // On reste dans le monde ISOLATED (par défaut) pour accéder au ThemeManager de l'extension
    api.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
            // Ici, window est l'objet global du monde ISOLATED
            const themeMgr = window.ThemeManager;
            
            if (!themeMgr) {
                return { isAria: false };
            }

            return { 
                isAria: true, 
                themes: Object.keys(themeMgr.config?.themeList || {}), 
                currentTheme: themeMgr.activeName 
            };
        }
    }, (results) => {
        if (!results || !results[0]?.result) return;
        
        const data = results[0].result;
        const indicator = document.getElementById('statusIndicator');
        const themeSection = document.getElementById('themeSection');
        const themeSelect = document.getElementById('themeSelect');

        if (data.isAria) {
            indicator.textContent = "AriaML (Mode Isolé)";
            indicator.className = "status is-aria";
            
            if (data.themes.length > 0) {
                themeSection.classList.remove('hidden');
                themeSelect.innerHTML = ''; 

                data.themes.forEach(theme => {
                    const opt = document.createElement('option');
                    opt.value = theme;
                    opt.textContent = theme.charAt(0).toUpperCase() + theme.slice(1);
                    if (theme === data.currentTheme) opt.selected = true;
                    themeSelect.appendChild(opt);
                });

                themeSelect.onchange = (e) => {
                    changeThemeInTab(tab.id, e.target.value);
                };
            }
        } else {
            indicator.textContent = "AriaML non détecté dans ce contexte";
            indicator.className = "status not-aria";
            themeSection.classList.add('hidden');
        }
    });
}

/**
 * Commande au ThemeManager du monde ISOLATED de changer le thème.
 */
function changeThemeInTab(tabId, themeName) {
    api.scripting.executeScript({
        target: { tabId: tabId },
        func: (name) => {
            if (window.ThemeManager) {
                window.ThemeManager.setTheme(name);
            }
        },
        args: [themeName]
    });
}

document.addEventListener('DOMContentLoaded', initPopup);
