/**
 * DataBinding.js - Moteur de rendu et de liaison AriaML v2.0
 */

const TemplateRegistry = new Map();

/**
 * 1. COMPILATION DES TEMPLATES
 * Extrait les templates globaux et prépare les éléments porteurs de directives.
 */
const compileTemplates = (root = document) => {
    // Indexation des templates globaux possédant un ID
    root.querySelectorAll('template[id]').forEach(tpl => {
        TemplateRegistry.set(tpl.id, tpl.content);
    });

    // Préparation des éléments ref/each
    root.querySelectorAll('[ref], [each]').forEach(el => {
        if (el._ariaTemplate) return; // Déjà compilé

        let fragment = null;

        // 1. Priorité à l'attribut template
        const tplId = el.getAttribute('template');
        if (tplId && TemplateRegistry.has(tplId)) {
            fragment = TemplateRegistry.get(tplId).cloneNode(true);
        } 
        // 2. Sinon, premier enfant direct (doit être un <template>)
        else {
            const firstChild = el.firstElementChild;
            if (firstChild && firstChild.tagName === 'TEMPLATE') {
                fragment = firstChild.content;
            }
        }

        if (fragment) {
            el._ariaTemplate = fragment;
            // On s'assure que le template reste le premier enfant en mode hydrated
            if (el.getAttribute('dom-state') !== 'hydrated' && !el.querySelector('template')) {
                const tplTag = document.createElement('template');
                tplTag.content.appendChild(fragment.cloneNode(true));
                el.prepend(tplTag);
            }
        }
    });
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
        }
    } catch (e) {
        console.warn(`AriaML XPath Error: ${path}`, e);
        return null;
    }
};

/**
 * 3. MOTEUR DE RENDU RÉCURSIF
 */
const render = (container, contextNode = document.model.documentElement) => {
    if (!contextNode) return;

    const elements = container.querySelectorAll('[ref], [each]');
    
    // Pour ne pas traiter les enfants d'un élément qui va lui-même être rendu (récursion contrôlée)
    const topLevelElements = Array.from(elements).filter(el => {
        const parent = el.parentElement.closest('[ref], [each]');
        return !parent || parent === container;
    });

    topLevelElements.forEach(el => {
        const refPath = el.getAttribute('ref');
        const eachPath = el.getAttribute('each');
        
        // Nettoyage des rendus précédents (on garde le template)
        const template = el.firstElementChild;
        while (el.lastElementChild && el.lastElementChild !== template) {
            el.removeChild(el.lastElementChild);
        }

        // CAS 1 : EACH (Itération)
        let collection = [];
        if (eachPath) {
            const result = evaluateXPath(eachPath, contextNode);
            collection = Array.isArray(result) ? result : [];
            
            if (collection.length > 0) {
                collection.forEach(itemNode => {
                    const clone = el._ariaTemplate.cloneNode(true);
                    // Rendu récursif du clone avec le nouveau contexte
                    const wrapper = document.createElement('div'); // Temp pour querySelectorAll
                    wrapper.appendChild(clone);
                    render(wrapper, itemNode);
                    while (wrapper.firstChild) el.appendChild(wrapper.firstChild);
                });
                return; // On a fini pour cet élément
            }
        }

        // CAS 2 : REF (ou Fallback de EACH)
        if (refPath) {
            const target = evaluateXPath(refPath, contextNode);
            
            // Si c'est un nœud XML (Complexe)
            if (target instanceof Node && target.nodeType === 1) {
                const clone = el._ariaTemplate.cloneNode(true);
                const wrapper = document.createElement('div');
                wrapper.appendChild(clone);
                render(wrapper, target);
                while (wrapper.firstChild) el.appendChild(wrapper.firstChild);
            } 
            // Si c'est un scalaire (String, Nombre, ou Fallback)
            else {
                const val = (target === null || target === false) ? "" : String(target);
                
                if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                    if (document.activeElement !== el) el.value = val;
                } else if (el.tagName === 'SELECT') {
                    el.value = val;
                } else {
                    // Injection après le template
                    el.appendChild(document.createTextNode(val));
                }
            }
        }
    });
};

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

// Export ou auto-init
window.addEventListener('model-ready', initDataBinding);
