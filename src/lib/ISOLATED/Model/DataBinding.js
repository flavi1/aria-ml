// 1. jsonToXml avec détection de cycle via Set
function jsonToXml(jsonData, nodeName = "root") {
    const doc = document.implementation.createDocument(null, nodeName);
    const root = doc.documentElement;
    const seen = new Set(); // Pour le suivi des références circulaires

    function build(data, parent) {
        if (data === null || data === undefined) return;

        // Détection de cycle pour les objets et tableaux
        if (typeof data === "object") {
            if (seen.has(data)) {
                parent.setAttribute("aria-ml-cycle", "true");
                return;
            }
            seen.add(data);
        }

        if (Array.isArray(data)) {
            data.forEach(item => {
                const itemNode = doc.createElement("item");
                parent.appendChild(itemNode);
                build(item, itemNode);
            });
        } else if (typeof data === "object") {
            Object.entries(data).forEach(([key, value]) => {
                const cleanKey = key.includes(":") ? key.split(":")[1] : key;

                if (cleanKey.startsWith("@")) {
                    parent.setAttribute(cleanKey.slice(1), value);
                } else {
                    const child = doc.createElement(cleanKey);
                    parent.appendChild(child);
                    build(value, child);
                }
            });
        } else {
            parent.textContent = data;
        }
    }

    build(jsonData, root);
    return doc;
}

// 2. renderEach optimisé pour la persistance d'identité
function renderEach(container, xmlNode) {
    const xpath = container.getAttribute("each");
    const template = container.querySelector("template") || container.firstElementChild;
    if (!xpath || !template) return;

    const results = xmlNode.ownerDocument.evaluate(
        xpath, xmlNode, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null
    );

    const currentElements = Array.from(container.children).filter(el => el.tagName !== "TEMPLATE");
    const newCount = results.snapshotLength;

    // On ajuste la taille de la liste HTML par rapport aux résultats XML
    for (let i = 0; i < Math.max(newCount, currentElements.length); i++) {
        if (i < newCount) {
            const itemNode = results.snapshotItem(i);
            let el = currentElements[i];

            if (!el) {
                // Création si l'élément n'existe pas encore à cet index
                const clone = (template.tagName === "TEMPLATE") 
                    ? template.content.cloneNode(true) 
                    : template.cloneNode(true);
                el = clone.firstElementChild || clone;
                container.appendChild(clone);
            }

            // Mise à jour du lien d'identité
            el._bindingNode = itemNode;
            
            // Hydratation récursive
            processBindings(el, itemNode);
        } else {
            // Suppression des éléments en trop
            currentElements[i].remove();
        }
    }
}

