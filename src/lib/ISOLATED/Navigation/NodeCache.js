/**
 * NodeCache - Gestionnaire de persistance de nœuds DOM AriaML.
 */
const NodeCache = (() => {
    const registry = new Map();

    /**
     * Enregistre un élément et ses enfants porteurs de l'attribut live-cache.
     */
    const register = (el) => {
        if (el.nodeType !== 1) return;

        const elements = el.hasAttribute('live-cache') 
            ? [el, ...el.querySelectorAll('[live-cache]')]
            : el.querySelectorAll('[live-cache]');

        elements.forEach(node => {
            const key = node.getAttribute('live-cache');
            // On ne stocke que si la clé n'existe pas ENCORE
            // Cela préserve l'instance originale (état, scroll, event listeners)
            if (key && !registry.has(key)) {
                registry.set(key, node);
            }
        });
    };

    /**
     * Retourne la liste des clés pour le header HTTP Live-Cache.
     * Filtre les références qui ne sont plus des HTMLElement valides.
     */
    const getValidKeys = () => {
        for (const [key, node] of registry) {
            if (!(node instanceof HTMLElement)) {
                registry.delete(key);
            }
        }
        return Array.from(registry.keys());
    };

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            // On observe les ajouts de nœuds pour peupler le cache dynamiquement
            mutation.addedNodes.forEach(node => register(node));
        }
    });

    // L'observation commence immédiatement sur le document
    observer.observe(document.documentElement, { 
        childList: true, 
        subtree: true 
    });

    // Initialisation sur le contenu existant (SSR)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => register(document.documentElement));
    } else {
        register(document.documentElement);
    }

    return {
        registry,
        getValidKeys
    };
})();

window.NodeCache = NodeCache;
