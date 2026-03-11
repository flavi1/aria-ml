/**
 * DataBinding.js
 */


const ModelBoundNodes = new Map();

// Extension de la Map pour gérer les mises à jour ciblées
ModelBoundNodes.updateBinding = function(xmlNode) {
    if (this.has(xmlNode)) {
        const elements = this.get(xmlNode);
        elements.forEach(el => {
            // Sécurité anti-fuite : on retire les éléments qui ne sont plus dans le DOM
            if (!el.isConnected) {
                elements.delete(el);
            } else {
                syncNodeValue(el, xmlNode);
            }
        });
    }
};

Node.prototype.getBindedNodes = function() {
    return ModelBoundNodes.has(this) ? Array.from(ModelBoundNodes.get(this)) : [];
};

/**
 * Extension AriaML : Liaison intelligente et enregistrement
 */
HTMLElement.prototype.bindNode = function(target) {
    if (!target) return;

    const boundNode = (target instanceof NodeList || Array.isArray(target)) 
        ? target[0] 
        : target;

    if (!boundNode) return;
    
    // 1. Enregistrement de la liaison DOM HTML <-> Noeud XML
    if (!ModelBoundNodes.has(boundNode)) {
        ModelBoundNodes.set(boundNode, new Set());
    }
    ModelBoundNodes.get(boundNode).add(this);

    // 2. Synchronisation de la valeur initiale
    syncNodeValue(this, boundNode);
};


/**
 * 2. UTILITAIRES XPATH
 */
const evaluateXPath = (path, contextNode) => {
    try {
        const doc = contextNode.ownerDocument || contextNode;
        const result = doc.evaluate(path, contextNode, null, XPathResult.ANY_TYPE, null);
        
        switch (result.resultType) {
            case XPathResult.STRING_TYPE: return result.stringValue;
            case XPathResult.NUMBER_TYPE: return result.numberValue;
            case XPathResult.BOOLEAN_TYPE: return result.booleanValue;
            case XPathResult.UNORDERED_NODE_ITERATOR_TYPE: {
                const nodes = [];
                let n;
                while (n = result.iterateNext()) nodes.push(n);
                return nodes;
            }
            case XPathResult.FIRST_ORDERED_NODE_TYPE: return result.singleNodeValue;
            default: return null;
        }
    } catch (e) {
        console.warn(`AriaML XPath Error: ${path}`, e);
        return null;
    }
};


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



/**
 * 4. INITIALISATION DU BINDING
 */
const initDataBinding = () => {
    const ariaRoot = document.querySelector('aria-ml') || document.documentElement;
    const state = ariaRoot.getAttribute('dom-state') || 'dry';

    compileTemplates(ariaRoot);

    if (state === 'dry') {
        render(ariaRoot);
        ariaRoot.setAttribute('dom-state', 'hydrated');
    }
    
    console.log("AriaML: DataBinding Hydrated.");
};

window.addEventListener('model-ready', initDataBinding);
