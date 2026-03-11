// ScriptToModel.js :

const createModel = () => {
	if (typeof document.model != 'undefined')
		return;
	
	document.model = document.implementation.createDocument(null, "model");
	document.model.dom = document.model.documentElement;
	
	document.model.sync = {
		ScriptToModel: true,
		ModelToScript: true,
		ModelToDoc: true,
		DocToModel: true
	}
	
};

/* script => model */

const syncModelNode = (script) => {
    const id = script.id;
    const type = script.getAttribute('type');
    if (!id || !script.hasAttribute('model')) return;

    if (typeof document.model == 'undefined') {
        createModel()
	}

    let rootNode = document.model.dom.querySelector(`:scope > ${id}`);
    if (rootNode) {
        while (rootNode.firstChild) rootNode.removeChild(rootNode.firstChild);
        Array.from(rootNode.attributes).forEach(attr => rootNode.removeAttribute(attr.name));
    } else {
        rootNode = document.model.createElement(id);
        document.model.dom.appendChild(rootNode);
    }

    Array.from(script.attributes).forEach(attr => {
        if (attr.name.startsWith('data-')) {
            rootNode.setAttribute(attr.name.substring(5), attr.value);
        }
    });

    const content = script.textContent.trim();
    if (!content) return;

    try {
        if (type.includes('json')) {
            const data = JSON.parse(content);
            
            const build = (obj, parent) => {
                if (Array.isArray(obj)) {
                    obj.forEach(item => {
                        const itemNode = document.model.createElement('item');
                        parent.appendChild(itemNode);
                        build(item, itemNode);
                    });
                } else if (typeof obj === 'object' && obj !== null) {
                    Object.entries(obj).forEach(([key, val]) => {
                        if (key.startsWith('@')) {
                            const attrName = key.slice(1).replace(/[^a-zA-Z0-9_]/g, '_');
                            // Cast explicite pour les attributs
                            let attrValue = val;
                            if (typeof val === 'boolean') attrValue = val ? "true" : "false";
                            if (val === null) attrValue = "";
                            parent.setAttribute(attrName, attrValue);
                        } else {
                            const cleanKey = key.replace(':', '-').replace(/[^a-zA-Z0-9_]/g, '_');
                            const el = document.model.createElement(cleanKey);
                            parent.appendChild(el);
                            build(val, el);
                        }
                    });
                } else {
                    // Cast explicite pour le textContent
                    if (typeof obj === 'boolean') {
                        parent.textContent = obj ? "true" : "false";
                    } else if (obj === null || typeof obj === 'undefined') {
                        parent.textContent = "";
                    } else {
                        parent.textContent = obj;
                    }
                }
            };
            
            build(data, rootNode);
        } else if (type.includes('xml')) {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(content, "application/xml");
            if (xmlDoc.documentElement) {
                Array.from(xmlDoc.documentElement.childNodes).forEach(child => {
                    rootNode.appendChild(document.model.importNode(child, true));
                });
            }
        }
    } catch (e) {
        console.error(`AriaML: Erreur de parsing sur #${id}`, e);
    }
};

/**
 * OBSERVER DU DOM (script => document.model)
 */
const domObserver = new MutationObserver((mutations) => {
    // Console log pour debug
    console.log('## [Observer] ScriptToModel',  document.model.sync.ScriptToModel);
    if (!document.model.sync.ScriptToModel) return;
    
    // Verrouillage pour éviter les boucles infinies avec ModelToScript
    document.model.sync.ModelToScript = false;
    
    mutations.forEach(mutation => {
        let targetScript = null;

        // Cas 1 : Modification directe du texte (Console ou code)
        if (mutation.type === 'characterData') {
            const parent = mutation.target.parentElement;
            if (parent && parent.nodeName === 'SCRIPT' && parent.hasAttribute('model')) {
                targetScript = parent;
            }
        } 
        // Cas 2 : Modification des attributs ou du HTML interne (innerHTML)
        else {
            const target = mutation.target;
            if (target.nodeName === 'SCRIPT' && target.hasAttribute('model')) {
                targetScript = target;
            }
        }

        // Cas 3 : Ajout d'un nouveau script dans le DOM
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => {
                if (node.nodeName === 'SCRIPT' && node.hasAttribute('model')) {
                    syncModelNode(node);
                }
            });
        }

        // Si on a identifié un script cible, on synchronise
        if (targetScript) {
            syncModelNode(targetScript);
        }
    });
    
    // Déverrouillage asynchrone
    setTimeout(() => { 
        document.model.sync.ModelToScript = true; 
    }, 0);
});
