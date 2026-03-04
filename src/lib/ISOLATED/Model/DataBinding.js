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
 * Surveille document.model pour mettre à jour ou créer les <script>
 */
const modelObserver = new MutationObserver((mutations) => {
    if (isSyncing) return;
    isSyncing = true; // On verrouille

    mutations.forEach(mutation => {
        // On s'intéresse aux enfants directs de <model>
        const nodes = mutation.type === 'childList' ? mutation.target.childNodes : [mutation.target];
        
        nodes.forEach(xmlNode => {
            if (xmlNode.nodeType !== 1) return; // Uniquement les éléments
            
            const id = xmlNode.nodeName;
            let script = document.getElementById(id);
            
            // Si le script n'existe pas, on le crée
            if (!script) {
                script = document.createElement('script');
                script.id = id;
                script.setAttribute('type', 'json');
                script.setAttribute('model', '');
                
                // Insertion : dans <aria-ml> ou à défaut dans <html>
                const container = document.querySelector('aria-ml') || document.documentElement;
                container.appendChild(script);
            }

            // Mise à jour du contenu du script selon son type
            const type = script.getAttribute('type') || 'json';
            if (type.includes('json')) {
                script.textContent = JSON.stringify(xmlToJSON(xmlNode), null, 4);
            } else if (type.includes('xml')) {
                script.textContent = new XMLSerializer().serializeToString(xmlNode);
            }
            
            // Mise à jour des attributs data-* (le reflet inverse)
            Array.from(xmlNode.attributes).forEach(attr => {
                if (attr.name.startsWith('data-')) {
                    script.setAttribute(attr.name, attr.value);
                }
            });
        });
    });

    isSyncing = false; // On déverrouille
});

/**
 * UTILITAIRE : Conversion XML vers JSON pour la persistance
 */
function xmlToJSON(node) {
    let obj = {};
    
    // Attributs -> @key
    Array.from(node.attributes).forEach(attr => {
        if (!attr.name.startsWith('data-')) {
            obj[`@${attr.name}`] = attr.value;
        }
    });

    // Enfants
    Array.from(node.childNodes).forEach(child => {
        if (child.nodeType === 1) { // Element
            const key = child.nodeName;
            const value = child.childElementCount > 0 || child.attributes.length > 0 
                ? xmlToJSON(child) 
                : child.textContent;
            
            // Gestion des listes (item -> tableau)
            if (key === 'item') {
                if (!Array.isArray(obj)) obj = [];
                obj.push(value);
            } else {
                obj[key] = value;
            }
        }
    });
    
    return Object.keys(obj).length === 0 && node.textContent ? node.textContent : obj;
}

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
