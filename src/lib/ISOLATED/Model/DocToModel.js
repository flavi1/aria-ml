// DocToModel.js

/**
 * GESTION DE L'AUTO-ÉDITION (input field => model)
 */
document.addEventListener('input', (e) => {
    const el = e.target;
    const refPath = el.getAttribute('ref');
    
	console.log('## [EventListener] DocToModel', document.model.sync.DocToModel);
	if (!document.model.sync.DocToModel) return;
	
	//document.model.sync.ModelToDoc = false;
	
    if (!refPath) return;
    
    // Utilisation de _XPathContext pour supporter les chemins relatifs
    let targetNode = evaluateXPath(refPath, el._XPathContext || document.model.dom);
    if(targetNode.length)
		targetNode = targetNode[0];

    if (targetNode instanceof Node) {
        const newValue = el.type === 'checkbox' ? (el.checked ? "true" : "false") : el.value;
        if (targetNode.textContent !== newValue) {
            targetNode.textContent = newValue;
        }
    }
    
    //setTimeout(() => { document.model.sync.ModelToDoc = true; }, 0);
    
});
