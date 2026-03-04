/**
 * DataBinding.js : Synchronisation miroir optimisée
 */

let isSyncing = false;

/**
 * 1. OBSERVER DU DOM (Vers document.model)
 */
const domObserver = new MutationObserver((mutations) => {
    if (isSyncing) return;
    
    mutations.forEach(mutation => {
        const target = mutation.target;
        // Détection sur le script lui-même (attributs ou texte)
        if (target.nodeName === 'SCRIPT' && target.hasAttribute('model')) {
            syncModelNode(target);
        }
        
        // Détection de nouveaux scripts injectés
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
 * 2. OBSERVER DU MODÈLE (Vers le DOM)
 */
const modelObserver = new MutationObserver((mutations) => {
    if (isSyncing) return;
    isSyncing = true;

    try {
        mutations.forEach(mutation => {
            // On cible toujours les enfants directs de <model>
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
                    const container = document.querySelector('aria-ml') || document.body;
                    container.appendChild(script);
                }

                // Sync Attributs : XML -> Script (data-*)
                Array.from(xmlNode.attributes).forEach(attr => {
                    const dataName = `data-${attr.name}`;
                    if (script.getAttribute(dataName) !== attr.value) {
                        script.setAttribute(dataName, attr.value);
                    }
                });

                // Sync Contenu : XML -> Script (JSON/XML)
                const type = script.getAttribute('type') || 'json';
                let newContent = "";
                
                if (type.includes('json')) {
                    newContent = JSON.stringify(xmlToJSON(xmlNode, true), null, 4);
                } else if (type.includes('xml')) {
                    newContent = new XMLSerializer().serializeToString(xmlNode);
                }

                if (script.textContent !== newContent) {
                    script.textContent = newContent;
                }
            });
        });
    } finally {
        // Timeout pour s'assurer que les événements de mutation DOM générés 
        // par ces écritures soient ignorés par domObserver
        setTimeout(() => { isSyncing = false; }, 0);
    }
});


/**
 * UTILITAIRE : xmlToJSON (Version Corrigée)
 * @param {Node} node - Le nœud XML à convertir
 * @param {Boolean} isRoot - Si vrai, ignore les attributs (déjà portés par data- sur le script)
 */
function xmlToJSON(node, isRoot = false) {
    let obj = {};
    
    // Gestion des attributs dans le JSON
    // Si ce n'est pas la racine, les attributs XML deviennent des @key
    if (!isRoot) {
        Array.from(node.attributes).forEach(attr => {
            obj[`@${attr.name}`] = attr.value;
        });
    }

    // Traitement des enfants
    Array.from(node.childNodes).forEach(child => {
        if (child.nodeType === 1) {
            const key = child.nodeName;
            // Récursion : isRoot passe à false pour tous les enfants
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
        ? node.textContent 
        : obj;
}

/**
 * INITIALISATION SÉCURISÉE
 */
const init = () => {
    if (typeof document.model === 'undefined') {
        document.model = document.implementation.createDocument(null, "model");
    }

    // 1. Verrouiller pour l'import initial
    isSyncing = true;

    // 2. Importer les scripts existants dans le modèle
    document.querySelectorAll('script[model]').forEach(script => {
        syncModelNode(script);
    });

    // 3. Activer les observers
    domObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['model', 'type', 'id']
    });

    modelObserver.observe(document.model.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true
    });

    // 4. Libérer le verrou
    setTimeout(() => { isSyncing = false; }, 0);
    console.log("AriaML: DataBinding initialisé.");
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
