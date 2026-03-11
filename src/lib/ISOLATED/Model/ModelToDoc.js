/**
 * ModelToDoc.js : XML => UI
 */
const XMLToHTML = new Map();
const TemplateRegistry = new Map();

/**
 * Résout dynamiquement le contexte XML d'un élément en remontant l'arbre DOM.
 * Cherche le _boundNode le plus proche pour permettre les chemins XPath relatifs.
 */
const resolveContext = (el) => {
    let current = el.parentElement;
    while (current) {
        if (current._boundNode) return current._boundNode;
        current = current.parentElement;
    }
    return document.model.dom;
};

/**
 * Nettoie récursivement les liaisons des nœuds supprimés.
 */
const cleanupBindings = (xmlNode) => {
    if (xmlNode.nodeType === 1) { 
        XMLToHTML.delete(xmlNode);
        Array.from(xmlNode.attributes).forEach(attr => XMLToHTML.delete(attr));
        Array.from(xmlNode.childNodes).forEach(cleanupBindings);
    } else {
        XMLToHTML.delete(xmlNode);
    }
};

/**
 * Lie un élément HTML à un nœud XML (synchronisation bidirectionnelle).
 */
HTMLElement.prototype.bindNode = function(xmlNode) {
    if (!xmlNode) return;
    if (xmlNode.length) xmlNode = xmlNode[0];
    
    this._boundNode = xmlNode;
    
    if (!XMLToHTML.has(xmlNode)) XMLToHTML.set(xmlNode, new Set());
    XMLToHTML.get(xmlNode).add(this);
    
    syncNodeValue(this, xmlNode);
};

/**
 * Mise à jour ciblée du DOM pour un nœud XML modifié.
 */
const updateLinkedElements = (xmlNode) => {
    const elements = XMLToHTML.get(xmlNode);
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
 * Surveille les changements dans le modèle XML pour impacter la vue.
 */
const xmlToDocObserver = new MutationObserver((mutations) => {
	console.log('## [Observer] ModelToDoc', document.model.sync.ModelToDoc);
    if (!document.model.sync.ModelToDoc) return;
    
    document.model.sync.DocToModel = false;

    mutations.forEach(mutation => {
        // Reset global
        if (mutation.target === document.model || mutation.target.tagName === 'MODEL') {
            XMLToHTML.clear();
            render(document.querySelector('aria-ml') || document.body);
            return;
        }

        if (mutation.type === 'attributes') {
            const attrNode = mutation.target.getAttributeNode(mutation.attributeName);
            if (attrNode) updateLinkedElements(attrNode);
        } 
        else if (mutation.type === 'characterData') {
            updateLinkedElements(mutation.target.parentNode);
        } 
        else if (mutation.type === 'childList') {
            mutation.removedNodes.forEach(cleanupBindings);

            const isStructural = Array.from(mutation.addedNodes)
                .concat(Array.from(mutation.removedNodes))
                .some(n => n.nodeType === 1);

            if (isStructural) {
                let currentXML = mutation.target;
                let containers = null;

                while (currentXML && currentXML !== document.model) {
                    containers = XMLToHTML.get(currentXML);
                    if (containers && containers.size > 0) break;
                    currentXML = currentXML.parentNode;
                }

                if (containers) {
                    containers.forEach(c => render(c, currentXML));
                } else {
                    render(document.querySelector('aria-ml') || document.body);
                }
            } else {
                updateLinkedElements(mutation.target);
            }
        }
    });

    setTimeout(() => { document.model.sync.DocToModel = true; }, 0);
});

/**
 * BINDER OBSERVER (HTML => Init)
 * Intercepte les nouveaux éléments porteurs de directives injectés dans le DOM.
 */
const BinderObserver = new MutationObserver((mutations) => {
	console.log('## [Observer] ModelToDoc (binder)', document.model.sync.ModelToDoc);
    if (!document.model.sync.ModelToDoc) return;
    
    mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1 && (node.hasAttribute('ref') || node.hasAttribute('each'))) {
                    compileTemplates(node);
                    render(node, resolveContext(node));
                }
            });
        }
    });
});

