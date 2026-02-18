(function() {
    const AriaMLDocument = {
        linkSingletons: ['author', 'license'], // Identifiés par Schema.org à la racine
        managedNodes: new Map(),

        init() {
            if (!document.querySelector('meta[charset]')) {
                const charset = document.createElement('meta');
                charset.setAttribute('charset', 'UTF-8');
                document.head.prepend(charset);
            }
            this.parse();

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
            const authorizedTypes = ['Article', 'WebPage', 'DigitalDocument', 'SoftwareApplication'];
            let masterData = {};

            scripts.forEach(s => {
                try {
                    const content = s.textContent.trim();
                    if (!content) return;
                    const json = JSON.parse(content);
                    const contextStr = JSON.stringify(json['@context'] || "");
                    const isAriaML = contextStr.includes("https://ariaml.com/ns/");
                    const isAuthorized = authorizedTypes.includes(json['@type']);
                    const isRootNode = !json['@id'] || json['@id'] === "" || json['@id'] === "#";

                    if ((isAuthorized && isRootNode) || isAriaML) {
                        masterData = this.deepMerge(masterData, json);
                    }
                } catch (e) {
                    console.warn("[AriaML] Invalid JSON-LD block skipped.", e);
                }
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

            // 1. GLOBALS (Mapping direct racine)
            if (data.name) document.title = data.name;
            if (data.direction) document.documentElement.dir = data.direction;
            if (data.inLanguage) document.documentElement.lang = data.inLanguage;
            if (data.description) this.upsert('meta', { name: 'description' }, { content: data.description });
            if (data.url) this.upsert('link', { rel: 'canonical' }, { href: data.url });
            if (data.csrfToken) this.upsert('meta', { name: 'csrf-token' }, { content: data.csrfToken });

            // 2. LINK SINGLETONS (author, license à la racine)
            this.linkSingletons.forEach(key => {
                if (data[key]) {
                    const href = (typeof data[key] === 'object') ? data[key].url : data[key];
                    if (href) this.upsert('link', { rel: key }, { href: href });
                }
            });

            // 3. DICTIONNAIRES (metadatas & properties)
            if (data.metadatas) {
                for (const [name, content] of Object.entries(data.metadatas)) {
                    this.upsert('meta', { name: name }, { content: content });
                }
            }

            if (data.properties) {
                for (const [prop, val] of Object.entries(data.properties)) {
                    this.upsert('meta', { property: prop }, { content: val });
                }
            }

            // 4. LISTES (Traductions, Relations, Legacy)
            const syncList = (list, rel, isOriginal) => {
                if (!list) return;
                const items = Array.isArray(list) ? list : [list];
                items.forEach(t => {
                    const attrs = { rel: rel, hreflang: t.inLanguage };
                    if (isOriginal) attrs.class = 'translationOfWork';
                    this.upsert('link', attrs, { href: t.url });
                });
            };

            syncList(data.translationOfWork, 'alternate', true);
            syncList(data.workTranslation, 'alternate', false);

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

    if (document.readyState === 'complete') AriaMLDocument.init();
    else window.addEventListener('DOMContentLoaded', () => AriaMLDocument.init());
    window.AriaMLDocument = AriaMLDocument;
})();
