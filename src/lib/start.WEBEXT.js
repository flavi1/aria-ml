/**
 * start.WEBEXT.js
 * Surveillance ultra-agressive pour capturer la source brute.
 */
(function() {
    const check = () => {
        // On cherche le PRE n'importe où (le navigateur peut changer sa structure)
        const pre = document.querySelector('pre');
        
        // On s'assure que le PRE existe ET qu'il contient du texte (le flux est en cours)
        if (pre && pre.textContent.trim().length > 0) {
			const src = pre.textContent
            
			const isAria = (raw) => {
				for(begin of ['<!DOCTYPE aria-ml>', '<aria-ml>', '<aria-ml ', "<aria-ml\n" ])
					if(raw.indexOf(begin) === 0)
						return true;
			}
			
			
			document._needAriaML = isAria(src);
			if(document._needAriaML) {
				document.head.innerHTML = '<meta charset="UTF-8">'
				document.body.innerHTML = src;
			}
			document.documentElement.style.display = 'block';
            
            observer.disconnect();
            return true;
        }
        return false;
    };

    const observer = new MutationObserver((mutations) => {
        for (let mutation of mutations) {
            if (mutation.addedNodes.length > 0) {
                if (check()) return;
            }
        }
    });

    // On observe dès la racine avec une portée totale
    observer.observe(document.documentElement, { 
        childList: true, 
        subtree: true 
    });
	
	document.documentElement.style.display = 'none';	// anti flickering
	
    // Au cas où le contenu serait déjà là (très rare à document_start, mais possible)
    check();
})();
