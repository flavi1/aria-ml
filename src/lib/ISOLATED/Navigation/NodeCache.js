/**
 * NodeCache - Gestionnaire de fragments.
 */
const NodeCache = (() => {
    const registry = new Map();

    const capture = (el) => {
        const key = el.getAttribute('nav-cache');
        if (!key) return;
        
        if (!registry.has(key)) registry.set(key, document.createDocumentFragment());
        const fragment = registry.get(key);
        
        // On vide le fragment existant s'il y en avait un (pour rafraîchir le vivant)
        while (fragment.firstChild) fragment.removeChild(fragment.firstChild);
        
        // On déplace les enfants actuels vers le fragment
        while (el.firstChild) {
            fragment.appendChild(el.firstChild);
        }
    };

    const captureAll = (container) => {
        // On cherche tous les éléments avec nav-cache
        const elements = Array.from(container.querySelectorAll('[nav-cache]'));
        // IMPORTANT : On capture du plus profond au plus haut (.reverse())
        // Ainsi, 'test' est capturé avant 'home'.
        elements.reverse().forEach(el => capture(el));
        
        // Enfin on capture le container lui-même s'il est caché
        if (container.hasAttribute('nav-cache')) capture(container);
    };

    const getValidKeys = () => Array.from(registry.keys());

    return { registry, capture, captureAll, getValidKeys };
})();

window.NodeCache = NodeCache;
