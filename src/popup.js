 
async function initPopup() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Injection d'un script pour analyser la page
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
            const ariaNode = document.querySelector('aria-ml');
            if (!ariaNode) return { isAria: false };

            // Extraction de la config via le script appearance
            const appearanceScript = ariaNode.querySelector('script[type="application/appearance+json"]');
            let themes = [];
            let currentTheme = "";

            if (appearanceScript) {
                const config = JSON.parse(appearanceScript.textContent);
                themes = Object.keys(config.themeList || {});
                currentTheme = config.defaultTheme;
            }

            return { isAria: true, themes, currentTheme };
        }
    }, (results) => {
        const data = results[0].result;
        const indicator = document.getElementById('statusIndicator');
        const themeSection = document.getElementById('themeSection');
        const themeSelect = document.getElementById('themeSelect');

        if (data.isAria) {
            indicator.textContent = "Document AriaML détecté";
            indicator.className = "status is-aria";

            if (data.themes && data.themes.length > 0) {
                themeSection.classList.remove('hidden');
                data.themes.forEach(theme => {
                    const opt = document.createElement('option');
                    opt.value = theme;
                    opt.textContent = theme.charAt(0).toUpperCase() + theme.slice(1);
                    if (theme === data.currentTheme) opt.selected = true;
                    themeSelect.appendChild(opt);
                });

                // Listener pour changer le thème
                themeSelect.addEventListener('change', (e) => {
                    changeThemeInTab(tab.id, e.target.value);
                });
            }
        } else {
            indicator.textContent = "Non AriaML";
            indicator.className = "status not-aria";
        }
    });
}

function changeThemeInTab(tabId, themeName) {
    chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: (name) => {
            // On simule le changement via les alternate stylesheets
            // (Le moteur AriaML gère cela nativement si on change l'attribut ou via Navigation.js)
            const links = document.querySelectorAll('link[rel*="stylesheet"][title]');
            links.forEach(link => {
                link.disabled = (link.title !== name);
            });
            
            // On peut aussi notifier le moteur si nécessaire
            document.dispatchEvent(new CustomEvent('ariaml.themechange', { detail: { theme: name } }));
        },
        args: [themeName]
    });
}

initPopup();
