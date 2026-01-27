/**
 * AriaML GlobalSheetParser v1.6
 * "The Native-Virtual Hybrid"
 */
const GlobalSheetParser = (type, sheetsSelector, sheetAttribute, PREFIX = 'AGNOSTIC') => {
    if (!window.sheets) window.sheets = {};
    
    window.sheets[type] = {
        virtualRules: new Map(), 
        rawSheets: new Map()
    };

    const PREFIX_INTERNAL = `---${PREFIX}-`; // ---BHV-prop
    const VIRTUAL_TAG_SUFFIX = '---';           // BHV-pattern---
    
    let resolveReady;
    const readyPromise = new Promise(resolve => { resolveReady = resolve; });

    function transformCSS(css) {
        let cleanCSS = css.replace(/\/\*[\s\S]*?\*\//g, '');
        
        // 1. Transformation des pseudo-classes en Custom Elements factices
        // :tab => BHV-tab---
        const virtualRegex = /:([a-zA-Z0-9-]+)/g;
        cleanCSS = cleanCSS.replace(virtualRegex, `${PREFIX}-$1${VIRTUAL_TAG_SUFFIX}`);

        // 2. Préfixage des propriétés (---BHV-prop)
        const propRegex = /([\{\;])\s*([a-zA-Z][a-zA-Z0-9-]+)\s*:/g;
        cleanCSS = cleanCSS.replace(propRegex, (m, sep, prop) => `${sep} ${PREFIX_INTERNAL}${prop}:`);

        const styleEl = document.createElement('style');
        styleEl.textContent = cleanCSS;
        document.head.appendChild(styleEl);
        const rules = Array.from(styleEl.sheet.cssRules);
        document.head.removeChild(styleEl);
        
        return rules;
    }

    function ruleFactory(r, opts = {}) {
        const ruleObj = { selector: r.selectorText, properties: [], ...opts };
        const style = r.style;
        for (let i = 0; i < style.length; i++) {
            const name = style[i];
            if (name.startsWith(PREFIX_INTERNAL)) {
                let val = style.getPropertyValue(name).trim().replace(/^["']|["']$/g, '');
                ruleObj.properties.push({ key: name.substring(PREFIX_INTERNAL.length), value: val });
            }
        }
        return ruleObj;
    }

    function parseRules(rulesArray) {
        const virtuals = window.sheets[type].virtualRules;
        const realRules = [];
        const virtualPrefix = `${PREFIX}-`;

        rulesArray.forEach(r => {
            if (!(r instanceof CSSStyleRule)) return;
            
            // Si le sélecteur est un élément virtuel BHV-xxx---
            if (r.selectorText.startsWith(virtualPrefix) && r.selectorText.endsWith(VIRTUAL_TAG_SUFFIX)) {
                const patternName = r.selectorText.slice(virtualPrefix.length, -VIRTUAL_TAG_SUFFIX.length);
                const props = {};
                const parsed = ruleFactory(r);
                parsed.properties.forEach(p => props[p.key] = p.value);
                virtuals.set(patternName, props);
            } else {
                // C'est une règle réelle (DOM)
                realRules.push(ruleFactory(r));
            }
        });
        return realRules;
    }

    async function loadSheets() {
        const tags = document.querySelectorAll(sheetsSelector);
        if (tags.length === 0) return resolveReady();

        for (const tag of tags) {
            let content = tag.hasAttribute(sheetAttribute) 
                ? await (await fetch(tag.getAttribute(sheetAttribute))).text()
                : tag.textContent;
            
            if (content.trim()) {
                const rules = transformCSS(content);
                window.sheets[type].rawSheets.set(tag, parseRules(rules));
            }
        }
        refresh();
        resolveReady();
    }

    let currentValues = new Map();
    function refresh() {
        const elementMap = new Map();
        window.sheets[type].rawSheets.forEach(rules => {
            rules.forEach(rule => {
                try {
                    document.querySelectorAll(rule.selector).forEach(el => {
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

    const init = () => loadSheets();
    if (document.readyState === 'loading') document.addEventListener("DOMContentLoaded", init); else init();

    if (!Object.getOwnPropertyDescriptor(HTMLElement.prototype, type)) {
        Object.defineProperty(HTMLElement.prototype, type, {
            get: function() { return { get rules() { return currentValues.get(this) || []; }, computed: {} }; },
            configurable: true
        });
    }
    return { ready: readyPromise, refresh };
};
