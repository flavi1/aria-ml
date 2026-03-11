/**
 * PHASE 1 : Initialisation du Modèle (Immédiat)
 */
/**
 * PHASE 1 : Initialisation du Modèle
 */
const initModel = () => {
    if (typeof document.model === 'undefined') {
        createModel();
    }

    document.model.sync.ModelToScript = false;
    document.model.sync.ModelToDoc = false;

    document.querySelectorAll('script[model]').forEach(script => {
        syncModelNode(script);
    });

    // 1. On observe le DOM pour remplir le modèle (Script -> Model)
    domObserver.observe(document.documentElement, {
        childList: true, subtree: true, attributes: true, characterData: true,
        attributeFilter: ['model', 'type', 'id']
    });

    // 2. On observe le XML pour la persistance (Model -> Script)
    modelObserver.observe(document.model.dom, {
        childList: true, subtree: true, attributes: true, characterData: true
    });

    // 3. On observe le XML pour le rendu (Model -> Doc)
    xmlToDocObserver.observe(document.model.dom, {
        childList: true, subtree: true, attributes: true, characterData: true
    });

    setTimeout(() => { 
        document.model.sync.ModelToScript = true; 
        document.model.sync.ModelToDoc = true;
    }, 0);
};

/**
 * PHASE 2 : Initialisation du DataBinding (Sur DOM Ready)
 */
const initDOMBinding = () => {
    const ariaRoot = document.querySelector('aria-ml') || document.body;
    window.dispatchEvent(new CustomEvent('model-ready'));
    BinderObserver.observe(ariaRoot, {
        childList: true, subtree: true, attributes: true, attributeOldValue: true, characterData: true,
        attributeFilter: ['ref', 'each']
    });
    console.log("AriaML: DOM Binding actif.");
};

/**
 * PHASE 3 : Hydratation (Lancée par l'événement model-ready)
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

// --- Lancement des Séquences ---
window.addEventListener('model-ready', initDataBinding);

initModel();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDOMBinding);
} else {
    initDOMBinding();
}
