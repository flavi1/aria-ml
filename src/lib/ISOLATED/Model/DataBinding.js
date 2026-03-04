/**
 * DataBinding.js : Synchronisation miroir entre document.model et les balises <script>
 */

let isSyncing = false; // Verrou synchrone pour éviter les boucles d'observation

/**
 * 1. OBSERVER DU DOM (Vers document.model)
 * Surveille les scripts [model][type][id]
 */
const domObserver = new MutationObserver((mutations) => {
    if (isSyncing) return;
    
    mutations.forEach(mutation => {
        // Ajout ou modification de contenu/attributs
        const target = mutation.target;
        if (target.nodeName === 'SCRIPT' && target.hasAttribute('model')) {
            syncModelNode(target);
        }
        
        // Gestion des nouveaux nœuds injectés
        mutation.addedNodes.forEach(node => {
            if (node.nodeName === 'SCRIPT' && node.hasAttribute('model')) {
                syncModelNode(node);
            }
        });
    });
});

/**
 * 2. OBSERVER DU MODÈLE (Vers le DOM)
 * Version corrigée pour la gestion asymétrique des attributs data-*
 */
const modelObserver = new MutationObserver((mutations) => {
    if (isSyncing) return;
    isSyncing = true;

    mutations.forEach(mutation => {
        const nodes = mutation.type === 'childList' ? mutation.target.childNodes : [mutation.target];
        
        nodes.forEach(xmlNode => {
            if (xmlNode.nodeType !== 1) return;
            
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

            // MIROIR DES ATTRIBUTS : Racine XML -> Script data-*
            // On réinjecte le préfixe data- uniquement pour le script
            Array.from(xmlNode.attributes).forEach(attr => {
                script.setAttribute(`data-${attr.name}`, attr.value);
            });

            const type = script.getAttribute('type') || 'json';
            if (type.includes('json')) {
                // On passe false pour indiquer que nous sommes à la racine (gestion data-)
                script.textContent = JSON.stringify(xmlToJSON(xmlNode, true), null, 4);
            } else if (type.includes('xml')) {
                script.textContent = new XMLSerializer().serializeToString(xmlNode);
            }
        });
    });

    isSyncing = false;
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

return;

/**
 * INITIALISATION
 */
const init = () => {
    // Initialisation du modèle si nécessaire
    if (typeof document.model === 'undefined') {
        document.model = document.implementation.createDocument(null, "model");
    }

    // Lancement de l'observation du DOM
    domObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['model', 'type', 'id']
    });

    // Lancement de l'observation du modèle
    modelObserver.observe(document.model.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true
    });

    // Premier passage synchrone sur les scripts existants
    document.querySelectorAll('script[model]').forEach(syncModelNode);
};

// Auto-amorçage selon l'état du document
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
