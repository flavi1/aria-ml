// ModelToDoc.js

/**
 * ModelToDoc.js : XML => UI
 */
const XMLToHTML = new Map();

/**
 * Lie un élément HTML à un nœud XML de façon bidirectionnelle
 */
HTMLElement.prototype.bindNode = function(xmlNode) {
    if (!xmlNode) return;
    if(xmlNode.length)
		xmlNode = xmlNode[0];
    this._boundNode = xmlNode;
    
    if (!XMLToHTML.has(xmlNode)) XMLToHTML.set(xmlNode, new Set());
    XMLToHTML.get(xmlNode).add(this);
    
    syncNodeValue(this, xmlNode);
};

/**
 * Mise à jour ciblée du DOM sans tout redessiner
 */
const updateLinkedElements = (xmlNode) => {
    const elements = XMLToHTML.get(xmlNode);
console.warn(xmlNode, elements)
    if (elements) {
        elements.forEach(el => {
            if (!el.isConnected) {
                elements.delete(el);
            } else {
                syncNodeValue(el, xmlNode);
            }
        });
    }
};

/**
 * OBSERVER XML => HTML
 */
const xmlToDocObserver = new MutationObserver((mutations) => {
	console.log('## [Observer] ModelToDoc', document.model.sync.ModelToDoc);
    if (!document.model.sync.ModelToDoc) return;
    
    document.model.sync.DocToModel = false;

    mutations.forEach(mutation => {
        // A. MUTATION D'ATTRIBUT (@done, @id, etc.)
        if (mutation.type === 'attributes') {
            // On récupère le nœud Attr (nodeType 2) pour matcher la liaison
            const attrNode = mutation.target.getAttributeNode(mutation.attributeName);
            if (attrNode) {
                updateLinkedElements(attrNode);
            }
        } 
        
        // B. MUTATION DE TEXTE (textContent / innerHTML)
        else if (mutation.type === 'characterData') {
            // Ici, on remonte au parent (l'Element) car c'est lui qui est bindé
            updateLinkedElements(mutation.target.parentNode);
        } 
        
        // C. MUTATION STRUCTURELLE (Ajout/Suppression de tâches)
        else if (mutation.type === 'childList') {
            const isStructural = Array.from(mutation.addedNodes)
                .concat(Array.from(mutation.removedNodes))
                .some(n => n.nodeType === 1);

            if (isStructural) {
                // On rafraîchit le conteneur lié au parent du changement (ex: <ul> pour <tasks>)
                const containers = XMLToHTML.get(mutation.target);
                if (containers) {
                    containers.forEach(c => render(c, mutation.target));
                }
            } else {
                // Simple mise à jour de texte via changement de nœud texte
                updateLinkedElements(mutation.target);
            }
        }
    });

    setTimeout(() => { document.model.sync.DocToModel = true; }, 0);
});

/**
 * BINDER OBSERVER (HTML => Init)
 */
const BinderObserver = new MutationObserver((mutations) => {
	console.log('## [Observer] ModelToDoc', document.model.sync.ModelToDoc);
    if (!document.model.sync.ModelToDoc) return;
    
    mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1 && (node.hasAttribute('ref') || node.hasAttribute('each'))) {
                    compileTemplates(node);
                    render(node, node._XPathContext || document.model.dom);
                }
            });
        }
    });
});



/* model => html */
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

const TemplateRegistry = new Map();

/**
 * COMPILATION DES TEMPLATES
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
 * 3. MOTEUR DE RENDU RÉCURSIF
 */
const render = (container, contextNode = document.model.dom) => {
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
