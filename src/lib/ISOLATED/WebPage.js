(function() {
    const AriaMLWebPage = {
        linkSingletons: ['shortlink', 'canonical', 'author', 'license', 'me'],
        managedNodes: new Map(),

        init() {
            // 1. Force UTF-8
            let charset = document.querySelector('meta[charset]');
            if (!charset) {
                charset = document.createElement('meta');
                charset.setAttribute('charset', 'UTF-8');
                document.head.prepend(charset);
            }

            this.parse();

            // 2. Observer les mutations des scripts JSON-LD
            const observer = new MutationObserver(() => this.parse());
            observer.observe(document.documentElement, {
                childList: true,
                subtree: true,
                characterData: true
            });
        },

        parse() {
            const scripts = document.querySelectorAll('script[type="application/ld+json"]');
            let data = {};
            scripts.forEach(s => {
                try {
                    const json = JSON.parse(s.textContent);
                    if (json['@type'] === 'WebPage' || (json['@context'] && JSON.stringify(json['@context']).includes('ariaml'))) {
                        data = Object.assign(data, json);
                    }
                } catch (e) {}
            });
            this.sync(data);
        },

        sync(data) {
            // MARK: Tout est potentiellement à supprimer
            this.managedNodes.forEach(node => node._toBeRemoved = true);

            // --- 1. GLOBALS ---
            if (data.name) document.title = data.name;
            if (data.direction) document.documentElement.dir = data.direction;
            if (data.inLanguage) document.documentElement.lang = data.inLanguage;
            if (data.url) this.upsert('link', { rel: 'canonical' }, { href: data.url });
            if (data.csrfToken) this.upsert('meta', { name: 'csrf-token' }, { content: data.csrfToken });

            // --- 2. METADATAS (name) ---
            if (data.metadatas) {
                for (const [name, content] of Object.entries(data.metadatas)) {
                    if (this.linkSingletons.includes(name)) {
                        this.upsert('link', { rel: name }, { href: content });
                    } else {
                        this.upsert('meta', { name: name }, { content: content });
                    }
                }
            }

            // --- 3. PROPERTIES (property) ---
            if (data.properties) {
                for (const [prop, val] of Object.entries(data.properties)) {
                    this.upsert('meta', { property: prop }, { content: val });
                }
            }

            // --- 4. WORK TRANSLATION (rel=alternate + hreflang) ---
            if (data.workTranslation) {
                data.workTranslation.forEach(t => {
                    this.upsert('link', { rel: 'alternate', hreflang: t.inLanguage }, { href: t.url });
                });
            }

            // --- 5. RELATED LINKS (rel=alternate + type) ---
            if (data.relatedLink) {
                data.relatedLink.forEach(r => {
                    // Ici on identifie par le couple rel + type (ex: RSS vs PDF)
                    this.upsert('link', { rel: r.rel || 'related', type: r.encodingFormat }, { 
                        href: r.url, 
                        title: r.name, 
                        integrity: r.integrity 
                    });
                });
            }

            // --- 6. LEGACY LINKS (Sélecteurs complexes) ---
            if (data.legacyLinks) {
                data.legacyLinks.forEach(l => {
                    // Pour le fallback, on identifie par rel ET href si nécessaire
                    const selector = { rel: l.rel };
                    if (l.sizes) selector.sizes = l.sizes;
                    if (l.hreflang) selector.hreflang = l.hreflang;
                    
                    this.upsert('link', selector, l);
                });
            }

            // SWEEP: Suppression des orphelins
            this.managedNodes.forEach((node, key) => {
                if (node._toBeRemoved) {
                    node.remove();
                    this.managedNodes.delete(key);
                }
            });
        },

        /**
         * @param {string} tag - 'meta' ou 'link'
         * @param {object} idAttrs - Attributs servant d'identifiant unique (ex: {name: 'robots'})
         * @param {object} allAttrs - Tous les attributs à appliquer
         */
        upsert(tag, idAttrs, allAttrs) {
            // Construction du sélecteur CSS pour trouver la balise existante
            const attrSelectors = Object.entries(idAttrs)
                .map(([k, v]) => `[${k}="${v}"]`)
                .join('');
            const selector = `${tag}${attrSelectors}`;
            
            let el = document.head.querySelector(selector);

            if (!el) {
                el = document.createElement(tag);
                // On applique les IDs immédiatement pour qu'il soit trouvable au prochain tour
                for (const [k, v] of Object.entries(idAttrs)) el.setAttribute(k, v);
                document.head.appendChild(el);
            }

            // Mise à jour de tous les attributs fournis
            const finalAttrs = { ...idAttrs, ...allAttrs };
            for (const [k, v] of Object.entries(finalAttrs)) {
                if (v !== undefined && el.getAttribute(k) !== String(v)) {
                    el.setAttribute(k, v);
                }
            }

            el._toBeRemoved = false;
            this.managedNodes.set(selector, el);
        }
    };

    if (document.readyState === 'complete') AriaMLWebPage.init();
    else window.addEventListener('DOMContentLoaded', () => AriaMLWebPage.init());
    window.AriaMLWebPage = AriaMLWebPage;
})();