// 3. evaluateRef (Inchangé, reste le coeur de la mutation ciblée)
function evaluateRef(htmlElement, xmlNode, hook = null) {
    const xpath = htmlElement.getAttribute("ref");
    if (!xpath) return;

    const result = xmlNode.ownerDocument.evaluate(
        xpath, xmlNode, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
    );
    const targetNode = result.singleNodeValue;

    if (targetNode) {
        let newValue = (targetNode.nodeType === Node.ATTRIBUTE_NODE) ? targetNode.value : targetNode.textContent;

        if (hook) newValue = hook({ path: xpath, value: newValue, element: htmlElement, node: targetNode });

        const isInput = htmlElement.value !== undefined;
        const currentValue = isInput ? htmlElement.value : htmlElement.textContent;

        if (currentValue !== newValue) {// 1. jsonToXml avec détection de cycle via Set
function jsonToXml(jsonData, nodeName = "root") {
    const doc = document.implementation.createDocument(null, nodeName);
    const root = doc.documentElement;
    const seen = new Set(); // Pour le suivi des références circulaires

    function build(data, parent) {
        if (data === null || data === undefined) return;

        // Détection de cycle pour les objets et tableaux
        if (typeof data === "object") {
            if (seen.has(data)) {
                parent.setAttribute("aria-ml-cycle", "true");
                return;
            }
            seen.add(data);
        }

        if (Array.isArray(data)) {
            data.forEach(item => {
                const itemNode = doc.createElement("item");
                parent.appendChild(itemNode);
                build(item, itemNode);
            });
        } else if (typeof data === "object") {
            Object.entries(data).forEach(([key, value]) => {
                const cleanKey = key.includes(":") ? key.split(":")[1] : key;

                if (cleanKey.startsWith("@")) {
                    parent.setAttribute(cleanKey.slice(1), value);
                } else {
                    const child = doc.createElement(cleanKey);
                    parent.appendChild(child);
                    build(value, child);
                }
            });
        } else {
            parent.textContent = data;
        }
    }

    build(jsonData, root);
    return doc;
}

// 2. renderEach optimisé pour la persistance d'identité
function renderEach(container, xmlNode) {
    const xpath = container.getAttribute("each");
    const template = container.querySelector("template") || container.firstElementChild;
    if (!xpath || !template) return;

    const results = xmlNode.ownerDocument.evaluate(
        xpath, xmlNode, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null
    );

    const currentElements = Array.from(container.children).filter(el => el.tagName !== "TEMPLATE");
    const newCount = results.snapshotLength;

    // On ajuste la taille de la liste HTML par rapport aux résultats XML
    for (let i = 0; i < Math.max(newCount, currentElements.length); i++) {
        if (i < newCount) {
            const itemNode = results.snapshotItem(i);
            let el = currentElements[i];

            if (!el) {
                // Création si l'élément n'existe pas encore à cet index
                const clone = (template.tagName === "TEMPLATE") 
                    ? template.content.cloneNode(true) 
                    : template.cloneNode(true);
                el = clone.firstElementChild || clone;
                container.appendChild(clone);
            }

            // Mise à jour du lien d'identité
            el._bindingNode = itemNode;
            
            // Hydratation récursive
            processBindings(el, itemNode);
        } else {
            // Suppression des éléments en trop
            currentElements[i].remove();
        }
    }
}

// 3. evaluateRef (Inchangé, reste le coeur de la mutation ciblée)
function evaluateRef(htmlElement, xmlNode, hook = null) {
    const xpath = htmlElement.getAttribute("ref");
    if (!xpath) return;

    const result = xmlNode.ownerDocument.evaluate(
        xpath, xmlNode, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
    );
    const targetNode = result.singleNodeValue;

    if (targetNode) {
        let newValue = (targetNode.nodeType === Node.ATTRIBUTE_NODE) ? targetNode.value : targetNode.textContent;

        if (hook) newValue = hook({ path: xpath, value: newValue, element: htmlElement, node: targetNode });

        const isInput = htmlElement.value !== undefined;
        const currentValue = isInput ? htmlElement.value : htmlElement.textContent;

        if (currentValue !== newValue) {
            isInput ? (htmlElement.value = newValue) : (htmlElement.textContent = newValue);
        }
    }
}

// 4. Coordination Globale
function processBindings(rootElement, xmlNode) {
    // On traite les références directes
    const refs = rootElement.querySelectorAll("[ref]");
    refs.forEach(el => {
        const scope = el.closest("[_bindingNode]")?._bindingNode || xmlNode;
        evaluateRef(el, scope);
    });

    // On traite les itérations
    const eachs = rootElement.querySelectorAll("[each]");
    eachs.forEach(el => {
        const scope = el.closest("[_bindingNode]")?._bindingNode || xmlNode;
        renderEach(el, scope);
    });
}
            isInput ? (htmlElement.value = newValue) : (htmlElement.textContent = newValue);
        }
    }
}

// 4. Coordination Globale
function processBindings(rootElement, xmlNode) {
    // On traite les références directes
    const refs = rootElement.querySelectorAll("[ref]");
    refs.forEach(el => {
        const scope = el.closest("[_bindingNode]")?._bindingNode || xmlNode;
        evaluateRef(el, scope);
    });

    // On traite les itérations
    const eachs = rootElement.querySelectorAll("[each]");
    eachs.forEach(el => {
        const scope = el.closest("[_bindingNode]")?._bindingNode || xmlNode;
        renderEach(el, scope);
    });
}
