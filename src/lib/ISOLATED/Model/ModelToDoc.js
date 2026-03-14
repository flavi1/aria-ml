/**
 * ModelToDoc.js : XML => UI
 */
const XMLToHTML = new Map();
const TemplateRegistry = new Map();

/**
 * _boundNode : Getter dynamique sur Node.
 */
Object.defineProperty(Node.prototype, '_boundNode', {
    get: function() {
        console.log('## [Getter] Resolving _boundNode for', this);
        if (!document.model?.dom) return null;

        let pathParts = [];
        let current = this.nodeType === 1 ? this : this.parentElement;

        while (current && current !== document.body && current !== document.documentElement) {
            const ref = current.getAttribute?.('ref');
            const each = current.getAttribute?.('each');
            const parent = current.parentElement;
            const parentEach = parent?.getAttribute?.('each');

            if (parentEach) {
                // CAS : Je suis un item à l'intérieur d'un conteneur [each]
                // On calcule l'index XPath (base 1) en ignorant les éléments techniques comme <template>
                const siblings = Array.from(parent.children).filter(c => c.tagName !== 'TEMPLATE');
                const index = siblings.indexOf(current) + 1;
                
                // On remonte au parent du parent pour la suite de la boucle 
                // car on a déjà consommé le segment "each" du parent ici
                pathParts.unshift(`${parentEach}[${index}]`);
                current = parent.parentElement; 
                continue; 
            } else if (each) {
                // CAS : Je suis le conteneur de la collection lui-même
                pathParts.unshift(each);
            } else if (ref) {
                pathParts.unshift(ref);
            }
            
            current = current.parentElement;
        }

        if (pathParts.length === 0) return document.model.dom;

        const absolutePath = pathParts.join('/');
        
        try {
            const results = evaluateXPath(absolutePath, document.model.dom);
            const finalNode = Array.isArray(results) ? results[0] : (results || null);
            console.log(`## [Getter] Path: ${absolutePath} =>`, finalNode);
            return finalNode;
        } catch (e) {
            console.warn(`[ModelToDoc] XPath resolution failed: ${absolutePath}`, e);
            return null;
        }
    },
    configurable: true
});

/**
 * Nettoyage récursif des liaisons dans la Map lorsqu'un nœud XML est supprimé.
 */
const cleanupBindings = (xmlNode) => {
    console.log('## [Cleanup] Removing bindings for XML node:', xmlNode);
    XMLToHTML.delete(xmlNode);
    if (xmlNode.nodeType === 1) { 
        // Nettoyage des attributs
        if (xmlNode.attributes) {
            Array.from(xmlNode.attributes).forEach(attr => XMLToHTML.delete(attr));
        }
        // Nettoyage récursif des enfants
        Array.from(xmlNode.childNodes).forEach(cleanupBindings);
    }
};



/**
 * Mise à jour ciblée.
 */
