/**
 * AriaML GlobalSheetParser
 * Version 1.4.2 - "The Solid Foundation"
 * Support: CSS Variables transformation, Data-URIs, Media Queries & Supports
 */
const GlobalSheetParser = (type, sheetsSelector, sheetAttribute) => {
    if (typeof window.sheets === 'undefined') {
        window.sheets = {};
    }

    // --- GESTION DE LA SYNCHRONISATION ---
    let resolveReady;
    const readyPromise = new Promise(resolve => { resolveReady = resolve; });

    /**
     * Normalise le code pour garantir que chaque propriété est détectable.
     */
    function unminify(code) {
        return code
            .replace(/\s*{\s*/g, ' {\n')
            .replace(/;\s*/g, ';\n')
            .replace(/}\s*/g, '\n}\n')
            .trim();
    }

    /**
     * Transforme les propriétés AriaML en variables CSS (--prop)
     * pour que le navigateur accepte de les parser sans les ignorer.
     */
    function transformCSS(inputCSS) {
        const regex = /([\{\;\n]\s*)([a-zA-Z0-9-]+)(\s*):/g;
        const styleContent = inputCSS.replace(regex, (match, prefix, prop, suffix) => {
            if (prop.startsWith('--')) return match;
            return `${prefix}--${prop}${suffix}:`;
        });

        let doc = document.implementation.createHTMLDocument(""),
            styleElement = document.createElement("style");
        styleElement.textContent = styleContent;
        doc.body.appendChild(styleElement);
        return styleElement.sheet.cssRules;
    }

    function ruleFactory(r, opts = {}) {
        const ruleObj = { selector: r.selectorText, properties: {} };
        for (let k in opts) ruleObj[k] = opts[k];
        
        const style = r.style;
        for (let i = 0; i < style.length; i++) {
            const propName = style[i];
            if (propName.startsWith('--')) {
                // Nettoyage : on retire le préfixe -- et les guillemets de protection
                const cleanKey = propName.substring(2);
                const rawValue = style.getPropertyValue(propName).trim();
                ruleObj.properties[cleanKey] = rawValue.replace(/^["']|["']$/g, '');
            }
        }
        return ruleObj;
    }

    function parseRules(_rules) {
        if (typeof _rules === 'string') _rules = transformCSS(unminify(_rules));
        const rules = [];
        for (let r of _rules) {
            if (r instanceof CSSStyleRule) {
                rules.push(ruleFactory(r));
            } else if (r instanceof CSSMediaRule) {
                for (let _r of r.cssRules) rules.push(ruleFactory(_r, { media: r.media }));
            } else if (r instanceof CSSSupportsRule) {
                for (let _r of r.cssRules) rules.push(ruleFactory(_r, { support: r.conditionText }));
            }
        }
        return rules;
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
                let url = sheet.getAttribute(sheetAttribute);
                try {
                    // Fetch gère nativement http, https et data:base64
                    const response = await fetch(url);
                    content = await response.text();
                } catch (e) { 
                    console.error(`[AriaML ${type}] Fail to load: ${url}`, e); 
                }
            } else {
                // Utilisation de textContent pour préserver les sélecteurs complexes (> , etc)
                content = sheet.textContent;
            }
            
            if (content) {
                window.sheets[type].set(sheet, parseRules(content));
            }
        }
        reset();
        resolveReady();
    }

    let abstractComputedValues = null;
    const initialValues = new Map();
    let currentValues = new Map();
    const MQObservers = {};

    function observeMQ(mediaText, MQL) {
        if (!MQObservers[mediaText]) {
            MQL.addEventListener('change', refresh);
            MQObservers[mediaText] = MQL;
        }
    }

    function refresh() {
        abstractComputedValues = null; 
        const eventName = type + '.refresh';
        
        if (!abstractComputedValues) {
            abstractComputedValues = new Map();
            for (let [key, propList] of window.sheets[type]) {
                for (let rule of propList) {
                    try {
                        for (let el of document.querySelectorAll(rule.selector)) {
                            let collectedRules = abstractComputedValues.get(el) || [];
                            collectedRules.push(rule);
                            abstractComputedValues.set(el, collectedRules);
                        }
                    } catch(e) {}
                }
            }
        }
        
        let lastValues = new Map(currentValues);
        currentValues.clear();
        
        for (let [el, collectedRules] of abstractComputedValues) {
            let rulesToApply = {};
            for (let r of collectedRules) {
                let apply = true;
                if (r.media) {
                    const mq = window.matchMedia(r.media.mediaText);
                    observeMQ(r.media.mediaText, mq);
                    if (!mq.matches) apply = false;
                }
                if (r.support && apply && !CSS.supports(r.support)) apply = false;
                
                if (apply) {
                    for (let k in r.properties) rulesToApply[k] = r.properties[k];
                }
            }
            
            // Gestion des valeurs initiales pour le rollback
            if (!initialValues.has(el)) {
                el.dispatchEvent(new CustomEvent(type + '.resolveInitials', { bubbles: true }));
            }

            if (initialValues.has(el)) {
                let initials = initialValues.get(el);
                for (let k in initials) {
                    if (typeof rulesToApply[k] === 'undefined' || rulesToApply[k] === 'initial') {
                        rulesToApply[k] = initials[k];
                    }
                }
            }
            currentValues.set(el, rulesToApply);
        }

        // Notification des changements pour les moteurs (Behavior, Navigation, etc)
        for (let [el, newRules] of currentValues) {
            const lastRules = lastValues.get(el) || initialValues.get(el) || {};
            el.dispatchEvent(new CustomEvent(type + '.applyRules', {
                bubbles: true, 
                detail: { lastRules, newRules }
            }));
        }
        document.dispatchEvent(new CustomEvent(eventName, { bubbles: true }));
    }

    function reset() { abstractComputedValues = null; refresh(); }

    const init = () => {
        loadSheets();
        const domObserver = new MutationObserver((mutations) => {
            let reload = false;
            mutations.forEach(m => {
                m.addedNodes.forEach(n => {
                    if (n.nodeType === 1 && (n.matches(sheetsSelector) || n.querySelector(sheetsSelector))) reload = true;
                });
            });
            if (reload) loadSheets();
        });
        domObserver.observe(document.documentElement, { childList: true, subtree: true });
    };

    if (document.readyState === 'loading') document.addEventListener("DOMContentLoaded", init);
    else init();

    // Injection de la propriété Proxy sur HTMLElement (ex: el.behavior)
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

    return {
        ready: readyPromise,
        setInitialValue: (el, k, v) => {
            const props = initialValues.get(el) || {};
            if (typeof props[k] === 'undefined') props[k] = v;
            initialValues.set(el, props);
        },
        refresh, reset, reloadSheets: loadSheets
    };
};
