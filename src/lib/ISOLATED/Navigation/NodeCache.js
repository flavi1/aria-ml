/**
 * NodeCache - Gestionnaire de persistance de nœuds DOM AriaML.
 */
const NodeCache = (() => {
    const registry = new Map();

    /**
     * Assure l'existence d'un fragment pour une clé et y déplace les enfants.
     */
    const capture = (el) => {
        const key = el.getAttribute('nav-cache');
        if (!key) return;

        let fragment = registry.get(key);
        if (!(fragment instanceof DocumentFragment)) {
            fragment = document.createDocumentFragment();
            registry.set(key, fragment);
        }

        // On transplante les enfants réels vers le fragment de stockage
        //appendChild déplace le nœud, il ne le clone pas.
        while (el.firstChild) {
            fragment.appendChild(el.firstChild);
        }
    };

    /**
     * Enregistre un élément. Si c'est un nouvel élément avec nav-cache, 
     * on prépare son fragment dans le registre.
     */
    const register = (el) => {
        if (el.nodeType !== 1) return;

        const elements = el.hasAttribute('nav-cache') 
            ? [el, ...el.querySelectorAll('[nav-cache]')]
            : el.querySelectorAll('[nav-cache]');

        elements.forEach(node => {
            const key = node.getAttribute('nav-cache');
            if (key && !registry.has(key)) {
                // Initialise un fragment vide pour cette clé
                registry.set(key, document.createDocumentFragment());
            }
        });
    };

    const getValidKeys = () => {
        // Une clé est valide si elle est dans le Map
        return Array.from(registry.keys());
    };

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            mutation.addedNodes.forEach(node => register(node));
        }
    });

    observer.observe(document.documentElement, { 
        childList: true, 
        subtree: true 
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => register(document.documentElement));
    } else {
        register(document.documentElement);
    }

    return {
        registry,
        getValidKeys,
        capture,
        register
    };
})();

window.NodeCache = NodeCache;
