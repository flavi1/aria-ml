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

            // OBSERVATEUR FILTRÉ
            const observer = new MutationObserver((mutations) => {
                let needsParse = false;

                for (const m of mutations) {
                    if (m.type === 'childList') {
                        const checkNodes = (nodes) => {
                            for (const n of nodes) {
                                if (n.nodeName === 'SCRIPT' && n.type === 'application/ld+json') return true;
                            }
                            return false;
                        };
                        if (checkNodes(m.addedNodes) || checkNodes(m.removedNodes)) {
                            needsParse = true;
                            break;
                        }
                    }
                    else if (m.type === 'characterData') {
                        const parent = m.target.parentElement;
                        if (parent && parent.nodeName === 'SCRIPT' && parent.type === 'application/ld+json') {
                            needsParse = true;
                            break;
                        }
                    }
                }

                if (needsParse) {
                    console.info("[AriaML] Change detected in JSON-LD, reparsing...");
                    this.parse();
                }
            });

            observer.observe(document.documentElement, {
                childList: true,
                subtree: true,
                characterData: true 
            });
        },

        parse() {
            const scripts = document.querySelectorAll('script[type="application/ld+json"]');
            let masterData = {};

            scripts.forEach(s => {
                try {
                    const content = s.textContent.trim();
                    if (!content) return;
                    
                    const json = JSON.parse(content);
                    const contextStr = JSON.stringify(json['@context'] || "");
                    const isAriaML = contextStr.includes("https://ariaml.com/ns/");
                    const isWebPage = json['@type'] === 'WebPage';

                    if (isWebPage || isAriaML) {
                        masterData = this.deepMerge(masterData, json);
                    }
                } catch (e) {}
            });

            this.sync(masterData);
        },

        deepMerge(target, source) {
            for (const key in source) {
                const sVal = source[key];
                const tVal = target[key];

                if (Array.isArray(sVal)) {
                    target[key] = Array.isArray(tVal) ? tVal.concat(sVal) : [...sVal];
                } 
                else if (sVal !== null && typeof sVal === 'object' && !Array.isArray(sVal)) {
                    target[key] = this.deepMerge(tVal || {}, sVal);
                } 
                else {
                    target[key] = sVal;
                }
            }
            return target;
        },

        sync(data) {
            this.managedNodes.forEach(node => node._toBeRemoved = true);

            // GLOBALS
            if (data.name) document.title = data.name;
            if (data.direction) document.documentElement.dir = data.direction;
            if (data.inLanguage) document.documentElement.lang = data.inLanguage;
            if (data.url) this.upsert('link', { rel: 'canonical' }, { href: data.url });
            if (data.csrfToken) this.upsert('meta', { name: 'csrf-token' }, { content: data.csrfToken });

            // DICTIONARIES
            if (data.metadatas) {
                for (const [name, content] of Object.entries(data.metadatas)) {
                    if (this.linkSingletons.includes(name)) {
                        this.upsert('link', { rel: name }, { href: content });
                    } else {
                        this.upsert('meta', { name: name }, { content: content });
                    }
                }
            }

            if (data.properties) {
                for (const [prop, val] of Object.entries(data.properties)) {
                    this.upsert('meta', { property: prop }, { content: val });
                }
            }

            // LISTS
            
            // 1. Gestion de translationOfWork (Original)
            if (data.translationOfWork) {
                const translations = Array.isArray(data.translationOfWork) ? data.translationOfWork : [data.translationOfWork];
                translations.forEach(t => {
                    this.upsert('link', 
                        { rel: 'alternate', hreflang: t.inLanguage, class: 'translationOfWork' }, 
                        { href: t.url }
                    );
                });
            }

            // 2. Gestion de workTranslation (Traductions)
            if (data.workTranslation) {
                const translations = Array.isArray(data.workTranslation) ? data.workTranslation : [data.workTranslation];
                translations.forEach(t => {
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
                    if (l.type && !l.sizes) idAttrs.type = l.type;
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
