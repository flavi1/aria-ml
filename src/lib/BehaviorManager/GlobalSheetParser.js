 /**
 * AriaML GlobalSheetParser.js
 * Version stabilisée pour AriaML v1.4
 */
const GlobalSheetParser = (type, sheetsSelector, sheetAttribute) => {
    
    if (typeof window.sheets === 'undefined') {
        window.sheets = {};
    }

    function parseAsCSS(str) {
        function unminify(code, tab) {
            const defaultTab = 4;
            let space = '';

            if (typeof tab === 'string')
                tab = /^\d+$/.test(tab) ? parseInt(tab) : defaultTab;
            if (typeof tab === 'undefined')
                tab = defaultTab;
            if (tab < 0)
                tab = defaultTab;

            code = code
                .split('\t').join('    ')
                .replace(/\s*{\s*/g, ' {\n    ')
                .replace(/;\s*/g, ';\n    ')
                .replace(/,\s*/g, ', ')
                .replace(/[ ]*}\s*/g, '}\n')
                .replace(/\}\s*(.+)/g, '}\n$1')
                .replace(/\n    ([^:]+):\s*/g, '\n    $1: ')
                .replace(/([A-z0-9\)])}/g, '$1;\n}');

            if (tab !== 4) {
                for (; tab !== 0; tab--) { space += ' '; }
                code = code.replace(/\n    /g, '\n' + space);
            }
            return code;
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

        return transformCSS(unminify(str));
    }

    function ruleFactory(r, opts = {}) {
        const ruleObj = {
            selector: r.selectorText,
            properties: {}
        };
        for (let k in opts) ruleObj[k] = opts[k];
        
        const propNames = [];
        for (let i in r.style) if (!isNaN(i)) propNames.push(r.style[i]);
        for (let k of propNames) {
            ruleObj.properties[k.substring(2)] = r.style.getPropertyValue(k);
        }
        return ruleObj;
    }

    function parseRules(_rules) {
        if (typeof _rules === 'string')
            _rules = parseAsCSS(_rules);
        
        const rules = [];
        for (let r of _rules) {
            if (r.constructor.name === 'CSSStyleRule') {
                rules.push(ruleFactory(r));
            } else if (r.constructor.name === 'CSSMediaRule') {
                for (let _r of r.cssRules)
                    rules.push(ruleFactory(_r, { media: r.media }));
            } else if (r.constructor.name === 'CSSSupportsRule') {
                for (let _r of r.cssRules)
                    rules.push(ruleFactory(_r, { support: r.conditionText }));
            }
        }
        return rules;
    }

    function loadSheets() {
        window.sheets[type] = new Map();
        let loadedCounter = 0;
        const sheetsTags = document.querySelectorAll(sheetsSelector);
        
        if (sheetsTags.length === 0) return;

        sheetsTags.forEach(async (sheet) => {
            if (!window.sheets[type].has(sheet)) {
                if (sheet.hasAttribute(sheetAttribute)) {
                    let url = sheet.getAttribute(sheetAttribute);
                    try {
                        const response = await fetch(url);
                        const content = await response.text();
                        window.sheets[type].set(sheet, parseRules(content));
                    } catch (error) {
                        // Erreur fetch silencieuse
                    } finally {
                        if (++loadedCounter === sheetsTags.length) reset();
                    }
                } else {
                    window.sheets[type].set(sheet, parseRules(sheet.innerHTML));
                    if (++loadedCounter === sheetsTags.length) reset();
                }
            } else {
                loadedCounter++;
            }
        });
    }

    let abstractComputedValues = null;
    const initialValues = new Map();
    let currentValues = new Map();
    const MQObservers = {};

    function observeMQ(mediaText, MQL) {
        if (typeof MQObservers[mediaText] === 'undefined') {
            MQL.addEventListener('change', refresh);
            MQObservers[mediaText] = MQL;
        }
    }

    function refresh() {
        document.dispatchEvent(new CustomEvent(type + '.refresh', { bubbles: true }));
        
        if (!abstractComputedValues) {
            abstractComputedValues = new Map();
            for (let [key, propList] of window.sheets[type]) {
                for (let rule of propList) {
                    try {
                        for (let el of document.querySelectorAll(rule.selector)) {
                            let collectedRules = abstractComputedValues.has(el) ? 
                                abstractComputedValues.get(el) : [];
                            collectedRules.push(rule);
                            abstractComputedValues.set(el, collectedRules);
                        }
                    } catch(e) { /* Sélecteur invalide */ }
                }
            }
        }
        
        let lastValues = new Map();
        [currentValues, lastValues] = [lastValues, currentValues];
        
        for (let [el, collectedRules] of abstractComputedValues) {
            let rulesToApply = {};
            for (let r of collectedRules) {
                let apply = true;
                if (r.media) {
                    const mq = window.matchMedia(r.media.mediaText);
                    observeMQ(r.media.mediaText, mq);
                    if (!mq.matches) apply = false;
                }
                if (r.support && apply) {
                    if (!support(r.support)) apply = false;
                }
                if (apply) {
                    for (let k in r.properties) rulesToApply[k] = r.properties[k];
                }
            }
            
            if (!initialValues.has(el))
                el.dispatchEvent(new CustomEvent(type + '.resolveInitials', { bubbles: true }));
            
            if (initialValues.has(el)) {
                let initials = initialValues.get(el);
                for (let k in initials) {
                    if (typeof rulesToApply[k] === 'undefined' || rulesToApply[k] === 'initial')
                        rulesToApply[k] = initials[k];
                }
            }
            currentValues.set(el, rulesToApply);
        }

        for (let [el, newRules] of currentValues) {
            const lastRules = lastValues.has(el) ? lastValues.get(el) : initialValues.get(el);
            el.dispatchEvent(new CustomEvent(type + '.applyRules', {
                bubbles: true, 
                detail: { lastRules: lastRules || {}, newRules }
            }));
        }
    }

    function clear() { abstractComputedValues = null; }
    function reset() { clear(); refresh(); }

    const observer = new MutationObserver((mutationsList) => {
        let shouldReload = false;
        for (let mutation of mutationsList) {
            for (let n of mutation.addedNodes) {
                if (n.nodeType === Node.ELEMENT_NODE && (n.matches(sheetsSelector) || n.querySelector(sheetsSelector))) 
                    shouldReload = true;
            }
            for (let n of mutation.removedNodes) {
                if (n.nodeType === Node.ELEMENT_NODE && (n.matches(sheetsSelector) || n.querySelector(sheetsSelector))) 
                    shouldReload = true;
            }
        }
        if (shouldReload) loadSheets();
    });

    const init = () => {
        loadSheets();
        observer.observe(document.documentElement, { childList: true, subtree: true });
    };

    if (document.readyState === 'loading') {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    const HTMLElementExtension = {
        getInitial: (el) => (k = null) => {
            if (initialValues.has(el)) {
                const properties = initialValues.get(el);
                return k ? properties[k] : properties;
            }
            return k ? undefined : {};
        },
        getComputed: (el) => (k = null) => {
            if (currentValues.has(el)) {
                const properties = currentValues.get(el);
                return k ? properties[k] : properties;
            }
            return k ? undefined : {};
        },
        initials: (el) => HTMLElementExtension.getInitial(el)(),
        computed: (el) => HTMLElementExtension.getComputed(el)()
    };

    const proxyHandler = {
        get(target, prop) {
            if (typeof HTMLElementExtension[prop] !== 'undefined')
                return HTMLElementExtension[prop](target);
            return undefined;
        }
    };

    Object.defineProperty(HTMLElement.prototype, type, {
        get: function() { return new Proxy(this, proxyHandler); },
        configurable: true
    });

    function support(conditionText) { return CSS.supports(conditionText); }
    
    return {
        setInitialValue: (el, k, v) => {
            const properties = initialValues.get(el) || {};
            if (typeof properties[k] === 'undefined') properties[k] = v;
            initialValues.set(el, properties);
        },
        initialValues,
        currentValues,
        clear,
        refresh,
        reset,
        reloadSheets: loadSheets
    };
};
