/**
 * Observers.js : Synchronisation miroir et gestion du cycle de vie
 */

let isSyncing = false;

let isSyncing = false;

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
        // A. Mise à jour des scripts de stockage (Miroir)
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

        // B. DÉCLENCHEMENT DU RENDU (DataBinding.js)
        if (typeof render === 'function') {
            render(document.querySelector('aria-ml') || document.body);
        }

    } finally {
        setTimeout(() => { isSyncing = false; }, 0);
    }
});

/**
 * 3. GESTION DE L'AUTO-ÉDITION (DOM -> Modèle)
 * Écoute globale des saisies pour les éléments avec [ref]
 */
document.addEventListener('input', (e) => {
    const el = e.target;
    const refPath = el.getAttribute('ref');
    if (!refPath || isSyncing) return;

    // On récupère le contexte XPath (parent le plus proche avec ref/each)
    const parentEl = el.parentElement?.closest('[ref], [each]');
    // Note: Pour simplifier ici, on utilise evaluateXPath (doit être global ou importé)
    // Mais le plus direct est de trouver le noeud XML cible
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
 * 4. OBSERVER DU DATABINDING (Surveillance des directives HTML)
 * Déclenche le rendu pour les nouveaux éléments injectés dans le DOM.
 */
const dataBindingObserver = new MutationObserver((mutations) => {
    if (isSyncing) return;

    mutations.forEach(mutation => {
        // Détection de nouveaux éléments ajoutés
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) {
                    // Si l'élément lui-même ou ses enfants ont des directives
                    if (node.hasAttribute('ref') || node.hasAttribute('each') || node.querySelector('[ref], [each]')) {
                        compileTemplates(node);
                        render(node, node._XPathContext || document.model.documentElement);
                    }
                }
            });
        }
        // Détection de l'ajout d'un attribut ref/each sur un élément existant
        if (mutation.type === 'attributes') {
            const target = mutation.target;
            compileTemplates(target);
            render(target, target._XPathContext || document.model.documentElement);
        }
    });
});

/**
 * PHASE 1 : Initialisation du Modèle (Aussi tôt que possible)
 */
const initModel = () => {
    if (typeof document.model === 'undefined') {
        document.model = document.implementation.createDocument(null, "model");
    }

    isSyncing = true;

    // Import initial des données (scripts déjà présents dans le DOM à cet instant)
    document.querySelectorAll('script[model]').forEach(script => {
        syncModelNode(script);
    });

    // Activation immédiate de la synchronisation Modèle <-> Scripts
    domObserver.observe(document.documentElement, {
        childList: true, subtree: true, attributes: true,
        attributeFilter: ['model', 'type', 'id']
    });

    modelObserver.observe(document.model.documentElement, {
        childList: true, subtree: true, attributes: true, characterData: true
    });

    // On libère le verrou après le premier cycle de sync
    setTimeout(() => { isSyncing = false; }, 0);
};

/**
 * PHASE 2 : Initialisation du DataBinding (Sur DOM Ready)
 */
const initDOMBinding = () => {
    const ariaRoot = document.querySelector('aria-ml') || document.body;
    
    // 1. Signalement pour DataBinding.js (Rendu initial si dom-state="dry")
    window.dispatchEvent(new CustomEvent('model-ready'));

    // 2. Activation de la surveillance des directives HTML
    dataBindingObserver.observe(ariaRoot, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['ref', 'each']
    });

    console.log("AriaML: DOM Binding actif.");
};

/**
 * EXÉCUTION DU CYCLE DE VIE
 */
// On lance le modèle immédiatement
initModel();

// On lance le binding DOM quand l'arbre est prêt
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDOMBinding);
} else {
    initDOMBinding();
}
