/**
 * NodeCache - Gestionnaire de fragments vivants.
 */
const NodeCache = (() => {
    const registry = new Map();

    // Capture les enfants d'un élément dans son fragment dédié
    const capture = (el) => {
        const key = el.getAttribute('nav-cache');
        if (!key) return;
        
        if (!registry.has(key)) registry.set(key, document.createDocumentFragment());
        const fragment = registry.get(key);
        
        while (el.firstChild) {
            fragment.appendChild(el.firstChild);
        }
    };

    // Capture récursivement tous les éléments porteurs de nav-cache dans un conteneur
    const captureAll = (container) => {
        const elements = container.querySelectorAll('[nav-cache]');
        // On capture du plus profond au plus haut pour préserver la structure
        Array.from(elements).reverse().forEach(el => capture(el));
        // Si le container lui-même a un cache
        if (container.hasAttribute('nav-cache')) capture(container);
    };

    const getValidKeys = () => Array.from(registry.keys());

    return { registry, capture, captureAll, getValidKeys };
})();

window.NodeCache = NodeCache;
