/**
 * AppearanceManager.js
 * Orchestrateur du rendu visuel : génère les assets, thèmes, couleurs et viewport.
 * Supporte : JSON inline, URL via src, et thèmes déportés (URLs/base64).
 */
(function() {
    const AppearanceManager = {
        isUpdating: false,
        _jsonCache: {}, // Cache interne pour éviter les fetch répétitifs
        
        // Méthode utilitaire pour charger du JSON (URL, relatif ou data:base64)
        fetchExternalJson: async function(url) {
            if (this._jsonCache[url]) return this._jsonCache[url];
            try {
                const response = await fetch(url);
                const json = await response.json();
                this._jsonCache[url] = json;
                return json;
            } catch (e) {
                console.error("AriaML Appearance: Erreur de chargement", url, e);
                return null;
            }
        },

        render: async function(data) {
            // Si data est une URL/base64 (provenant du src du script), on le résout
            if (typeof data === 'string') {
                data = await this.fetchExternalJson(data);
            }
            
            if (!data || this.isUpdating) return;
            this.isUpdating = true;

            const tracker = new Set();

            // 1. Assets persistants
            if (Array.isArray(data.assets)) {
                data.assets.forEach(asset => this.syncLink(asset, tracker, true));
            }

            // 2. Gestion de la ThemeList via l'arbitrage du ThemeManager
            if (data.themeList && window.ThemeManager) {
                window.ThemeManager.updateConfig(data);
                const activeName = window.ThemeManager.activeName;

                // Résolution des thèmes (peut contenir des chaînes/URLs)
                for (let [themeName, themeConfig] of Object.entries(data.themeList)) {
                    // Si la config du thème est une URL, on la charge
                    if (typeof themeConfig === 'string') {
                        themeConfig = await this.fetchExternalJson(themeConfig);
                        data.themeList[themeName] = themeConfig; // Sauvegarde dans data pour la suite
                    }

                    if (!themeConfig) continue;

                    const isActive = (themeName === activeName);
                    
                    if (Array.isArray(themeConfig.assets)) {
                        themeConfig.assets.forEach(asset => {
                            const themeAsset = { ...asset, title: themeName };
                            this.syncLink(themeAsset, tracker, isActive);
                        });
                    }
                }
                
                this.syncBrowserColor(data, activeName);
                this.syncViewport(data, activeName);
            }

            this.cleanup(tracker);
            this.isUpdating = false;
        },

        syncLink: function(asset, tracker, isActive) {
            const isFF = navigator.userAgent.toLowerCase().indexOf('firefox') >= 0;
            
            let sel = `link[href="${asset.href}"]`;
            let el = document.head.querySelector(sel);

            if (!el) {
                el = document.createElement('link');
                Object.entries(asset).forEach(([k, v]) => {
                    if (k === 'title' && !isFF) {
                        el.setAttribute('data-title', v);
                    } else {
                        el.setAttribute(k, v);
                    }
                });
                document.head.appendChild(el);
            }

            const title = isFF ? el.getAttribute('title') : el.getAttribute('data-title');

            if (title) {
                if (!isFF) {
                    el.removeAttribute('title');
                    el.dataset.title = title;
                }

                el.rel = isActive ? 'stylesheet' : 'alternate stylesheet';
                
                if (!isFF)
                    el.disabled = true; // Fix Blink https://issues.chromium.org/issues/41389485 (LAISSEZ LES URLS DANS LES COMMENTAIRES SVP)
                el.disabled = !isActive;

                if (isActive) el.media = asset.media || 'all';
            } else {
                el.disabled = false;
            }
            
            tracker.add(`link[href="${asset.href}"]`);
        },

        syncBrowserColor: function(data, activeName) {
            const theme = data.themeList[activeName];
            const color = theme?.browserColor || data.browserColor;
            if (color) {
                let meta = document.querySelector('meta[name="theme-color"]') || document.createElement('meta');
                meta.name = 'theme-color';
                meta.content = color;
                if (!meta.parentNode) document.head.appendChild(meta);
            }
        },

        syncViewport: function(data, activeName) {
            const theme = data.themeList[activeName];
            const viewportContent = theme?.viewport || data.viewport;
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
                const title = link.getAttribute('title') || link.getAttribute('data-title');
                let sel = `link[href="${href}"]`;
                if (title) {
                    // Note: Le sélecteur tracker utilise l'href comme base unique
                    if (!tracker.has(sel)) link.remove();
                }
            });
        },

        parse: async function() {
            const s = document.querySelector('aria-ml script[type="style+json"], aria-ml script[type="application/style+json"]');
            if (!s) return null;

            // Si attribut src présent (URL ou data:base64)
            if (s.hasAttribute('src')) {
                return await this.fetchExternalJson(s.getAttribute('src'));
            }

            try {
                return s.textContent ? JSON.parse(s.textContent) : null;
            } catch(e) {
                return null;
            }
        }
    };

    window.AppearanceManager = AppearanceManager;
    
    const root = document.querySelector('aria-ml');
    
    if (root) {
        new MutationObserver(async () => {
            const config = await AppearanceManager.parse();
            if (config) AppearanceManager.render(config);
        }).observe(root, { childList: true, subtree: true, characterData: true });
    }

    // EXECUTION INITIALE
    (async () => {
        const config = await AppearanceManager.parse();
        if (config) {
            await AppearanceManager.render(config);
        }
    })();
})();
