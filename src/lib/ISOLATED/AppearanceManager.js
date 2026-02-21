/**
 * AppearanceManager.js
 * Synchronisation réactive AriaML (v1.6.3)
 * Gère le rendu, le nettoyage des classes volatiles et la synchro système.
 */
(function() {
    const AppearanceManager = {
        isUpdating: false,
        _jsonCache: new Map(), // Cache pour les ressources distantes (fetch)
        
        JSON_TYPES: {
            VOLATILE: ['volatile-classes+json', 'application/volatile-classes+json'],
            ICONS: ['icons+json', 'application/icons+json']
        },

        /**
         * Point d'entrée principal du rendu.
         * Appelé par le ThemeManager ou par l'Observer.
         */
        render: async function() {
            if (this.isUpdating) return;
            this.isUpdating = true;

            const root = document.querySelector('aria-ml');
            if (!root) {
                this.isUpdating = false;
                return;
            }

            const activeTheme = window.ThemeManager?.activeName;
            const styleNodes = Array.from(root.querySelectorAll('style'));

            for (const s of styleNodes) {
                const { theme, conflict } = this.getThemeContext(s);
                
                // 1. Arbitrage des conflits de thèmes (Confinement)
                if (conflict) {
                    s.disabled = true;
                    console.warn("AriaML: Confusion de thème sur", s);
                    continue;
                }

                // 2. Évaluation des conditions d'activation
                const themeActive = !theme || theme === activeTheme;
                const mediaAttr = s.getAttribute('media');
                const mediaActive = !mediaAttr || window.matchMedia(mediaAttr).matches;
                const shouldApply = themeActive && mediaActive;

                // 3. Gestion du Preload
                if (s.hasAttribute('src') && s.hasAttribute('preload')) {
                    this.ensurePreload(s.getAttribute('src'));
                }

                const type = s.getAttribute('type') || 'text/css';

                // 4. Dispatch selon le type de ressource
                if (this.JSON_TYPES.VOLATILE.includes(type)) {
                    await this.handleVolatiles(s, shouldApply);
                } 
                else if (this.JSON_TYPES.ICONS.includes(type)) {
                    if (shouldApply) await this.handleIcons(s);
                } 
                else {
                    this.applyStyle(s, shouldApply);
                }
            }

            // 5. Mise à jour des paramètres du navigateur (Viewport, Browser Color)
            this.syncSystemParams(root);
            
            this.isUpdating = false;
        },

        /**
         * Gère les utility classes volatiles.
         * Nettoie les classes si shouldApply est false (idempotence).
         */
        handleVolatiles: async function(s, shouldApply) {
            const data = await this.getJsonContent(s);
            if (!data) return;

            const action = shouldApply ? 'add' : 'remove';
            
            Object.entries(data).forEach(([selector, classes]) => {
                const targets = document.querySelectorAll(selector);
                const classList = Array.isArray(classes) ? classes : classes.split(/\s+/);
                const cleanList = classList.map(c => c.trim()).filter(c => c);

                if (cleanList.length > 0) {
                    targets.forEach(t => t.classList[action](...cleanList));
                }
            });
        },

        /**
         * Synchronise les icônes dans le <head>. 
         * Réutilise les balises existantes (compatibilité HTML côté serveur).
         */
        handleIcons: async function(s) {
            const data = await this.getJsonContent(s);
            if (!data) return;

            Object.entries(data).forEach(([rel, href]) => {
                let link = document.head.querySelector(`link[rel="${rel}"]`);
                if (!link) {
                    link = document.createElement('link');
                    link.rel = rel;
                    document.head.appendChild(link);
                }
                if (link.getAttribute('href') !== href) {
                    link.href = href;
                }
            });
        },

        /**
         * Résout le thème en remontant jusqu'à <aria-ml>.
         */
        getThemeContext: function(el) {
            let theme = el.getAttribute('theme');
            let conflict = false;
            let current = el.parentElement;

            while (current && current.tagName.toLowerCase() !== 'aria-ml') {
                const pTheme = current.getAttribute('theme');
                if (pTheme) {
                    if (theme && theme !== pTheme) conflict = true;
                    theme = pTheme;
                }
                current = current.parentElement;
            }
            return { theme, conflict };
        },

        /**
         * Applique le CSS et gère le polyfill @import pour l'attribut src.
         */
        applyStyle: function(s, active) {
            if (s.hasAttribute('src') && !s.textContent.includes('@import')) {
                s.textContent = `@import url("${s.getAttribute('src')}?v=${Date.now()}");`;
            }
            if (s.disabled !== !active) {
                s.disabled = !active;
            }
        },

        /**
         * Récupère le JSON avec système de cache pour les sources externes.
         */
        async getJsonContent(s) {
            if (s.hasAttribute('src')) {
                const url = s.getAttribute('src');
                if (this._jsonCache.has(url)) return this._jsonCache.get(url);

                try {
                    const r = await fetch(url);
                    const data = await r.json();
                    this._jsonCache.set(url, data);
                    return data;
                } catch(e) { 
                    console.error("AriaML: Fetch JSON error", url, e);
                    return null; 
                }
            }
            try { return JSON.parse(s.textContent); } catch(e) { return null; }
        },

        /**
         * Injecte une balise de preload dans le head.
         */
        ensurePreload: function(href) {
            if (!document.head.querySelector(`link[rel="preload"][href="${href}"]`)) {
                const l = document.createElement('link');
                l.rel = 'preload'; 
                l.as = 'style'; 
                l.href = href;
                document.head.appendChild(l);
            }
        },

        /**
         * Extrait les variables CSS pour piloter l'interface du navigateur.
         */
        syncSystemParams: function(root) {
            const style = getComputedStyle(root);
            const mapping = { 
                '--browser-color': 'theme-color', 
                '--viewport': 'viewport' 
            };

            Object.entries(mapping).forEach(([variable, metaName]) => {
                const val = style.getPropertyValue(variable).trim().replace(/['"]/g, '');
                if (val) {
                    let meta = document.head.querySelector(`meta[name="${metaName}"]`);
                    if (!meta) {
                        meta = document.createElement('meta');
                        meta.name = metaName;
                        document.head.appendChild(meta);
                    }
                    if (meta.getAttribute('content') !== val) {
                        meta.content = val;
                    }
                }
            });
        }
    };

    window.AppearanceManager = AppearanceManager;

    const init = () => {
        const target = document.querySelector('aria-ml');
        if (target) {
            const observer = new MutationObserver(() => AppearanceManager.render());
            observer.observe(target, { 
                childList: true, 
                subtree: true, 
                attributes: true, 
                attributeFilter: ['theme', 'media', 'src'] 
            });
            AppearanceManager.render();
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
