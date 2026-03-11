/**
 * OBSERVER XML => SCRIPT (Persistance)
 */
const modelObserver = new MutationObserver((mutations) => {
	console.log('## [Observer] ModelToScript',  document.model.sync.ModelToScript)
    if (!document.model.sync.ModelToScript) return;
    
    // Verrouille l'autre sens pour éviter l'écho
    document.model.sync.ScriptToModel = false;

    try {
        const rootChildren = Array.from(document.model.dom.childNodes)
                                 .filter(n => n.nodeType === 1);
        
        rootChildren.forEach(xmlNode => {
            const id = xmlNode.nodeName;
            let script = document.getElementById(id);
            
            if (!script) {
                script = document.createElement('script');
                script.id = id;
                script.setAttribute('type', 'json');
                script.setAttribute('model', '');
                (document.querySelector('aria-ml') || document.body).appendChild(script);
            }

            // Sync des attributs data-*
            Array.from(xmlNode.attributes).forEach(attr => {
                const dataName = `data-${attr.name}`;
                if (script.getAttribute(dataName) !== attr.value) {
                    script.setAttribute(dataName, attr.value);
                }
            });

            // Sync du contenu
            const type = script.getAttribute('type') || 'json';
            let newContent = type.includes('json') 
                ? JSON.stringify(xmlToJSON(xmlNode, true), null, 4)
                : new XMLSerializer().serializeToString(xmlNode);

            if (script.textContent !== newContent) {
                script.textContent = newContent;
            }
        });
    } finally {
        setTimeout(() => { document.model.sync.ScriptToModel = true; }, 0);
    }
});
