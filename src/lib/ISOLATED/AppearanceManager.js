/**
 * AppearanceManager.js
 * Moteur de rendu AriaML (v1.6.3)
 * Gère les groupements thématiques, les classes volatiles et le cache.
 */
(function() {
    const AppearanceManager = {
        isUpdating: false,
        _jsonCache: new Map(),
        
        JSON_TYPES: {
            VOLATILE: ['volatile-classes+json', 'application/volatile-classes+json'],
            ICONS: ['icons+json', 'application/icons+json']
        },

        render: async function() {
            if (this.isUpdating) return;
            this.isUpdating = true;

            const root = document.querySelector('aria-ml');
            if (!root) { this.isUpdating = false; return; }

            const styleNodes = Array.from(root.querySelectorAll('style'));
            let autoThemeFound = false;

            // Premier passage pour identifier le thème automatique si nécessaire
            // (Seulement si ThemeManager n'a pas de thème forcé)
            if (!window.ThemeManager?.activeName) {
                for (const s of styleNodes) {
                    const { theme } = this.getThemeContext(s);
                    const media = s.getAttribute('media');
                    if (theme && media && window.matchMedia(media).matches) {
                        // On enregistre le premier thème qui matche pour le cycle actuel
                        this._currentAutoTheme = theme;
                        autoThemeFound = true;
                        break;
                    }
                }
                if (!autoThemeFound) this._currentAutoTheme = null;
            }

            for (const s of styleNodes) {
                const { theme, conflict } = this.getThemeContext(s);
                
                if (conflict) {
                    s.disabled = true;
                    console.warn("AriaML: Confusion de thème sur", s);
                    continue;
                }

                const mediaAttr = s.getAttribute('media');
                const matchesMedia = !mediaAttr || window.matchMedia(mediaAttr).matches;
                
                // Logique AriaML : Est-ce que cette ressource doit s'appliquer ?
                let shouldApply = true;
                if (theme) {
                    const isForced = window.ThemeManager?.activeName === theme;
                    const isAuto = !window.ThemeManager?.activeName && theme === this._currentAutoTheme;
                    shouldApply = (isForced || isAuto) && matchesMedia;
                } else {
                    // Ressource hors thème (neutre)
                    shouldApply = matchesMedia;
                }

                if (s.hasAttribute('src') && s.hasAttribute('preload')) {
                    this.ensurePreload(s.getAttribute('src'));
                }

                const type = s.getAttribute('type') || 'text/css';

                if (this.JSON_TYPES.VOLATILE.includes(type)) {
                    await this.handleVolatiles(s, shouldApply);
                } else if (this.JSON_TYPES.ICONS.includes(type)) {
                    if (shouldApply) await this.handleIcons(s);
                } else {
                    this.applyStyle(s, shouldApply);
                }
            }

            this.syncSystemParams(root);
            this.isUpdating = false;
        },

        handleVolatiles: async function(s, shouldApply) {
            const data = await this.getJsonContent(s);
            if (!data) return;
            const action = shouldApply ? 'add' : 'remove';
            
            Object.entries(data).forEach(([selector, classes]) => {
                const targets = document.querySelectorAll(selector);
                const classList = (Array.isArray(classes) ? classes : classes.split(/\s+/))
                                   .map(c => c.trim()).filter(c => c);

                if (classList.length > 0) {
                    targets.forEach(t => t.classList[action](...classList));
                }
            });
        },

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
                if (link.getAttribute('href') !== href) link.href = href;
            });
        },

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

        applyStyle: function(s, active) {
            if (s.hasAttribute('src') && !s.textContent.includes('@import')) {
                s.textContent = `@import url("${s.getAttribute('src')}");`;
            }
            if (s.disabled !== !active) s.disabled = !active;
        },

        async getJsonContent(s) {
            if (s.hasAttribute('src')) {
                const url = s.getAttribute('src');
                if (this._jsonCache.has(url)) return this._jsonCache.get(url);
                try {
                    const r = await fetch(url);
                    const data = await r.json();
                    this._jsonCache.set(url, data);
                    return data;
                } catch(e) { return null; }
            }
            try { return JSON.parse(s.textContent); } catch(e) { return null; }
        },

        ensurePreload: function(href) {
            if (!document.head.querySelector(`link[rel="preload"][href="${href}"]`)) {
                const l = document.createElement('link');
                l.rel = 'preload'; l.as = 'style'; l.href = href;
                document.head.appendChild(l);
            }
        },

        syncSystemParams: function(root) {
            const style = getComputedStyle(root);
            const mapping = { '--browser-color': 'theme-color', '--viewport': 'viewport' };
            Object.entries(mapping).forEach(([variable, metaName]) => {
                const val = style.getPropertyValue(variable).trim().replace(/['"]/g, '');
                if (val) {
                    let meta = document.head.querySelector(`meta[name="${metaName}"]`) 
                               || document.createElement('meta');
                    meta.name = metaName;
                    if (meta.getAttribute('content') !== val) {
                        meta.content = val;
                        if (!meta.parentNode) document.head.appendChild(meta);
                    }
                }
            });
        }
    };

    window.AppearanceManager = AppearanceManager;

    const init = () => {
        const target = document.querySelector('aria-ml');
        if (target) {
            new MutationObserver(() => AppearanceManager.render()).observe(target, { 
                childList: true, subtree: true, attributes: true, 
                attributeFilter: ['theme', 'media', 'src'] 
            });
            AppearanceManager.render();
        }
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
