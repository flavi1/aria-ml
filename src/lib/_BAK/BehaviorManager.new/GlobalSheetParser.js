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

    // Constantes de namespace basées sur le PREFIX fourni
    const INTERNAL_PROP_PREFIX = `---${PREFIX}-`; 
    const VIRTUAL_TAG_PREFIX = `${PREFIX}-`;
    const VIRTUAL_TAG_SUFFIX = '---';
    
    let resolveReady;
    const readyPromise = new Promise(resolve => { resolveReady = resolve; });

	function transformCSS(css) {
		// 0. Nettoyage
		let cleanCSS = css.replace(/\/\*[\s\S]*?\*\//g, '');
		
		// 1. Transformation des Pseudo-classes (:tab -> AGNOSTIC-tab---)
		// On cible le ":" uniquement s'il est au début d'un sélecteur
		const virtualRegex = /(^|[\{\}\;])\s*:([a-zA-Z0-9-]+)/g;
		cleanCSS = cleanCSS.replace(virtualRegex, (m, sep, name) => {
			return `${sep} ${VIRTUAL_TAG_PREFIX}${name}${VIRTUAL_TAG_SUFFIX}`;
		});

		// 2. Transformation des Propriétés (rel-tablist -> ---AGNOSTIC-rel-tablist)
		// On cherche un nom de mot-clé suivi de ":" 
		// MAIS on utilise une fonction de remplacement intelligente pour filtrer
		const propRegex = /([a-zA-Z0-9-]+)\s*:/g;
		
		let depth = 0;
		cleanCSS = cleanCSS.replace(propRegex, (match, prop) => {
			// Si la propriété est un sélecteur virtuel déjà traité (AGNOSTIC-...), on ignore
			if (prop.startsWith(VIRTUAL_TAG_PREFIX)) return match;
			
			// Sécurité : On ne préfixe QUE si on est à l'intérieur d'un bloc { ... }
			// et que ce n'est pas déjà préfixé.
			return `${INTERNAL_PROP_PREFIX}${prop}:`;
		});

		console.log(`[AriaML] CSS Final (v1.6.4) :\n`, cleanCSS);

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
            // On ne récupère que ce qui appartient au namespace AGNOSTIC
            if (name.startsWith(INTERNAL_PROP_PREFIX)) {
                let val = style.getPropertyValue(name).trim().replace(/^["']|["']$/g, '');
                ruleObj.properties.push({ 
                    key: name.substring(INTERNAL_PROP_PREFIX.length), 
                    value: val 
                });
            }
        }
        return ruleObj;
    }

    function parseRules(rulesArray) {
        const virtuals = window.sheets[type].virtualRules;
        const realRules = [];

        rulesArray.forEach(r => {
            if (!(r instanceof CSSStyleRule)) return;
            
            const selector = r.selectorText.toUpperCase();
            const prefixMatch = VIRTUAL_TAG_PREFIX.toUpperCase();
            const suffixMatch = VIRTUAL_TAG_SUFFIX.toUpperCase();

            // Identification des Virtual Rules via les marqueurs AGNOSTIC
            if (selector.startsWith(prefixMatch) && selector.endsWith(suffixMatch)) {
                const patternName = r.selectorText.slice(VIRTUAL_TAG_PREFIX.length, -VIRTUAL_TAG_SUFFIX.length);
                const props = {};
                const parsed = ruleFactory(r);
                parsed.properties.forEach(p => props[p.key] = p.value);
                virtuals.set(patternName, props);
            } else {
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
