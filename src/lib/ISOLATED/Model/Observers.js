/**
 * Observers.js
 */






/**
 * UTILITAIRE : xmlToJSON
 */
function xmlToJSON(node, isRoot = false) {
    let obj = {};
    if (!isRoot) {
        Array.from(node.attributes).forEach(attr => { obj[`@${attr.name}`] = attr.value; });
    }
    Array.from(node.childNodes).forEach(child => {
        if (child.nodeType === 1) {
            const key = child.nodeName;
            const value = (child.childElementCount > 0 || child.attributes.length > 0) 
                ? xmlToJSON(child, false) 
                : child.textContent;
            
            if (key === 'item') {
                if (!Array.isArray(obj)) obj = [];
                obj.push(value);
            } else {
                obj[key] = value;
            }
        }
    });
    return (Object.keys(obj).length === 0 && node.textContent && !Array.isArray(obj)) 
        ? node.textContent : obj;
}


/**
 * PHASE 1 : Initialisation du Modèle (Immédiat)
 */
const initModel = () => {
    if (typeof document.model === 'undefined') {
        createModel();
    }

    document.model.isSyncing = true;
    document.querySelectorAll('script[model]').forEach(script => {
        syncModelNode(script);
    });

    domObserver.observe(document.documentElement, {
        childList: true, subtree: true, attributes: true,
        attributeFilter: ['model', 'type', 'id']
    });

console.log(document.model.dom)

    modelObserver.observe(document.model.dom, {
        childList: true, subtree: true, attributes: true, characterData: true
    });

    setTimeout(() => { document.model.isSyncing = false; }, 0);
};

/**
 * PHASE 2 : Initialisation du DataBinding (Sur DOM Ready)
 */
const initDOMBinding = () => {
    const ariaRoot = document.querySelector('aria-ml') || document.body;
    window.dispatchEvent(new CustomEvent('model-ready'));
    dataBindingObserver.observe(ariaRoot, {
        childList: true, subtree: true, attributes: true, attributeOldValue: true,
        attributeFilter: ['ref', 'each']
    });
    console.log("AriaML: DOM Binding actif.");
};

initModel();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDOMBinding);
} else {
    initDOMBinding();
}
