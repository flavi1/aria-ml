/**
 * AriaML Behavior Resolvers
 * Version 1.4.4 - Relation-First Priority & Typed Returns
 * Fix: Empêche la confusion entre sélecteurs CSS et Relations AriaML
 */
const behaviorResolvers = (() => {
    // Niveau de log : 0: Off, 1: Error, 2: Info (Chains), 3: Debug (Segments)
    const LOG_LEVEL = window.ARIAML_LOG_LEVEL || 2;

    const log = (level, ...args) => {
        if (level <= LOG_LEVEL) {
            const colors = { 1: '🔴', 2: '🔵', 3: '🟢' };
            console.log(`${colors[level] || ''} [AriaML Resolver]`, ...args);
        }
    };

    const povMap = {
        'root': () => document.querySelector('body > aria-ml') ?? document.documentElement,
        'self': (el) => el,
        'parent': (el) => el.parentElement,
        'branch': (el) => el.parentElement ? el.parentElement.children : [],
        'first': (el) => el.parentElement ? el.parentElement.children[0] : null,
        'last': (el) => { 
            const c = el.parentElement ? el.parentElement.children : []; 
            return c.length > 0 ? c[c.length - 1] : null; 
        },
        'siblings': (el, filter) => {
            if (!el.parentElement) return [];
            return Array.from(el.parentElement.children).filter(s => s !== el && (!filter || s.matches(filter)));
        },
        'closest': (el, filter) => el.closest(filter),
        'next': (el) => el.nextElementSibling,
        'prev': (el) => el.previousElementSibling
    };

    /**
     * Résout les variables {attribut} sur l'élément source.
     */
    const interpolate = (el, path) => {
        if (typeof path !== 'string') return path;
        return path.replace(/\{(.*?)\}/g, (_, attr) => {
            const val = el.getAttribute(attr) || "";
            log(3, `Interpolation {${attr}} -> "${val}"`);
            return val;
        });
    };

    const resolveSegment = (el, segmentStr) => {
        let pov = el;
        let selector = segmentStr.trim();

        if (selector.startsWith('(')) {
            const endPov = selector.indexOf(')');
            const povToken = selector.slice(1, endPov).trim();
            selector = selector.slice(endPov + 1).trim();
            
            const [key, ...argParts] = povToken.split(':');
            const arg = argParts.join(':').trim();
            
            if (povMap[key]) {
                pov = povMap[key](el, arg);
                log(3, `POV "${key}" resolved`, pov);
            }
        }

        if (!pov) return [];
        
        const povElements = (typeof pov[Symbol.iterator] === 'function' && !(pov instanceof HTMLElement)) 
            ? Array.from(pov) : [pov];

        if (!selector) return povElements;

        const results = [];
        povElements.forEach(item => {
            if (!item.querySelectorAll) return;
            try {
                // Utilisation de scope pour limiter la recherche aux descendants directs si besoin
                const matches = item.querySelectorAll(selector);
                results.push(...Array.from(matches));
            } catch (e) { log(1, "Invalid selector", selector); }
        });
        return results;
    };

    /**
     * Cœur de la résolution de chaîne
     * Retourne désormais une collection typée pour behaviorActions
     */
    const resolveChain = (startEl, chainStr) => {
        if (!chainStr) return { nodes: [startEl], type: 'nodes', name: 'self' };

        log(2, `Resolving chain: "${chainStr}" from`, startEl);

        const interpolated = interpolate(startEl, chainStr);
        const segments = interpolated.split(/\.(?![^()]*\))/);
        let currentElements = [startEl];
        let lastSegmentName = 'self';

        for (const segment of segments) {
            lastSegmentName = segment;
            log(3, `Processing segment: "${segment}"`);
            let nextElements = [];

            for (const el of currentElements) {
                // IMPORTANT : On utilise behaviorCore.getResolvedProps pour prendre en compte les Patterns
                const props = (window.behaviorCore) ? behaviorCore.getResolvedProps(el) : (el.behavior?.computed || {});
                
                // Priorité 1 : Alias de relation explicite (rel-xxx)
                const relDef = props[`rel-${segment}`];
                
                if (relDef) {
                    log(3, `Found relation alias "rel-${segment}" -> "${relDef}"`);
                    // Récursion pour résoudre la définition de la relation
                    const result = resolveChain(el, relDef);
                    nextElements.push(...result.nodes);
                } 
                // Priorité 2 : Mot-clé interne
                else if (segment === 'self') {
                    nextElements.push(el);
                } 
                // Priorité 3 : Sélecteur CSS / XPath simulé
                else {
                    nextElements.push(...resolveSegment(el, segment));
                }
            }

            currentElements = [...new Set(nextElements)];
            if (currentElements.length === 0) {
                log(2, `Chain broken at segment: "${segment}"`);
                break;
            }
        }
        
        log(2, `Chain resolved to ${currentElements.length} node(s)`);
        
        // On retourne l'objet structuré que behaviorActions attend
        return {
            nodes: currentElements,
            type: 'nodes',
            name: lastSegmentName
        };
    };

    return { resolveChain };
})();
