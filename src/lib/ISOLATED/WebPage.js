(function() {
    const AriaMLWebPage = {
        linkSingletons: ['shortlink', 'canonical', 'author', 'license', 'me'],
        managedNodes: new Map(),

        init() {
            // Force UTF-8 immédiat
            if (!document.querySelector('meta[charset]')) {
                const charset = document.createElement('meta');
                charset.setAttribute('charset', 'UTF-8');
                document.head.prepend(charset);
            }

            this.parse();

            const observer = new MutationObserver(() => this.parse());
            observer.observe(document.documentElement, {
                childList: true,
                subtree: true,
                characterData: true
            });
        },

        /**
         * Parcourt et fusionne tous les blocs JSON-LD pertinents
         */
        parse() {
            const scripts = document.querySelectorAll('script[type="application/ld+json"]');
            let masterData = {};

            scripts.forEach(s => {
                try {
                    const json = JSON.parse(s.textContent);
                    
                    // Détection plus souple du contexte AriaML ou du type WebPage
                    const contextStr = JSON.stringify(json['@context'] || "");
                    const isAriaML = contextStr.includes("ariaml.com/ns/");
                    const isWebPage = json['@type'] === 'WebPage';

                    if (isWebPage || isAriaML) {
                        masterData = this.deepMerge(masterData, json);
                    }
                } catch (e) {
                    console.error("[AriaML] JSON Error:", e);
                }
            });

            console.info("[AriaML] WebPage Data Merged:", masterData);
            this.sync(masterData);
        },

        /**
         * Fusionne les objets (metadatas, properties) et concatène les listes
         */
        deepMerge(target, source) {
            for (const key in source) {
                const sVal = source[key];
                const tVal = target[key];

                if (Array.isArray(sVal)) {
                    // Pour les listes (workTranslation, relatedLink, legacyLinks), on concatène
                    target[key] = Array.isArray(tVal) ? tVal.concat(sVal) : sVal;
                } 
                else if (sVal !== null && typeof sVal === 'object' && !Array.isArray(sVal)) {
                    // Pour les dictionnaires (metadatas, properties), on fusionne les clés
                    target[key] = this.deepMerge(tVal || {}, sVal);
                } 
                else {
                    // Valeur simple (name, url, csrfToken), la dernière l'emporte
                    target[key] = sVal;
                }
            }
            return target;
        },

        sync(data) {
            this.managedNodes.forEach(node => node._toBeRemoved = true);

            // --- 1. GLOBALS ---
            if (data.name) document.title = data.name;
            if (data.direction) document.documentElement.dir = data.direction;
            if (data.inLanguage) document.documentElement.lang = data.inLanguage;
            if (data.url) this.upsert('link', { rel: 'canonical' }, { href: data.url });
            if (data.csrfToken) this.upsert('meta', { name: 'csrf-token' }, { content: data.csrfToken });

            // --- 2. METADATAS ---
            if (data.metadatas) {
                for (const [name, content] of Object.entries(data.metadatas)) {
                    if (this.linkSingletons.includes(name)) {
                        this.upsert('link', { rel: name }, { href: content });
                    } else {
                        this.upsert('meta', { name: name }, { content: content });
                    }
                }
            }

            // --- 3. PROPERTIES ---
            if (data.properties) {
                for (const [prop, val] of Object.entries(data.properties)) {
                    this.upsert('meta', { property: prop }, { content: val });
                }
            }

            // --- 4. LISTES (Traductions, Related, Legacy) ---
            if (data.workTranslation) {
                data.workTranslation.forEach(t => {
                    this.upsert('link', { rel: 'alternate', hreflang: t.inLanguage }, { href: t.url });
                });
            }

            if (data.relatedLink) {
                data.relatedLink.forEach(r => {
                    this.upsert('link', { rel: r.rel || 'related', type: r.encodingFormat }, { 
                        href: r.url, title: r.name, integrity: r.integrity 
                    });
                });
            }

            if (data.legacyLinks) {
                data.legacyLinks.forEach(l => {
                    const idAttrs = { rel: l.rel };
                    if (l.sizes) idAttrs.sizes = l.sizes;
                    if (l.hreflang) idAttrs.hreflang = l.hreflang;
                    if (l.type && !l.sizes) idAttrs.type = l.type; // Pour différencier RSS/Atom par ex.

                    this.upsert('link', idAttrs, l);
                });
            }

            // SWEEP
            this.managedNodes.forEach((node, key) => {
                if (node._toBeRemoved) {
                    node.remove();
                    this.managedNodes.delete(key);
                }
            });
        },

        upsert(tag, idAttrs, allAttrs) {
            const attrSelectors = Object.entries(idAttrs)
                .map(([k, v]) => `[${k}="${v}"]`)
                .join('');
            const selector = `${tag}${attrSelectors}`;
            
            let el = document.head.querySelector(selector);

            if (!el) {
                el = document.createElement(tag);
                for (const [k, v] of Object.entries(idAttrs)) el.setAttribute(k, v);
                document.head.appendChild(el);
            }

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