/**
 * Synchronise la valeur d'un élément HTML avec son nœud XML.
 */
const syncNodeValue = (el, boundNode) => {
    const val = (boundNode.nodeType === 2) ? boundNode.value : boundNode.textContent;

    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) {
        if (el.type === 'checkbox' || el.type === 'radio') {
            const isChecked = (val === "true" || val === el.value);
            if (el.checked !== isChecked) el.checked = isChecked;
        } else {
            if (el.value !== val) el.value = val;
        }
    } 
    else {
        // Injection texte simple si l'élément n'a pas de structure propre
        if (!el.hasAttribute('each') && el.children.length === 0) {
            el.textContent = val;
        }
    }
};

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
            const firstChild = el.querySelector(':scope > template');
            if (firstChild) fragment = firstChild.content;
        }

        if (fragment) {
            el.modelTemplate = fragment;
            if (el.getAttribute('dom-state') !== 'hydrated' && !el.querySelector(':scope > template')) {
                const tplTag = document.createElement('template');
                tplTag.content.appendChild(fragment.cloneNode(true));
                el.prepend(tplTag);
            }
        }
    });
};

/**
 * MOTEUR DE RENDU RÉCURSIF
 */
const render = (container, contextNode = document.model.dom) => {
    if (!contextNode) return;

    const elements = container.querySelectorAll('[ref], [each]');
    
    // Traitement des éléments de premier niveau uniquement
    const topLevelElements = Array.from(elements).filter(el => {
        const parent = el.parentElement?.closest('[ref], [each]');
        return !parent || parent === container || parent === container.getRootNode();
    });

    topLevelElements.forEach(el => {
        const refPath = el.getAttribute('ref');
        const eachPath = el.getAttribute('each');

        // Nettoyage structurel avant rendu (préserve le template)
        if (!['SELECT', 'DATALIST', 'OPTGROUP'].includes(el.tagName)) {
            const template = el.querySelector(':scope > template');
            while (el.lastElementChild && el.lastElementChild !== template) {
                el.removeChild(el.lastElementChild);
            }
        }

        // CAS 1 : EACH (Itération)
        if (eachPath) {
            const collection = evaluateXPath(eachPath, contextNode);
            if (Array.isArray(collection)) {
                // L'élément porteur (ex: <ul>) garde le contexte parent pour resolveContext
                el._boundNode = contextNode; 
                
                collection.forEach(itemNode => {
                    const clone = el.modelTemplate.cloneNode(true);
                    const wrapper = document.createElement('div');
                    wrapper.appendChild(clone);
                    
                    // Rendu récursif : les enfants du clone utiliseront itemNode comme contexte
                    render(wrapper, itemNode);
                    
                    while (wrapper.firstChild) {
                        const child = wrapper.firstChild;
                        if (child.nodeType === 1) child._boundNode = itemNode;
                        el.appendChild(child);
                    }
                });
            }
        } 
        // CAS 2 : REF (Mapping simple ou complexe)
        else if (refPath) {
            const target = evaluateXPath(refPath, contextNode);
            if (target instanceof Node) {
                // Si c'est un nœud avec une structure descendante
                if (target.nodeType === 1 && (target.childElementCount > 0 || target.attributes.length > 0)) {
                    el._boundNode = target; // Devient l'ancre pour les enfants
                    const clone = el.modelTemplate.cloneNode(true);
                    const wrapper = document.createElement('div');
                    wrapper.appendChild(clone);
                    
                    render(wrapper, target);
                    
                    while (wrapper.firstChild) {
                        const child = wrapper.firstChild;
                        if (child.nodeType === 1) child._boundNode = target;
                        el.appendChild(child);
                    }
                } else {
                    // Sinon, synchronisation de valeur simple
                    el.bindNode(target);
                }
            }
        }
    });
};
