/**
 * DocToModel.js : UI => XML avec Validation par Contraintes
 */
document.addEventListener('input', (e) => {
    const el = e.target;
    const refPath = el.getAttribute('ref');
    
    if (!refPath || !document.model.sync.DocToModel) return;

    // 1. Identification du nœud XML
    let targetNode = el._boundNode || evaluateXPath(refPath, el._XPathContext || document.model.dom);
    if(targetNode.length)
		targetNode = targetNode[0];
	
    if (!(targetNode instanceof Node)) return;

    const newValue = el.type === 'checkbox' ? (el.checked ? "true" : "false") : el.value;

    // 2. Collecte et vérification des contraintes
    const boundElements = XMLToHTML.get(targetNode);
    let isValid = true;
    let errorMessage = "";

    if (boundElements) {
        for (const boundEl of boundElements) {
            // On utilise l'API de validation native du navigateur
            // On simule la valeur sur l'élément pour tester ses contraintes (pattern, min, max...)
            const originalValue = boundEl.value;
            
            // Note : Pour les éléments non-input (ex: <i>), checkValidity n'existe pas, 
            // on ne teste que les éléments de formulaire.
            if (boundEl.checkValidity) {
                const tempValue = boundEl.value;
                boundEl.value = newValue; 
                
                if (!boundEl.checkValidity()) {
                    isValid = false;
                    errorMessage = boundEl.validationMessage;
                    boundEl.value = tempValue; // Restore
                    break; 
                }
                boundEl.value = tempValue; // Restore
            }
        }
    }

    // 3. Action selon la validité
    if (isValid) {
        // Tout est au vert : on vide les erreurs et on met à jour le modèle
        el.setCustomValidity("");
        
//document.model.sync.ModelToDoc = false;
        if (targetNode.nodeType === 2) {
            if (targetNode.value !== newValue) targetNode.value = newValue;
        } else {
            if (targetNode.textContent !== newValue) targetNode.textContent = newValue;
        }
        // Libération du verrou après le cycle de micro-task
//setTimeout(() => { document.model.sync.ModelToDoc = true; }, 0);
    } else {
        // Blocage : on rapporte l'erreur du contraint sur le champ en cours
        el.setCustomValidity(errorMessage);
        el.reportValidity();
        console.warn(`[AriaML Validation] Refus de mise à jour : ${errorMessage}`);
    }
});
