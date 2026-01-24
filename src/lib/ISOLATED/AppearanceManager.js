/**
 * AppearanceManager.ISOLATED.js
 * Orchestrateur du rendu visuel : génère les assets, thèmes, couleurs et viewport.
 */
(function() {
    const AppearanceManager = {
        isUpdating: false,
        
        render: function(data) {
            if (!data || this.isUpdating) return;
            this.isUpdating = true;

            const tracker = new Set();

            // 1. Assets persistants
            if (Array.isArray(data.assets)) {
                data.assets.forEach(asset => this.syncLink(asset, tracker, true));
            }

            // 2. Gestion de la ThemeList via l'arbitrage du ThemeManager
            if (data.themeList && window.ThemeManager) {
                // Synchronisation de la config avec le manager de thème
                window.ThemeManager.updateConfig(data);
                const activeName = window.ThemeManager.activeName;

                Object.entries(data.themeList).forEach(([themeName, themeConfig]) => {
                    const isActive = (themeName === activeName);
                    
                    if (Array.isArray(themeConfig.assets)) {
                        themeConfig.assets.forEach(asset => {
                            const themeAsset = { ...asset, title: themeName };
                            this.syncLink(themeAsset, tracker, isActive);
                        });
                    }
                });
                
                this.syncBrowserColor(data, activeName);
                this.syncViewport(data, activeName);
            }

            this.cleanup(tracker);
            this.isUpdating = false;
        },

        syncLink: function(asset, tracker, isActive) {
            let sel = `link[href="${asset.href}"]`;
            if (asset.title) sel += `[title="${asset.title}"]`;
            tracker.add(sel);

            let el = document.head.querySelector(sel);
            if (!el) {
                el = document.createElement('link');
                Object.entries(asset).forEach(([k, v]) => el.setAttribute(k, v));
                document.head.appendChild(el);
            }

            if (asset.title) {
                // Force la mutation du rel et du mode disabled
                el.rel = isActive ? 'stylesheet' : 'alternate stylesheet';
                el.disabled = !isActive;
                // Hack pour certains navigateurs qui ne rafraîchissent pas le CSS alternate -> stylesheet
                if (isActive) el.media = asset.media || 'all';
            } else {
                el.disabled = false;
            }
        },

        syncBrowserColor: function(data, activeName) {
            const theme = data.themeList[activeName];
            const color = theme?.browserColor || data.defaultBrowserColor;
            if (color) {
                let meta = document.querySelector('meta[name="theme-color"]') || document.createElement('meta');
                meta.name = 'theme-color';
                meta.content = color;
                if (!meta.parentNode) document.head.appendChild(meta);
            }
        },

        syncViewport: function(data, activeName) {
            const theme = data.themeList[activeName];
            const viewportContent = theme?.viewport || data.defaultViewport;
            if (viewportContent) {
                let meta = document.querySelector('meta[name="viewport"]') || document.createElement('meta');
                meta.name = 'viewport';
                meta.content = viewportContent;
                if (!meta.parentNode) document.head.appendChild(meta);
            }
        },

        cleanup: function(tracker) {
            const links = document.head.querySelectorAll('link[rel*="stylesheet"], link[rel*="icon"]');
            links.forEach(link => {
                const href = link.getAttribute('href');
                const title = link.getAttribute('title');
                let sel = `link[href="${href}"]`;
                if (title) {
                    sel += `[title="${title}"]`;
                    if (!tracker.has(sel)) link.remove();
                }
            });
        },

        parse: function() {
            const s = document.querySelector('aria-ml script[type="application/appearance+json"]');
            try {
                return s ? JSON.parse(s.textContent) : null;
            } catch(e) {
                return null;
            }
        }
    };

    window.AppearanceManager = AppearanceManager;
    
    const root = document.querySelector('aria-ml');
    
    if (root) {
        new MutationObserver(() => AppearanceManager.render(AppearanceManager.parse()))
            .observe(root, { childList: true, subtree: true, characterData: true });
    }

    // EXECUTION INITIALE : Correction immédiate du rendu SSR si le thème stocké diffère
    const config = AppearanceManager.parse();

    if (config) {
        AppearanceManager.render(config);
    }
})();
