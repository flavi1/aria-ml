/**
 * Observers.js : Synchronisation miroir et gestion du cycle de vie
 */

let isSyncing = false; // Corrigé : Doublon supprimé

/**
 * 1. OBSERVER DU DOM (Vers document.model)
 */
const domObserver = new MutationObserver((mutations) => {
    if (isSyncing) return;
    mutations.forEach(mutation => {
        const target = mutation.target;
        if (target.nodeName === 'SCRIPT' && target.hasAttribute('model')) {
            syncModelNode(target);
        }
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => {
                if (node.nodeName === 'SCRIPT' && node.hasAttribute('model')) {
                    syncModelNode(node);
                }
            });
        }
    });
});

/**
 * 2. OBSERVER DU MODÈLE (Vers le DOM & Déclenchement du Rendu)
 */
const modelObserver = new MutationObserver((mutations) => {
    if (isSyncing) return;
    isSyncing = true;

    try {
        const rootChildren = Array.from(document.model.documentElement.childNodes)
                                 .filter(n => n.nodeType === 1);
        
        rootChildren.forEach(xmlNode => {
            const id = xmlNode.nodeName;
            let script = document.getElementById(id);
            
            if (!script) {
                script = document.createElement('script');
                script.id = id;
                script.setAttribute('type', 'json');
                script.setAttribute('model', '');
                (document.querySelector('aria-ml') || document.body).appendChild(script);
            }

            Array.from(xmlNode.attributes).forEach(attr => {
                const dataName = `data-${attr.name}`;
                if (script.getAttribute(dataName) !== attr.value) {
                    script.setAttribute(dataName, attr.value);
                }
            });

            const type = script.getAttribute('type') || 'json';
            let newContent = type.includes('json') 
                ? JSON.stringify(xmlToJSON(xmlNode, true), null, 4)
                : new XMLSerializer().serializeToString(xmlNode);

            if (script.textContent !== newContent) {
                script.textContent = newContent;
            }
        });

        if (typeof render === 'function') {
            render(document.querySelector('aria-ml') || document.body);
        }

    } finally {
        setTimeout(() => { isSyncing = false; }, 0);
    }
});

/**
 * 3. GESTION DE L'AUTO-ÉDITION (DOM -> Modèle)
 */
document.addEventListener('input', (e) => {
    const el = e.target;
    const refPath = el.getAttribute('ref');
    if (!refPath || isSyncing) return;

    // Utilisation de _XPathContext pour supporter les chemins relatifs
    const targetNode = evaluateXPath(refPath, el._XPathContext || document.model.documentElement);

    if (targetNode instanceof Node) {
        const newValue = el.type === 'checkbox' ? (el.checked ? "true" : "false") : el.value;
        if (targetNode.textContent !== newValue) {
            targetNode.textContent = newValue;
        }
    }
});

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
 * 4. OBSERVER DU DATABINDING
 */
const dataBindingObserver = new MutationObserver((mutations) => {
    if (isSyncing) return;

    mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) {
                    if (node.hasAttribute('ref') || node.hasAttribute('each') || node.querySelector('[ref], [each]')) {
                        compileTemplates(node);
                        render(node, node._XPathContext || document.model.documentElement);
                    }
                }
            });
        }
        if (mutation.type === 'attributes') {
            const target = mutation.target;
            compileTemplates(target);
            render(target, target._XPathContext || document.model.documentElement);
        }
    });
});

/**
 * PHASE 1 : Initialisation du Modèle (Immédiat)
 */
const initModel = () => {
    if (typeof document.model === 'undefined') {
        document.model = document.implementation.createDocument(null, "model");
    }

    isSyncing = true;
    document.querySelectorAll('script[model]').forEach(script => {
        syncModelNode(script);
    });

    domObserver.observe(document.documentElement, {
        childList: true, subtree: true, attributes: true,
        attributeFilter: ['model', 'type', 'id']
    });

    modelObserver.observe(document.model.documentElement, {
        childList: true, subtree: true, attributes: true, characterData: true
    });

    setTimeout(() => { isSyncing = false; }, 0);
};

/**
 * PHASE 2 : Initialisation du DataBinding (Sur DOM Ready)
 */
const initDOMBinding = () => {
    const ariaRoot = document.querySelector('aria-ml') || document.body;
    window.dispatchEvent(new CustomEvent('model-ready'));
    dataBindingObserver.observe(ariaRoot, {
        childList: true, subtree: true, attributes: true,
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
