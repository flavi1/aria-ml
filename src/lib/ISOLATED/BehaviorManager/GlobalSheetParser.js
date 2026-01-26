/**
 * AriaML GlobalSheetParser.js
 * Version 1.4.1 - Support asynchrone pour orchestration
 */
const GlobalSheetParser = (type, sheetsSelector, sheetAttribute) => {
    if (typeof window.sheets === 'undefined') {
        window.sheets = {};
    }

    // --- GESTION DE LA SYNCHRONISATION ---
    let resolveReady;
    const readyPromise = new Promise(resolve => { resolveReady = resolve; });

    function unminify(code, tab = 4) {
        let space = ' '.repeat(tab);
        return code
            .split('\t').join('    ')
            .replace(/\s*{\s*/g, ' {\n    ')
            .replace(/;\s*/g, ';\n    ')
            .replace(/,\s*/g, ', ')
            .replace(/[ ]*}\s*/g, '}\n')
            .replace(/\}\s*(.+)/g, '}\n$1')
            .replace(/\n    ([^:]+):\s*/g, '\n    $1: ')
            .replace(/([A-z0-9\)])}/g, '$1;\n}');
    }

    function transformCSS(inputCSS) {
        const transformedLines = inputCSS.split('\n').map(line => {
            const regex = /^(\s*)([a-zA-Z0-9-]+)(\s*):/;
            return line.replace(regex, (match, whitespace, propertyName, spacing) => {
                return `${whitespace}--${propertyName}${spacing}:`;
            });
        });
        let styleContent = transformedLines.join('\n');
        let doc = document.implementation.createHTMLDocument(""),
            styleElement = document.createElement("style");
        styleElement.textContent = styleContent;
        doc.body.appendChild(styleElement);
        return styleElement.sheet.cssRules;
    }

    function parseAsCSS(str) {
        return transformCSS(unminify(str));
    }

    function ruleFactory(r, opts = {}) {
        const ruleObj = { selector: r.selectorText, properties: {} };
        for (let k in opts) ruleObj[k] = opts[k];
        const propNames = [];
        for (let i in r.style) if (!isNaN(i)) propNames.push(r.style[i]);
        for (let k of propNames) {
            ruleObj.properties[k.substring(2)] = r.style.getPropertyValue(k);
        }
        return ruleObj;
    }

    function parseRules(_rules) {
        if (typeof _rules === 'string') _rules = parseAsCSS(_rules);
        const rules = [];
        for (let r of _rules) {
            if (r.constructor.name === 'CSSStyleRule') {
                rules.push(ruleFactory(r));
            } else if (r.constructor.name === 'CSSMediaRule') {
                for (let _r of r.cssRules) rules.push(ruleFactory(_r, { media: r.media }));
            } else if (r.constructor.name === 'CSSSupportsRule') {
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

        let loadedCounter = 0;
        for (const sheet of sheetsTags) {
            if (sheet.hasAttribute(sheetAttribute)) {
                let url = sheet.getAttribute(sheetAttribute);
                try {
                    const response = await fetch(url);
                    const content = await response.text();
                    window.sheets[type].set(sheet, parseRules(content));
                } catch (e) { console.error(`[${type}] Erreur fetch: ${url}`, e); }
            } else {
                window.sheets[type].set(sheet, parseRules(sheet.innerHTML));
            }
            loadedCounter++;
            if (loadedCounter === sheetsTags.length) {
                reset();
                resolveReady(); // Signal de fin de chargement initial
            }
        }
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
        abstractComputedValues = null; // Invalidation du cache
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
            
            if (!initialValues.has(el)) el.dispatchEvent(new CustomEvent(type + '.resolveInitials', { bubbles: true }));
            if (initialValues.has(el)) {
                let initials = initialValues.get(el);
                for (let k in initials) {
                    if (typeof rulesToApply[k] === 'undefined' || rulesToApply[k] === 'initial') rulesToApply[k] = initials[k];
                }
            }
            currentValues.set(el, rulesToApply);
        }

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

    // Observer pour les feuilles ajoutées dynamiquement
    const observer = new MutationObserver((mutations) => {
        let reload = false;
        mutations.forEach(m => {
            [...m.addedNodes, ...m.removedNodes].forEach(n => {
                if (n.nodeType === 1 && (n.matches(sheetsSelector) || n.querySelector(sheetsSelector))) reload = true;
            });
        });
        if (reload) loadSheets();
    });

    const init = () => {
        loadSheets();
        observer.observe(document.documentElement, { childList: true, subtree: true });
    };

    if (document.readyState === 'loading') document.addEventListener("DOMContentLoaded", init);
    else init();

    const HTMLElementExtension = {
        getInitial: (el) => (k = null) => {
            const props = initialValues.get(el) || {};
            return k ? props[k] : props;
        },
        getComputed: (el) => (k = null) => {
            const props = currentValues.get(el) || {};
            return k ? props[k] : props;
        },
        initials: (el) => HTMLElementExtension.getInitial(el)(),
        computed: (el) => HTMLElementExtension.getComputed(el)()
    };

    Object.defineProperty(HTMLElement.prototype, type, {
        get: function() {
            const self = this;
            return {
                get initials() { return HTMLElementExtension.initials(self); },
                get computed() { return HTMLElementExtension.computed(self); }
            };
        },
        configurable: true
    });

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
