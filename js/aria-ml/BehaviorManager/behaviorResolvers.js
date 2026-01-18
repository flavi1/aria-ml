/**
 * AriaML Behavior Resolvers
 * Responsable du parsing, du chaînage des relations (POV) et de l'interpolation.
 */
const behaviorResolvers = (() => {

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
     * Résout les moustaches {{attribut}} sur l'élément source.
     */
    const interpolate = (el, path) => {
        return path.replace(/\{\{(.*?)\}\}/g, (_, attr) => el.getAttribute(attr) || "");
    };

    const resolveSegment = (el, segmentStr) => {
        let pov = el;
        let selector = segmentStr.trim();

        // Analyse du Point de Vue (POV) entre parenthèses
        if (selector.startsWith('(')) {
            const endPov = selector.indexOf(')');
            const povToken = selector.slice(1, endPov).trim();
            selector = selector.slice(endPov + 1).trim();
            
            const [key, ...argParts] = povToken.split(':');
            const arg = argParts.join(':').trim();
            
            if (povMap[key]) pov = povMap[key](el, arg);
        }

        if (!pov) return [];
        
        // Normalisation en tableau (gère HTMLElement, HTMLCollection, Array)
        const povElements = (typeof pov[Symbol.iterator] === 'function' && !(pov instanceof HTMLElement)) 
            ? Array.from(pov) : [pov];

        if (!selector) return povElements;

        const results = [];
        povElements.forEach(item => {
            if (!item.querySelectorAll) return;
            // Utilisation de :scope pour garantir que le sélecteur s'applique relativement à l'élément du POV
            try {
                const matches = item.querySelectorAll(':scope ' + selector);
                results.push(...Array.from(matches));
            } catch (e) { console.warn("AriaML: Invalid selector", selector); }
        });
        return results;
    };

    const resolveChain = (startEl, chainStr) => {
        if (!chainStr) return [startEl];

        // 1. Interpolation des variables {{attr}}
        const interpolated = interpolate(startEl, chainStr);

        // 2. Découpage par points (uniquement hors parenthèses)
        const segments = interpolated.split(/\.(?![^()]*\))/);
        let currentElements = [startEl];

        for (const segment of segments) {
            let nextElements = [];
            for (const el of currentElements) {
                // Priorité 1 : Relation nommée via le Proxy .behavior (remplace .definition)
                const relDef = el.behavior[`rel-${segment}`] || el.behavior[segment];
                
                if (relDef) {
                    // Si c'est une relation, on résout son propre chemin
                    nextElements.push(...resolveChain(el, relDef));
                } 
                else if (segment === 'self') {
                    nextElements.push(el);
                } 
                else {
                    // Priorité 2 : Navigation structurelle ou Sélecteur CSS
                    nextElements.push(...resolveSegment(el, segment));
                }
            }
            currentElements = [...new Set(nextElements)];
            if (currentElements.length === 0) break;
        }
        return currentElements;
    };

    return { resolveChain };
})();
