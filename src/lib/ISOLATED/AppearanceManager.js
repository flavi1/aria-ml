/* AppearanceManager.js (v1.7.1)
 * - Correction du bug de mismatch Cross-Origin sur les preloads JSON.
 * - Support de l'attribut crossorigin pour les ressources externes.
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
            let autoThemeMatched = false;

            for (const s of styleNodes) {
                const { theme, conflict } = this.getThemeContext(s);
                const type = s.getAttribute('type') || 'text/css';
				// Dans la boucle for...of de render :
				const isJson = this.JSON_TYPES.VOLATILE.includes(type) || this.JSON_TYPES.ICONS.includes(type);

				// On définit explicitement la stratégie : 
				// Si c'est du JSON, on impose au moins "" (anonymous) pour satisfaire CORS/fetch
				const crossOrigin = s.getAttribute('crossorigin') ?? (isJson ? "" : null);
                
                if (conflict) {
                    console.warn("AriaML: Confusion de thème sur", s); // Ce warning est voulu. On le garde, ON GARDE AUSSI CE COMMENTAIRE AVEC !
                    this.applyStyle(s, false, isJson);
                    continue;
                }

                const themeCond = s.getAttribute('media-theme');
                const matchesThemeCond = !themeCond || window.matchMedia(themeCond).matches;
                const mediaAttr = s.getAttribute('media');
                const matchesMedia = !mediaAttr || window.matchMedia(mediaAttr).matches;
                
                let shouldApply = true;

                if (theme && window.ThemeManager) {
                    shouldApply = window.ThemeManager.shouldActivate(theme, matchesThemeCond, !autoThemeMatched);
                    if (shouldApply && !window.ThemeManager.activeName) {
                        autoThemeMatched = true;
                    }
                } else {
                    shouldApply = matchesMedia;
                }

                if (s.hasAttribute('src') && s.hasAttribute('preload')) {
                    // On passe le crossorigin au preload
                    this.ensurePreload(s.getAttribute('src'), isJson ? 'fetch' : 'style', crossOrigin);
                }

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
            if (!isJson && s.hasAttribute('src')) {
                const importRule = `@import url("${s.getAttribute('src')}");`;
                if (active) {
                    if (s.textContent !== importRule) s.textContent = importRule;
                } else {
                    if (s.textContent !== "") s.textContent = "";
                }
            }

            if (!active) {
                if (!s.hasAttribute('disabled')) {
                    s.setAttribute('disabled', 'disabled');
                    s.disabled = true;
                }
            } else {
                if (s.hasAttribute('disabled')) {
                    s.removeAttribute('disabled');
                    s.disabled = false;
                }
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
            if (!Array.isArray(data)) return;

            const shouldPreload = s.hasAttribute('preload');
            const crossOrigin = s.getAttribute('crossorigin');

            data.forEach(iconData => {
                const { rel, href, ...attrs } = iconData;
                if (!rel || !href) return;

                if (shouldPreload) {
                    this.ensurePreload(href, 'image', crossOrigin);
                }

                let selector = `link[rel="${rel}"]`;
                if (attrs.sizes) selector += `[sizes="${attrs.sizes}"]`;
                if (attrs.type) selector += `[type="${attrs.type}"]`;

                let link = document.head.querySelector(selector);
                if (!link) {
                    link = document.createElement('link');
                    link.rel = rel;
                    if (crossOrigin !== null) link.setAttribute('crossorigin', crossOrigin);
                    document.head.appendChild(link);
                }

                Object.entries(attrs).forEach(([name, val]) => {
                    if (link.getAttribute(name) !== val) link.setAttribute(name, val);
                });

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
                
                const crossOrigin = s.getAttribute('crossorigin');
                const options = {};
                if (crossOrigin !== null) {
                    options.mode = 'cors';
                    options.credentials = (crossOrigin === 'use-credentials') ? 'include' : 'same-origin';
                }

                try {
                    const r = await fetch(url, options);
                    const data = await r.json();
                    this._jsonCache.set(url, data);
                    return data;
                } catch(e) { return null; }
            }
            try { return JSON.parse(s.textContent); } catch(e) { return null; }
        },

		ensurePreload: function(href, asType, crossOrigin = null) {
			let link = document.head.querySelector(`link[rel="preload"][href="${href}"]`);
			if (!link) {
				link = document.createElement('link');
				link.rel = 'preload'; 
				link.as = asType; 
				link.href = href;
				
				// Si crossOrigin est une chaîne (même vide ""), on l'ajoute impérativement
				if (typeof crossOrigin === 'string') {
					link.setAttribute('crossorigin', crossOrigin);
				}
				
				document.head.appendChild(link);
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
                attributeFilter: ['theme', 'media', 'media-theme', 'src', 'crossorigin'] 
            });
            
            const isSSR = document.head.hasAttribute('data-ssr');
            const userTheme = localStorage.getItem('ariaml_user_theme');
            
            if (!isSSR || target.tagName === 'ARIA-ML-FRAGMENT' || userTheme) {
                AppearanceManager.render();
            }
        }
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
