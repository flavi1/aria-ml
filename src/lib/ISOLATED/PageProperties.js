/**
 * AriaML PageProperties.ISOLATED.js (Optimisé)
 * Renderer : Synchronise le HEAD avec Fallbacks SEO (s:name, s:description).
 */
(function() {
    const isSSR = document.head.hasAttribute('data-ssr');
    
    const AriaMLRenderer = {
        isUpdating: false,
        lastDataHash: '',
        createdSelectors: new Set(),

        render: function() {
            if (this.isUpdating) return;
            const data = this.parse();
            if (!data) return;

            const currentHash = JSON.stringify(data);
            if (this.lastDataHash === currentHash) return;
            this.lastDataHash = currentHash;

            this.isUpdating = true;
            const rootAria = document.querySelector('aria-ml');
            const currentTurnSelectors = new Set();

            if (rootAria) this.syncRootAttributes(rootAria, data);
            this.syncHead(data, currentTurnSelectors);
            this.cleanupHead(currentTurnSelectors);

            this.isUpdating = false;
        },

        parse: function() {
            const scripts = document.querySelectorAll('aria-ml script[type="application/ld+json"], aria-ml script[type="ld+json"]');
            for (const s of scripts) {
                try {
                    const j = JSON.parse(s.textContent);
                    const found = (Array.isArray(j) ? j : [j]).find(i => i["@type"] === "PageProperties");
                    if (found) return found;
                } catch (e) { continue; }
            }
            return null;
        },

        syncRootAttributes: function(rootAria, data) {
            const rootProps = { 'lang': data.lang, 'dir': data.dir};
            Object.entries(rootProps).forEach(([k, v]) => {
                if (v && rootAria.getAttribute(k) !== v) {
                    rootAria.setAttribute(k, v);
                }
            });
            const csp = rootAria.getAttribute('csp');
            if (csp) this.syncMeta(null, 'Content-Security-Policy', csp, new Set(), true);
        },

        syncHead: function(data, tracker) {
            // --- 1. Singletons & Bridge SEO (name, description, canonical) ---
            const pageTitle = data.name || (data.metadatas?.title?.content || data.metadatas?.title);
            if (pageTitle) {
                let titleEl = document.querySelector('title');
                if (!titleEl) {
                    titleEl = document.createElement('title');
                    document.head.appendChild(titleEl);
                }
                if (titleEl.textContent !== pageTitle) titleEl.textContent = pageTitle;
            }

            const pageDesc = data.description || (data.metadatas?.description?.content || data.metadatas?.description);
            if (pageDesc) this.syncMeta('name', 'description', pageDesc, tracker);

            const singletons = ['canonical', 'me', 'shortlink', 'manifest', 'author', 'license'];
            singletons.forEach(rel => {
                const val = (rel === 'canonical' && data.canonical) ? data.canonical : data[rel];
                if (val) this.syncLink(rel, val, {}, tracker);
            });

            if (data['csrf-token']) this.syncMeta('name', 'csrf-token', data['csrf-token'], tracker);
            if (data['last-modified']) this.syncMeta('name', 'last-modified', data['last-modified'], tracker);
            
            // --- 2. Metadatas classiques AriaML (Index-based) ---
            if (data.metadatas) {
                Object.entries(data.metadatas).forEach(([indexKey, meta]) => {
                    if (indexKey === 'title' || indexKey === 'description') return; // Déjà géré par les fallbacks
                    
                    const isString = typeof meta === 'string';
                    const content = isString ? meta : (meta.content || "");
                    let names = (!isString && meta.name) ? [].concat(meta.name) : [];
                    if (!names.includes(indexKey)) names.unshift(indexKey);

                    let props = (!isString && meta.property) ? [].concat(meta.property) : [];
                    names.forEach(n => this.syncMeta('name', n, content, tracker));
                    props.forEach(p => this.syncMeta('property', p, content, tracker));
                });
            }

            // --- 3. Alternates & Translations (s:workTranslation) ---
            const allAlternates = (data.alternates || []).concat(data.translations || []);
            allAlternates.forEach(alt => {
                const rel = alt.rel ? `alternate ${alt.rel}` : 'alternate';
                this.syncLink(rel, alt.href, alt, tracker);
            });

            // --- 4. Links (Internal REST / Navigation) ---
            if (Array.isArray(data.links)) {
                data.links.forEach(l => this.syncLink(l.rel, l.href, l, tracker));
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
            if (attrs.type) sel += `[type="${attrs.type}"]`;
            if (attrs.hreflang) sel += `[hreflang="${attrs.hreflang}"]`;
            
            tracker.add(sel);
            let el = document.head.querySelector(sel);
            if (!el) {
                el = document.createElement('link');
                el.rel = rel; el.href = href;
                document.head.appendChild(el);
            }
            Object.entries(attrs).forEach(([k, v]) => {
                if (!['rel', 'href'].includes(k) && el.getAttribute(k) !== v) el.setAttribute(k, v);
            });
        }
    };

    const setupObservation = () => {
        const root = document.querySelector('aria-ml');
        if (!root) return;
        const structureObserver = new MutationObserver((mutations) => {
            let needsCheck = false;
            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (node.nodeName === 'SCRIPT' && (node.type === 'application/ld+json' || node.type === 'ld+json')) {
                        needsCheck = true;
                        contentObserver.observe(node, { characterData: true, childList: true });
                    }
                }
            }
            if (needsCheck) AriaMLRenderer.render();
        });
        const contentObserver = new MutationObserver(() => AriaMLRenderer.render());
        const existingScripts = root.querySelectorAll('script[type="application/ld+json"], script[type="ld+json"]');
        existingScripts.forEach(s => contentObserver.observe(s, { characterData: true, childList: true }));
        structureObserver.observe(root, { childList: true, subtree: true });
    };

    document.addEventListener('ariaml:updated', () => AriaMLRenderer.render());
    setupObservation();

    if (!isSSR) {
        AriaMLRenderer.render();
    } else {
        const data = AriaMLRenderer.parse();
        if (data) AriaMLRenderer.lastDataHash = JSON.stringify(data);
    }
})();
