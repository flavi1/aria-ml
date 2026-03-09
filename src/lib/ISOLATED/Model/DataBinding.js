/**
 * DataBinding.js - Moteur de rendu et de liaison AriaML v2.0
 */

const syncNodeValue = (el, boundNode) => {
    // Extraction de la valeur (Attribut ou Élément XML)
    const val = (boundNode.nodeType === 2) ? boundNode.value : boundNode.textContent;

    if (el.tagName === 'INPUT') {
        const type = el.type.toLowerCase();
        
        if (type === 'checkbox' || type === 'radio') {
            // Un booléen "true" ou une correspondance de valeur active le cochage
            const isChecked = (val === "true" || val === el.value);
            if (el.checked !== isChecked) el.checked = isChecked;
        } 
        else {
            // Protection du curseur utilisateur pour les champs texte
            if (document.activeElement !== el) el.value = val;
        }
    } 
    else if (el.tagName === 'TEXTAREA') {
        if (document.activeElement !== el) el.value = val;
    } 
    else if (el.tagName === 'SELECT') {
        el.value = val;
    } 
    else {
        // Nettoyage et injection de texte simple pour les éléments structurels
        // On évite innerHTML pour des raisons de sécurité et de performance
        el.textContent = val;
    }
}
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

const TemplateRegistry = new Map();

/**
 * 1. COMPILATION DES TEMPLATES
 */
const compileTemplates = (root = document) => {
    root.querySelectorAll('template[id]').forEach(tpl => {
        TemplateRegistry.set(tpl.id, tpl.content);
    });

    root.querySelectorAll('[ref], [each]').forEach(el => {
        if (el.modelTemplate) return;

        let fragment = null;
        const tplId = el.getAttribute('template');
        
        if (tplId && TemplateRegistry.has(tplId)) {
            fragment = TemplateRegistry.get(tplId).cloneNode(true);
        } else {
            const firstChild = el.firstElementChild;
            if (firstChild && firstChild.tagName === 'TEMPLATE') {
                fragment = firstChild.content;
            }
        }

        if (fragment) {
            el.modelTemplate = fragment;
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
            case XPathResult.FIRST_ORDERED_NODE_TYPE: return result.singleNodeValue;
            default: return null;
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

    // On récupère tous les porteurs de directives
    const elements = container.querySelectorAll('[ref], [each]');
    
    // Filtre pour ne traiter que les éléments de premier niveau dans ce conteneur
    const topLevelElements = Array.from(elements).filter(el => {
        const parent = el.parentElement.closest('[ref], [each]');
        return !parent || parent === container || parent === container.getRootNode();
    });

    topLevelElements.forEach(el => {
        const refPath = el.getAttribute('ref');
        const eachPath = el.getAttribute('each');
        
        // Sauvegarde du contexte pour l'auto-édition (Observers.js)
        el._XPathContext = contextNode;

        // Nettoyage (on préserve le premier enfant <template>)
        const template = el.firstElementChild;
        while (el.lastElementChild && el.lastElementChild !== template) {
            el.removeChild(el.lastElementChild);
        }

        // CAS 1 : EACH (Itération)
        if (eachPath) {
            const collection = evaluateXPath(eachPath, contextNode);
            
            if (Array.isArray(collection) && collection.length > 0) {
                collection.forEach(itemNode => {
                    const clone = el.modelTemplate.cloneNode(true);
                    const wrapper = document.createElement('div'); 
                    wrapper.appendChild(clone);
                    
                    // Rendu récursif : le clone prend l'item XML comme contexte
                    render(wrapper, itemNode);
                    
                    while (wrapper.firstChild) {
                        const child = wrapper.firstChild;
                        if (child.nodeType === 1) child._XPathContext = itemNode;
                        el.appendChild(child);
                    }
                });
                return;
            }
        }

        // CAS 2 : REF (ou Fallback de EACH)
		if (refPath) {
			const target = evaluateXPath(refPath, contextNode);
			
			// Si c'est un ÉLÉMENT XML (Nœud complexe avec enfants/attributs)
			if (target instanceof Node && target.nodeType === 1 && (target.childElementCount > 0 || target.attributes.length > 0)) {
				const clone = el.modelTemplate.cloneNode(true); // Utilise votre nouveau nom
				const wrapper = document.createElement('div');
				wrapper.appendChild(clone);
				
				render(wrapper, target);
				
				while (wrapper.firstChild) {
					const child = wrapper.firstChild;
					if (child.nodeType === 1) child._XPathContext = target;
					el.appendChild(child);
				}
			} 
			// Si c'est un scalaire ou un nœud terminal
			else if (target) {
				el.bindNode(target);
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

window.addEventListener('model-ready', initDataBinding);
