(function() {
    const AriaMLDocument = {
        linkSingletons: ['author', 'license'], 
        managedNodes: new Map(),
        _observer: null,

	init() {
		const isSSR = document.head.hasAttribute('data-ssr');
		
		// Si SSR, on indexe l'existant pour que upsert() sache qu'ils sont déjà là
		if (isSSR) {
			document.querySelectorAll('head meta, head link').forEach(el => {
				const tag = el.tagName.toLowerCase();
				const idAttrs = {};
				if (el.hasAttribute('name')) idAttrs.name = el.getAttribute('name');
				if (el.hasAttribute('property')) idAttrs.property = el.getAttribute('property');
				if (el.hasAttribute('rel')) idAttrs.rel = el.getAttribute('rel');
				
				// CORRECTION: Échappement des guillemets pour cohérence avec upsert()
				const selector = tag + Object.entries(idAttrs)
					.map(([k, v]) => `[${k}="${String(v).replace(/"/g, '\\"')}"]`).join('');
				
				this.managedNodes.set(selector, el);
			});
		} else if (!document.querySelector('meta[charset]')) {
			const charset = document.createElement('meta');
			charset.setAttribute('charset', 'UTF-8');
			document.head.prepend(charset);
		}

		this.parse(); // Le premier parse trouvera les éléments dans managedNodes et ne fera rien

            this._observer = new MutationObserver((mutations) => {
                let needsParse = false;
                for (const m of mutations) {
                    if (m.type === 'childList') {
                        const isJsonLd = (nodes) => Array.from(nodes).some(n => n.nodeName === 'SCRIPT' && n.type === 'application/ld+json');
                        if (isJsonLd(m.addedNodes) || isJsonLd(m.removedNodes)) { needsParse = true; break; }
                    }
                    else if (m.type === 'characterData') {
                        const parent = m.target.parentElement;
                        if (parent?.nodeName === 'SCRIPT' && parent.type === 'application/ld+json') { needsParse = true; break; }
                    }
                }
                if (needsParse) this.parse();
            });

            this._observer.observe(document.documentElement, {
                childList: true, subtree: true, characterData: true 
            });
        },

        parse() {
            const scripts = document.querySelectorAll('script[type="application/ld+json"]');
            const authorizedTypes = ['Article', 'WebPage', 'DigitalDocument', 'SoftwareApplication'];
            let masterData = {};

            scripts.forEach(s => {
                try {
                    const json = JSON.parse(s.textContent.trim() || "{}");
                    const contextStr = JSON.stringify(json['@context'] || "");
                    const isAriaML = contextStr.includes("https://ariaml.com/ns/");
                    const isAuthorized = authorizedTypes.includes(json['@type']);
                    const isRootNode = !json['@id'] || json['@id'] === "" || json['@id'] === "#";

                    if ((isAuthorized && isRootNode) || isAriaML) {
                        masterData = this.deepMerge(masterData, json);
                    }
                } catch (e) { console.warn("[AriaML] Invalid JSON-LD block skipped.", e); }
            });

            // Pause de l'observer pour éviter l'auto-détection des changements qu'on va injecter
            if (this._observer) this._observer.disconnect();
            this.sync(masterData);
            if (this._observer) this._observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
        },

        deepMerge(target, source) {
            for (const key in source) {
                const sVal = source[key];
                if (Array.isArray(sVal)) {
                    target[key] = Array.isArray(target[key]) ? target[key].concat(sVal) : [...sVal];
                } else if (sVal !== null && typeof sVal === 'object') {
                    target[key] = this.deepMerge(target[key] || {}, sVal);
                } else {
                    target[key] = sVal;
                }
            }
            return target;
        },

        sync(data) {
            this.managedNodes.forEach(node => node._toBeRemoved = true);

            if (data.name) document.title = data.name;
            if (data.direction) document.documentElement.dir = data.direction;
            if (data.inLanguage) document.documentElement.lang = data.inLanguage;
            if (data.description) this.upsert('meta', { name: 'description' }, { content: data.description });
            if (data.url) this.upsert('link', { rel: 'canonical' }, { href: data.url });
            
            // Harmonisation du nom pour la balise meta
            const csrf = data.csrfToken || data['csrf-token'];
            if (csrf) this.upsert('meta', { name: 'csrf-token' }, { content: csrf });

            this.linkSingletons.forEach(key => {
                const val = data[key];
                const href = (typeof val === 'object') ? val.url : val;
                if (href) this.upsert('link', { rel: key }, { href: href });
            });

            if (data.metadatas) Object.entries(data.metadatas).forEach(([n, c]) => this.upsert('meta', { name: n }, { content: c }));
            if (data.properties) Object.entries(data.properties).forEach(([p, v]) => this.upsert('meta', { property: p }, { content: v }));

            const syncL = (list, rel, isOrig) => {
                if (!list) return;
                (Array.isArray(list) ? list : [list]).forEach(t => {
                    if (!t.url) return;
                    const attr = { rel: rel };
                    if (t.inLanguage) attr.hreflang = t.inLanguage;
                    if (isOrig) attr.class = 'translationOfWork';
                    this.upsert('link', attr, { href: t.url });
                });
            };
            syncL(data.translationOfWork, 'alternate', true);
            syncL(data.workTranslation, 'alternate', false);

            if (data.legacyLinks) {
                data.legacyLinks.forEach(l => {
                    const id = { rel: l.rel || 'alternate' };
                    if (l.sizes) id.sizes = l.sizes;
                    if (l.hreflang) id.hreflang = l.hreflang;
                    if (l.type && !l.sizes) id.type = l.type;
                    this.upsert('link', id, l);
                });
            }

            this.managedNodes.forEach((node, key) => {
                if (node._toBeRemoved) {
                    node.remove();
                    this.managedNodes.delete(key);
                }
            });
        },

        upsert(tag, idAttrs, allAttrs) {
            // Échappement basique des sélecteurs pour la robustesse
            const selector = tag + Object.entries(idAttrs)
                .map(([k, v]) => `[${k}="${String(v).replace(/"/g, '\\"')}"]`).join('');
            
            let el = document.head.querySelector(selector);
            if (!el) {
                el = document.createElement(tag);
                Object.entries(idAttrs).forEach(([k, v]) => el.setAttribute(k, v));
                document.head.appendChild(el);
            }

            const final = { ...idAttrs, ...allAttrs };
            Object.entries(final).forEach(([k, v]) => {
                if (v !== undefined && k !== 'rel' && el.getAttribute(k) !== String(v)) {
                    el.setAttribute(k, v);
                }
            });

            el._toBeRemoved = false;
            this.managedNodes.set(selector, el);
        }
    };

    if (document.readyState === 'complete') AriaMLDocument.init();
    else window.addEventListener('DOMContentLoaded', () => AriaMLDocument.init());
    window.AriaMLDocument = AriaMLDocument;
})();