const updateLinkedElements = (xmlNode) => {
	if(xmlNode.length) xmlNode = xmlNode[0];
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
 */
const xmlToDocObserver = new MutationObserver((mutations) => {
    console.log('## [Observer] ModelToDoc', document.model.sync.ModelToDoc);
    if (!document.model.sync.ModelToDoc) return;
    document.model.sync.DocToModel = false;

    mutations.forEach(mutation => {
        // Cas de reset total du modèle
        if (mutation.target === document.model || mutation.target.tagName === 'MODEL') {
            console.log('## [Observer] Full Model Reset detected');
            XMLToHTML.clear();
            render(document.querySelector('aria-ml') || document.body);
            return;
        }

        if (mutation.type === 'attributes') {
            const attrNode = mutation.target.getAttributeNode(mutation.attributeName);
            if (attrNode) updateLinkedElements(attrNode);
        } 
        else if (mutation.type === 'characterData') {
            // TextNode change -> on update le parent (l'élément qui contient le texte)
            updateLinkedElements(mutation.target.parentNode);
        } 
        else if (mutation.type === 'childList') {
            // Si des nœuds XML sont supprimés, on nettoie la Map de réactivité
            mutation.removedNodes.forEach(cleanupBindings);
            
            const isStructural = Array.from(mutation.addedNodes)
                .concat(Array.from(mutation.removedNodes))
                .some(n => n.nodeType === 1);

            if (isStructural) {
                // Changement de structure XML (ajout/suppression de balises)
                // Le moteur de rendu reconstruira les parties nécessaires et le 
                // BinderObserver s'occupera de ré-enregistrer les nouveaux éléments HTML.
                console.log('## [Observer] Structural XML change detected, re-rendering...');
                render(document.querySelector('aria-ml') || document.body);
            } else {
                // Simple changement de texte/nœud sans changement de balise
                updateLinkedElements(mutation.target);
            }
        }
    });

    setTimeout(() => { document.model.sync.DocToModel = true; }, 0);
});

/**
 * Inscription d'un élément et de ses enfants à la Map de réactivité
 */
const registerElement = (el) => {
    if (el.nodeType !== 1) return;

    // Si l'élément a une liaison, on l'inscrit
    if (el.hasAttribute('ref') || el.hasAttribute('each')) {
        const targetXML = el._boundNode;
        if (targetXML) {
            if (!XMLToHTML.has(targetXML)) XMLToHTML.set(targetXML, new Set());
            XMLToHTML.get(targetXML).add(el);
            syncNodeValue(el, targetXML);
            console.log('## [Binder] Registered:', el, 'to XML:', targetXML);
        }
    }

    // On traite les enfants (important pour les structures générées par templates)
    Array.from(el.children).forEach(registerElement);
};

/**
 * Désinscription d'un élément et de ses enfants
 */
const unregisterElement = (el) => {
    if (el.nodeType !== 1) return;
    
    // On nettoie toutes les entrées de la Map pointant vers cet élément
    XMLToHTML.forEach((elements) => elements.delete(el));
    Array.from(el.children).forEach(unregisterElement);
};

/**
 * BINDER OBSERVER (Gestion automatique des abonnements)
 */
const BinderObserver = new MutationObserver((mutations) => {
    if (!document.model.sync.ModelToDoc) return;

    mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
            // Nouveaux éléments : Compilation + Enregistrement
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) {
                    compileTemplates(node); // On compile d'abord
                    registerElement(node);  // On enregistre ensuite (récursif)
                }
            });

            // Éléments supprimés : Nettoyage
            mutation.removedNodes.forEach(node => {
                if (node.nodeType === 1) unregisterElement(node);
            });
        }
    });
});

/**
 * Synchronisation UI.
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
    else if (!el.hasAttribute('each') && el.children.length === 0) {
        el.textContent = val;
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
 * MOTEUR DE RENDU
 */
const render = (container) => {
    const elements = container.querySelectorAll('[ref], [each]');
    const topLevelElements = Array.from(elements).filter(el => {
        const parent = el.parentElement?.closest('[ref], [each]');
        return !parent || parent === container;
    });

    topLevelElements.forEach(el => {
        const contextXML = el.parentElement?._boundNode || document.model.dom;
        
        if (!['SELECT', 'DATALIST', 'OPTGROUP'].includes(el.tagName)) {
            const template = el.querySelector(':scope > template');
            while (el.lastElementChild && el.lastElementChild !== template) {
                el.removeChild(el.lastElementChild);
            }
        }

		if (el.hasAttribute('each')) {
            const path = el.getAttribute('each');
            const items = evaluateXPath(path, contextXML);
            if (Array.isArray(items)) {
                items.forEach(() => {
                    const clone = el.modelTemplate.cloneNode(true);
                    const wrapper = document.createElement('div');
                    wrapper.appendChild(clone);
                    render(wrapper);
                    while (wrapper.firstChild) {
                        const child = wrapper.firstChild;
                        el.appendChild(child);
                        // FORCE : Enregistrement manuel car l'observer peut rater l'append interne
                        if (child.nodeType === 1) registerElement(child);
                    }
                });
            }
        } 
        else if (el.hasAttribute('ref')) {
            const path = el.getAttribute('ref');
            const targetXML = evaluateXPath(path, contextXML);
            const target = Array.isArray(targetXML) ? targetXML[0] : targetXML;

            if (target && target.nodeType === 1 && (target.childElementCount > 0 || target.attributes.length > 0)) {
                const clone = el.modelTemplate.cloneNode(true);
                const wrapper = document.createElement('div');
                wrapper.appendChild(clone);
                render(wrapper);
                while (wrapper.firstChild) {
                    const child = wrapper.firstChild;
                    el.appendChild(child);
                    // FORCE : Enregistrement manuel
                    if (child.nodeType === 1) registerElement(child);
                }
            }
        }
    });
    
    // Pour l'élément conteneur lui-même au cas où
    registerElement(container);
};
