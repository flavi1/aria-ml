/**
 * AriaML GlobalSheetParser
 * Version 1.4.5 - "The Triple-Dash Edition"
 * Prefix: ---BHV-
 */
const GlobalSheetParser = (type, sheetsSelector, sheetAttribute) => {
    if (typeof window.sheets === 'undefined') {
        window.sheets = {};
    }

    const BHV_PREFIX = '---BHV-';
    let resolveReady;
    const readyPromise = new Promise(resolve => { resolveReady = resolve; });

    /**
     * Transforme les propriétés AriaML en variables ultra-isolées.
     */
    function transformCSS(css) {
        // Nettoyage des commentaires pour éviter les faux positifs
        let cleanCSS = css.replace(/\/\*[\s\S]*?\*\//g, '');

        // Regex : on cherche (début de bloc ou fin de prop) + (nom de prop commençant par une lettre)
        // On ignore tout ce qui commence déjà par un tiret.
        const regex = /([\{\;])\s*([a-zA-Z][a-zA-Z0-9-]+)\s*:/g;
        
        const transformed = cleanCSS.replace(regex, (match, separator, prop) => {
            return `${separator} ${BHV_PREFIX}${prop}:`;
        });

        const styleEl = document.createElement('style');
        styleEl.textContent = transformed;
        document.head.appendChild(styleEl);
        const rules = styleEl.sheet.cssRules;
        document.head.removeChild(styleEl);
        
        return rules;
    }

    function ruleFactory(r, opts = {}) {
        const ruleObj = { selector: r.selectorText, properties: {} };
        for (let k in opts) ruleObj[k] = opts[k];
        
        const style = r.style;
        for (let i = 0; i < style.length; i++) {
            const propName = style[i];
            // On ne récupère QUE les propriétés appartenant au Namespace BHV
            if (propName.startsWith(BHV_PREFIX)) {
                const cleanKey = propName.substring(BHV_PREFIX.length);
                let val = style.getPropertyValue(propName).trim();
                // Nettoyage des guillemets (protection contre le parsing CSS auto-correctif)
                val = val.replace(/^["']|["']$/g, '');
                ruleObj.properties[cleanKey] = val;
            }
        }
        return ruleObj;
    }

    function parseRules(_rules) {
        const rulesArray = (typeof _rules === 'string') ? transformCSS(_rules) : _rules;
        const parsed = [];
        for (let r of rulesArray) {
            if (r instanceof CSSStyleRule) {
                parsed.push(ruleFactory(r));
            } else if (r instanceof CSSMediaRule) {
                for (let _r of r.cssRules) parsed.push(ruleFactory(_r, { media: r.media }));
            } else if (r instanceof CSSSupportsRule) {
                for (let _r of r.cssRules) parsed.push(ruleFactory(_r, { support: r.conditionText }));
            }
        }
        return parsed;
    }

    async function loadSheets() {
        window.sheets[type] = new Map();
        const sheetsTags = document.querySelectorAll(sheetsSelector);
        
        if (sheetsTags.length === 0) {
            resolveReady();
            return;
        }

        for (const sheet of sheetsTags) {
            let content = "";
            if (sheet.hasAttribute(sheetAttribute)) {
                try {
                    // Support natif data:base64 et fichiers externes
                    const response = await fetch(sheet.getAttribute(sheetAttribute));
                    content = await response.text();
                } catch (e) { console.error(`[AriaML] Erreur de chargement distant:`, e); }
            } else {
                // textContent respecte les sélecteurs complexes
                content = sheet.textContent;
            }
            
            if (content.trim()) {
                window.sheets[type].set(sheet, parseRules(content));
            }
        }
        reset();
        resolveReady();
    }

    // --- MOTEUR DE CALCUL ---
    let abstractComputedValues = null;
    const initialValues = new Map();
    let currentValues = new Map();

    function refresh() {
        abstractComputedValues = new Map();
        for (let [key, propList] of window.sheets[type]) {
            for (let rule of propList) {
                try {
                    const targets = document.querySelectorAll(rule.selector);
                    targets.forEach(el => {
                        let collected = abstractComputedValues.get(el) || [];
                        collected.push(rule);
                        abstractComputedValues.set(el, collected);
                    });
                } catch(e) {}
            }
        }
        
        currentValues.clear();
        for (let [el, collectedRules] of abstractComputedValues) {
            let rulesToApply = {};
            for (let r of collectedRules) {
                let apply = true;
                if (r.media && !window.matchMedia(r.media.mediaText).matches) apply = false;
                if (r.support && !CSS.supports(r.support)) apply = false;
                if (apply) {
                    Object.assign(rulesToApply, r.properties);
                }
            }
            currentValues.set(el, rulesToApply);
        }

        // Notification du moteur Behavior / Navigation
        for (let [el, newRules] of currentValues) {
            el.dispatchEvent(new CustomEvent(type + '.applyRules', {
                bubbles: true, 
                detail: { newRules }
            }));
        }
    }

    function reset() { refresh(); }

    const init = () => {
        loadSheets();
        const obs = new MutationObserver(m => {
            let shouldReload = false;
            m.forEach(record => {
                record.addedNodes.forEach(n => {
                    if (n.nodeType === 1 && (n.matches(sheetsSelector) || n.querySelector(sheetsSelector))) shouldReload = true;
                });
            });
            if (shouldReload) loadSheets();
        });
        obs.observe(document.documentElement, { childList: true, subtree: true });
    };

    if (document.readyState === 'loading') document.addEventListener("DOMContentLoaded", init);
    else init();

    // HTMLElement Proxy
    if (!Object.getOwnPropertyDescriptor(HTMLElement.prototype, type)) {
        Object.defineProperty(HTMLElement.prototype, type, {
            get: function() {
                const el = this;
                return {
                    get initials() { return initialValues.get(el) || {}; },
                    get computed() { return currentValues.get(el) || {}; }
                };
            },
            configurable: true
        });
    }

    return { ready: readyPromise, refresh, reset };
};
