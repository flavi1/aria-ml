/**
 * GlobalSheetParser v2.0 - "CSS Native Engine"
 * Injecte les comportements dans le DOM et laisse le navigateur calculer les styles.
 */
const GlobalSheetParser = (type, sheetsSelector, sheetAttribute, PREFIX = '---BHV-') => {
	
	if (!(type in HTMLElement.prototype)) {
        try {
            Object.defineProperty(HTMLElement.prototype, type, {
                get: function() {
                    const el = this;
                    const storageKey = '_last_' + type;
                    
                    // Note : on ne calcule getComputedStyle que si on en a besoin
                    return {
                        get computed() {
                            const style = getComputedStyle(el);
                            const props = {};
                            for (let i = 0; i < style.length; i++) {
                                const propName = style[i];
                                if (propName.startsWith(PREFIX)) {
                                    const cleanKey = propName.substring(PREFIX.length);
                                    props[cleanKey] = style.getPropertyValue(propName).trim().replace(/^["']|["']$/g, '');
                                }
                            }
                            return props;
                        },
                        hasChanged: function() {
                            const current = JSON.stringify(this.computed);
                            if (el[storageKey] === current) return false;
                            el[storageKey] = current;
                            return true;
                        }
                    };
                },
                configurable: true,
                enumerable: false // On évite de polluer les boucles for...in
            });
        } catch (e) {
            console.error(`[AriaML] Impossible de définir la propriété ${type}:`, e);
        }
    }
	
    const polyfillContainer = document.getElementById(PREFIX + 'polyfill') || (() => {
        const div = document.createElement('div');
        div.id = PREFIX + 'polyfill';
        div.hidden = true;
        document.body.appendChild(div);
        return div;
    })();

    const transformAndInject = (css, id) => {
		// Nettoyage des commentaire pour éviter les faux positifs.
        let cleanCSS = css.replace(/\/\*[\s\S]*?\*\//g, '');
        // On préfixe toutes les propriétés qui ne commencent pas par un tiret
        const regex = /([\{\;])\s*([a-zA-Z][a-zA-Z0-9-]+)\s*:/g;
        const transformed = cleanCSS.replace(regex, (match, separator, prop) => `${separator}${PREFIX}${prop}:`);
        
        let styleEl = document.getElementById(`style-${id}`);
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = `style-${id}`;
            polyfillContainer.appendChild(styleEl);
        }
        styleEl.textContent = transformed;
    };

    const load = async () => {
        const sheets = document.querySelectorAll(sheetsSelector);
        for (let [idx, sheet] of sheets.entries()) {
            let content = "";
            if (sheet.hasAttribute(sheetAttribute)) {
                try {
                    const res = await fetch(sheet.getAttribute(sheetAttribute));
                    content = await res.text();
                } catch (e) { console.error("Load error", e); }
            } else {
                content = sheet.textContent;
            }
            if (content) transformAndInject(content, idx);
        }
    };

    load();
    
    new MutationObserver(() => load()).observe(document.head, { childList: true, subtree: true });

    return { refresh: load, ready: Promise.resolve() };
};
