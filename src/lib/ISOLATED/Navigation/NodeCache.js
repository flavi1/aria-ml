/**
 * NodeCache - Gestionnaire de persistance de nœuds DOM.
 */
const NodeCache = (() => {
    const registry = new Map();

    const register = (el) => {
        if (el.nodeType !== 1) return;
        const key = el.getAttribute('live-cache');
        if (key && !registry.has(key)) {
            registry.set(key, el);
        }
        el.querySelectorAll('[live-cache]').forEach(child => {
            const childKey = child.getAttribute('live-cache');
            if (childKey && !registry.has(childKey)) {
                registry.set(childKey, child);
            }
        });
    };

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
            mutation.addedNodes.forEach(node => register(node));
        }
    });

    observer.observe(document.documentElement, { 
        childList: true, 
        subtree: true 
    });

    document.addEventListener('DOMContentLoaded', () => {
        register(document.documentElement);
    });

    return {
        registry,
        getValidKeys
    };
})();

window.NodeCache = NodeCache;
