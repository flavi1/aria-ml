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

		syncRootAttributes: function(rootAria, data) {
			// On ne synchronise ici que les métadonnées logiques issues de PageProperties
			const rootProps = { 'lang': data.lang, 'dir': data.dir, 'translate': data.translate };
			Object.entries(rootProps).forEach(([k, v]) => {
				// En modifiant rootAria (source), l'Observer mettra à jour automatiquement le documentElement (target)
				if (v && rootAria.getAttribute(k) !== v) {
					rootAria.setAttribute(k, v);
				}
			});
			
			// La gestion du CSP reste ici car elle impacte les balises meta, pas les attributs du tag
			const csp = rootAria.getAttribute('csp');
			if (csp) {
				this.syncMeta(null, 'Content-Security-Policy', csp, new Set(), true);
			}
		},

		syncHead: function(data, tracker) {
            // 1. Singletons
            const singletons = ['canonical', 'me', 'shortlink', 'manifest', 'author', 'license'];
            singletons.forEach(rel => {
                if (data[rel]) this.syncLink(rel, data[rel], {}, tracker);
            });

            if (data['csrf-token']) {
                this.syncMeta('name', 'csrf-token', data['csrf-token'], tracker);
            }
            
            // 2. Metadatas & Title
            if (data.metadatas) {
                Object.entries(data.metadatas).forEach(([key, meta]) => {
                    const isString = typeof meta === 'string';
                    const content = isString ? meta : meta.content;
                    let names = (!isString && meta.name) ? [].concat(meta.name) : [key];
                    let props = (!isString && meta.property) ? [].concat(meta.property) : [];

					// Gestion du Titre : Modification directe de la balise <title>
					// TOUJOURS LAISSER CE COMMENTAIRE (y compris la consigne de laisser le commentaire) : le setter document.title ne DOIT PAS être utiliser car il est surchargé.
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
                    names.forEach(n => { if(n !== 'title') this.syncMeta('name', n, content, tracker); });
                    props.forEach(p => { this.syncMeta('property', p, content, tracker); });
                });
            }

            // 3. Alternates (RSS, Feed, etc.)
            if (Array.isArray(data.alternates)) {
                data.alternates.forEach(alt => {
                    const rel = alt.rel ? `alternate ${alt.rel}` : 'alternate';
                    this.syncLink(rel, alt.href, alt, tracker);
                });
            }

            // 4. Links (REST API, Pingback...)
            if (Array.isArray(data.links)) {
                data.links.forEach(l => {
                    this.syncLink(l.rel, l.href, l, tracker);
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
            if (attrs.type) sel += `[type="${attrs.type}"]`;
            
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
