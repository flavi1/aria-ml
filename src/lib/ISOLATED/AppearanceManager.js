/* AppearanceManager.js (v1.6.6)
 * - Gestion du cycle de vie par injection/retrait du contenu @import.
 * - Support exclusif des balises <style>.
 * - Neutralisation réelle des ressources hors-contexte.
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

            // 1. Détection du thème automatique (Media Queries)
            if (!window.ThemeManager?.activeName) {
                for (const s of styleNodes) {
                    const { theme } = this.getThemeContext(s);
                    const media = s.getAttribute('media');
                    if (theme && media && window.matchMedia(media).matches) {
                        this._currentAutoTheme = theme;
                        autoThemeFound = true;
                        break;
                    }
                }
                if (!autoThemeFound) this._currentAutoTheme = null;
            }

            // 2. Traitement des ressources
            for (const s of styleNodes) {
                const { theme, conflict } = this.getThemeContext(s);
                const type = s.getAttribute('type') || 'text/css';
                const isJson = this.JSON_TYPES.VOLATILE.includes(type) || this.JSON_TYPES.ICONS.includes(type);
                
                if (conflict) {
                    this.applyStyle(s, false, isJson);
                    console.warn("AriaML: Confusion de thème sur", s);
                    continue;
                }

                const mediaAttr = s.getAttribute('media');
                const matchesMedia = !mediaAttr || window.matchMedia(mediaAttr).matches;
                
                let shouldApply = true;
                if (theme) {
                    const isForced = window.ThemeManager?.activeName === theme;
                    const isAuto = !window.ThemeManager?.activeName && theme === this._currentAutoTheme;
                    shouldApply = (isForced || isAuto) && matchesMedia;
                } else {
                    shouldApply = matchesMedia;
                }

                // Préchargement si SRC est présent
                if (s.hasAttribute('src') && s.hasAttribute('preload')) {
                    this.ensurePreload(s.getAttribute('src'), isJson ? 'fetch' : 'style');
                }

                // Application selon le type
                if (this.JSON_TYPES.VOLATILE.includes(type)) {
                    await this.handleVolatiles(s, shouldApply);
                    this.applyStyle(s, shouldApply, true);
                } else if (this.JSON_TYPES.ICONS.includes(type)) {
                    if (shouldApply) await this.handleIcons(s);
                    this.applyStyle(s, shouldApply, true);
                } else {
                    this.applyStyle(s, shouldApply, false);
                }
            }

            this.syncSystemParams(root);
            this.isUpdating = false;
        },

        applyStyle: function(s, active, isJson = false) {
            // Pour le CSS, on joue sur le textContent pour activer/désactiver
            if (!isJson && s.hasAttribute('src')) {
                const importRule = `@import url("${s.getAttribute('src')}");`;
                if (active) {
                    if (s.textContent !== importRule) s.textContent = importRule;
                } else {
                    if (s.textContent !== "") s.textContent = "";
                }
            }

            // Synchronisation de l'attribut pour le debug (même si l'effet CSS est géré par le contenu)
            if (!active) {
                s.setAttribute('disabled', 'disabled');
                s.disabled = true;
            } else {
                s.removeAttribute('disabled');
                s.disabled = false;
            }
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

        ensurePreload: function(href, asType) {
            if (!document.head.querySelector(`link[rel="preload"][href="${href}"]`)) {
                const l = document.createElement('link');
                l.rel = 'preload'; 
                l.as = asType; 
                l.href = href;
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
        const isSSR = document.head.hasAttribute('data-ssr');
        if (target) {
            new MutationObserver(() => AppearanceManager.render()).observe(target, { 
                childList: true, subtree: true, attributes: true, 
                attributeFilter: ['theme', 'media', 'src'] 
            });
            if (!isSSR || target.tagName === 'ARIA-ML-FRAGMENT') {
                AppearanceManager.render();
            }
        }
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
