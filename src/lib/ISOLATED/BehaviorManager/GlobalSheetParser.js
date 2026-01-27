/**
 * AriaML GlobalSheetParser v1.5
 * "The Agnostic Collector"
 */
const GlobalSheetParser = (type, sheetsSelector, sheetAttribute, BHV_PREFIX = '---BHV-') => {
    if (!window.sheets) window.sheets = {};
    
    // Structure de stockage partagée
    window.sheets[type] = {
        virtualRules: new Map(), // :tab => { props }
        rawSheets: new Map()     // <script> => [ {selector, properties, media...} ]
    };

    let resolveReady;
    const readyPromise = new Promise(resolve => { resolveReady = resolve; });

    function transformAndExtract(css) {
        let cleanCSS = css.replace(/\/\*[\s\S]*?\*\//g, '');
        
        // 1. Extraction des Virtual Rules (:pattern)
        // On cherche :nom { ... }
        const virtualRegex = /:([a-zA-Z0-9-]+)\s*\{([^}]*)\}/g;
        let match;
        while ((match = virtualRegex.exec(cleanCSS)) !== null) {
            const name = match[1];
            const content = match[2];
            const props = {};
            // Extraction simple des propriétés internes
            content.split(';').forEach(pair => {
                let [k, ...v] = pair.split(':');
                if (k && v.length) props[k.trim()] = v.join(':').trim();
            });
            window.sheets[type].virtualRules.set(name, props);
        }

        // 2. Nettoyage du CSS pour le moteur natif (on retire les patterns)
        let realCSS = cleanCSS.replace(virtualRegex, '');

        // 3. Préfixage des propriétés réelles
        const propRegex = /([\{\;])\s*([a-zA-Z][a-zA-Z0-9-]+)\s*:/g;
        realCSS = realCSS.replace(propRegex, (m, sep, prop) => `${sep} ${BHV_PREFIX}${prop}:`);

        // 4. Validation via CSSOM
        const styleEl = document.createElement('style');
        styleEl.textContent = realCSS;
        document.head.appendChild(styleEl);
        const rules = Array.from(styleEl.sheet.cssRules);
        document.head.removeChild(styleEl);
        
        return rules;
    }

    function ruleFactory(r, opts = {}) {
        const ruleObj = { selector: r.selectorText, properties: [], ...opts };
        const style = r.style;
        // IMPORTANT : On garde l'ordre de déclaration original
        for (let i = 0; i < style.length; i++) {
            const name = style[i];
            if (name.startsWith(BHV_PREFIX)) {
                let val = style.getPropertyValue(name).trim().replace(/^["']|["']$/g, '');
                ruleObj.properties.push({ key: name.substring(BHV_PREFIX.length), value: val });
            }
        }
        return ruleObj;
    }

    function parseToInternal(rulesArray) {
        const parsed = [];
        rulesArray.forEach(r => {
            if (r instanceof CSSStyleRule) parsed.push(ruleFactory(r));
            else if (r instanceof CSSMediaRule) {
                Array.from(r.cssRules).forEach(_r => parsed.push(ruleFactory(_r, { media: r.media })));
            }
        });
        return parsed;
    }

    async function loadSheets() {
        const tags = document.querySelectorAll(sheetsSelector);
        if (tags.length === 0) return resolveReady();

        for (const tag of tags) {
            let content = tag.hasAttribute(sheetAttribute) 
                ? await (await fetch(tag.getAttribute(sheetAttribute))).text()
                : tag.textContent;
            
            if (content.trim()) {
                const rules = transformAndExtract(content);
                window.sheets[type].rawSheets.set(tag, parseToInternal(rules));
            }
        }
        refresh();
        resolveReady();
    }

    let currentValues = new Map();
    function refresh() {
        const elementMap = new Map();
        // Collecte toutes les règles s'appliquant à chaque élément
        window.sheets[type].rawSheets.forEach(rules => {
            rules.forEach(rule => {
                try {
                    document.querySelectorAll(rule.selector).forEach(el => {
                        if (rule.media && !window.matchMedia(rule.media.mediaText).matches) return;
                        let list = elementMap.get(el) || [];
                        list.push(rule);
                        elementMap.set(el, list);
                    });
                } catch(e) {}
            });
        });

        currentValues = elementMap;
        for (let [el, rules] of currentValues) {
            el.dispatchEvent(new CustomEvent(type + '.applyRules', { detail: { rules } }));
        }
    }

    const init = () => { loadSheets(); };
    if (document.readyState === 'loading') document.addEventListener("DOMContentLoaded", init); else init();

    if (!Object.getOwnPropertyDescriptor(HTMLElement.prototype, type)) {
        Object.defineProperty(HTMLElement.prototype, type, {
            get: function() {
                return { 
                    get rules() { return currentValues.get(this) || []; },
                    // Le 'computed' sera injecté par le Core
                    computed: {} 
                };
            },
            configurable: true
        });
    }

    return { ready: readyPromise, refresh };
};
