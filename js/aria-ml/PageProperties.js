/**
 * AriaML PageProperties.js
 * Gère la sémantique, les métadonnées et la synchronisation du document.
 * Focalisé sur le SEO et l'accessibilité (Landmarks).
 */
(function() {
    const isSSR = document.head.hasAttribute('data-ssr');
    if (document.currentScript) document.currentScript.remove();

    const AriaML = {
        isUpdating: false,
        lastDataHash: '',
        createdSelectors: new Set(),

        /**
         * Orchestre la mise à jour des éléments du HEAD et des attributs racines.
         */
        render: function(data) {
            if (!data || this.isUpdating) return;

            const currentHash = JSON.stringify(data);
            if (this.lastDataHash === currentHash) return;
            this.lastDataHash = currentHash;

            this.isUpdating = true;
            const rootAria = document.querySelector('aria-ml');
            const currentTurnSelectors = new Set();
            
            // Style de base persistant pour le moteur de slots
            this.ensureDefaultStyle();

            // 1. Synchronisation des attributs racines (lang, dir, class...)
            if (rootAria) {
                this.syncRootAttributes(rootAria, data);
            }

            // 2. Head : Canonical, Titre et Metadatas SEO
            this.syncHead(data, currentTurnSelectors);

            // 3. Nettoyage des balises HEAD obsolètes (non présentes dans le nouveau flux)
            this.cleanupHead(currentTurnSelectors);

            this.isUpdating = false;
        },

        /**
         * Recherche exhaustive du premier objet @type: PageProperties 
         * à travers TOUS les scripts JSON-LD de l'élément racine.
         */
        parse: function() {
            const scripts = document.querySelectorAll('aria-ml script[type="application/ld+json"]');
            for (const s of scripts) {
                try {
                    const j = JSON.parse(s.textContent);
                    const list = Array.isArray(j) ? j : [j];
                    const found = list.find(i => i["@type"] === "PageProperties");
                    if (found) return found;
                } catch (e) { 
                    console.warn("AriaML: Invalid JSON-LD block encountered.");
                    continue; 
                }
            }
            return null;
        },

        ensureDefaultStyle: function() {
            if (!document.head.querySelector('#ariaml-default-style')) {
                const style = document.createElement('style');
                style.id = 'ariaml-default-style';
                style.innerHTML = `
:not(aria-ml) > [slot] { display: none !important; }
html, body { margin: 0; padding: 0; height: 100%; }
aria-ml { display: block; min-height: 100%; padding: 8px; box-sizing: border-box; }`;
                document.head.prepend(style);
            }
        },

        syncRootAttributes: function(rootAria, data) {
            const rootProps = { 'lang': data.lang, 'dir': data.dir, 'translate': data.translate, 'prefix': data.prefix };
            Object.entries(rootProps).forEach(([k, v]) => {
                if (v && rootAria.getAttribute(k) !== v) rootAria.setAttribute(k, v);
            });

            Array.from(rootAria.attributes).forEach(attr => {
                if (attr.name === 'csp') {
                    this.syncMeta(null, 'Content-Security-Policy', attr.value, new Set(), true);
                } else if (attr.name === 'class') {
                    attr.value.split(/\s+/).forEach(cls => {
                        if (cls && !document.documentElement.classList.contains(cls)) {
                            document.documentElement.classList.add(cls);
                        }
                    });
                } else if (document.documentElement.getAttribute(attr.name) !== attr.value) {
                    document.documentElement.setAttribute(attr.name, attr.value);
                }
            });
        },

        syncHead: function(data, tracker) {
            if (data.canonical) this.syncLink('canonical', data.canonical, {}, tracker);
            
            if (data.metadatas) {
                data.metadatas.forEach(meta => {
                    const names = [].concat(meta.name || []);
                    const props = [].concat(meta.property || []);
                    
                    if (names.includes('title')) document.title = meta.content;
                    
                    names.forEach(n => this.syncMeta('name', n, meta.content, tracker));
                    props.forEach(p => this.syncMeta('property', p, meta.content, tracker));
                });
            }
        },

        cleanupHead: function(tracker) {
            this.createdSelectors.forEach(sel => {
                if (!tracker.has(sel)) {
                    const el = document.head.querySelector(sel);
                    if (el) el.remove();
                }
            });
            this.createdSelectors = tracker;
        },

        syncMeta: function(attr, val, content, tracker, isEquiv = false) {
            const key = isEquiv ? 'http-equiv' : attr;
            const sel = `meta[${key}="${val}"]`;
            if (tracker) tracker.add(sel);
            
            let el = document.head.querySelector(sel);
            if (!el) {
                el = document.createElement('meta');
                el.setAttribute(key, val);
                document.head.appendChild(el);
            }
            if (el.content !== content) el.content = content;
        },

        syncLink: function(rel, href, attrs, tracker) {
            let sel = `link[rel="${rel}"][href="${href}"]`;
            if (attrs.title) sel += `[title="${attrs.title}"]`;
            tracker.add(sel);

            let el = document.head.querySelector(sel);
            if (!el) {
                el = document.createElement('link');
                el.rel = rel; 
                el.href = href;
                document.head.appendChild(el);
            }
            Object.entries(attrs).forEach(([k, v]) => {
                if (!['rel', 'href'].includes(k) && el.getAttribute(k) !== v) el.setAttribute(k, v);
            });
        }
    };

    // --- Proxy Réactif pour l'API window.PageProperties ---

    function createDeepProxy(obj, onChange) {
        return new Proxy(obj, {
            get(target, prop) {
                const value = Reflect.get(target, prop);
                return (value && typeof value === 'object') ? createDeepProxy(value, onChange) : value;
            },
            set(target, prop, value) {
                const res = Reflect.set(target, prop, value);
                document.dispatchEvent(new CustomEvent('ariaml:updated', { detail: { prop, value } }));
                onChange();
                return res;
            }
        });
    }

    window.PageProperties = createDeepProxy({}, () => {
        if (!AriaML.isUpdating) AriaML.render(window.PageProperties);
    });

    // --- Observation et Initialisation ---

    const root = document.querySelector('aria-ml');
    if (root) {
        // Surveille les mutations du DOM (notamment les injections de scripts via Navigation.js)
        new MutationObserver(() => {
            const data = AriaML.parse();
            if (data) {
                AriaML.isUpdating = true;
                Object.assign(window.PageProperties, data);
                AriaML.isUpdating = false;
                AriaML.render(window.PageProperties);
            }
        }).observe(root, { childList: true, subtree: true, characterData: true });
    }

    const initData = AriaML.parse();
    if (initData) {
        AriaML.isUpdating = true;
        Object.assign(window.PageProperties, initData);
        AriaML.isUpdating = false;
        if (!isSSR) AriaML.render(window.PageProperties);
        else AriaML.lastDataHash = JSON.stringify(initData);
    }
})();
