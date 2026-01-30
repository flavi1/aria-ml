/**
 * AriaML PageProperties.ISOLATED.js (Optimisé)
 * Renderer : Synchronise le HEAD à partir des balises scripts spécifiques.
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
            // Supporte LD+JSON et le format "json" DX-friendly
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

        // ... syncRootAttributes, syncHead, cleanupHead, syncMeta, syncLink restent identiques ...
        syncRootAttributes: function(rootAria, data) {
            const rootProps = { 'lang': data.lang, 'dir': data.dir, 'translate': data.translate };
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
			if (data['csrf-token']) {
				this.syncMeta('name', 'csrf-token', data['csrf-token'], tracker);
			}
			
			if (data.metadatas && typeof data.metadatas === 'object') {
				Object.entries(data.metadatas).forEach(([key, meta]) => {
					const content = meta.content;
					let names = meta.name ? [].concat(meta.name) : [key];
					let props = meta.property ? [].concat(meta.property) : [];

					// Gestion du Titre : Modification directe de la balise <title>
					if (names.includes('title')) {
						let titleEl = document.querySelector('title');
						if (!titleEl) {
							titleEl = document.createElement('title');
							document.head.appendChild(titleEl);
						}
						if (titleEl.textContent !== content) {
							titleEl.textContent = content;
						}
					}

					names.forEach(n => { this.syncMeta('name', n, content, tracker); });
					props.forEach(p => { this.syncMeta('property', p, content, tracker); });
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
			if(attr == 'name' && val == 'title')
				return;
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
                el.rel = rel; el.href = href;
                document.head.appendChild(el);
            }
            Object.entries(attrs).forEach(([k, v]) => {
                if (!['rel', 'href'].includes(k) && el.getAttribute(k) !== v) el.setAttribute(k, v);
            });
        }
    };

    // --- Observation Ciblée ---
    const setupObservation = () => {
        const root = document.querySelector('aria-ml');
        if (!root) return;

        // 1. Observer l'ajout/suppression de scripts dans aria-ml
        const structureObserver = new MutationObserver((mutations) => {
            let needsCheck = false;
            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (node.nodeName === 'SCRIPT' && (node.type === 'application/ld+json' || node.type === 'ld+json')) {
                        needsCheck = true;
                        // On attache un observer au contenu du nouveau script
                        contentObserver.observe(node, { characterData: true, childList: true });
                    }
                }
            }
            if (needsCheck) AriaMLRenderer.render();
        });

        // 2. Observer les changements de texte à l'intérieur des scripts
        const contentObserver = new MutationObserver(() => AriaMLRenderer.render());

        // Initialisation des scripts existants
        const existingScripts = root.querySelectorAll('script[type="application/ld+json"], script[type="ld+json"]');
        existingScripts.forEach(s => contentObserver.observe(s, { characterData: true, childList: true }));

        structureObserver.observe(root, { childList: true, subtree: true });
    };

    // Ecoute l'événement du Proxy (Main World)
    document.addEventListener('ariaml:updated', () => AriaMLRenderer.render());

    // --- Initialisation ---
    setupObservation();
    if (!isSSR) {
        AriaMLRenderer.render();
    } else {
        const data = AriaMLRenderer.parse();
        if (data) AriaMLRenderer.lastDataHash = JSON.stringify(data);
    }
})();
