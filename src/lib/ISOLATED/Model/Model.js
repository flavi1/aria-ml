const syncModelNode = (script) => {
    const id = script.id;
    const type = script.getAttribute('type');
    if (!id || !script.hasAttribute('model')) return;

    // 1. Recherche ou création du nœud racine dans document.model
    let rootNode = document?.model.documentElement.querySelector(`:scope > ${id}`);
    if (rootNode) {
        while (rootNode.firstChild) rootNode.removeChild(rootNode.firstChild);
        // Nettoyage des anciens attributs pour éviter les résidus
        Array.from(rootNode.attributes).forEach(attr => rootNode.removeAttribute(attr.name));
    } else {
        rootNode = document.model.createElement(id);
        document.model.documentElement.appendChild(rootNode);
    }

    // 2. Reflet EXCLUSIF des attributs data-*
    Array.from(script.attributes).forEach(attr => {
        if (attr.name.startsWith('data-')) {
            // On peut choisir de garder 'data-' ou de l'enlever. 
            // Gardons-le pour la cohérence avec le DOM.
            rootNode.setAttribute(attr.name, attr.value);
        }
    });

    // 3. Parsing du contenu (JSON ou XML)
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
                        const cleanKey = key.replace(/[^a-zA-Z0-9_]/g, '_');
                        const el = document.model.createElement(cleanKey);
                        parent.appendChild(el);
                        build(val, el);
                    });
                } else {
                    parent.textContent = obj;
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
