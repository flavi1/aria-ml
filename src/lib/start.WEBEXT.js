/**
 * start.WEBEXT.js
 * Surveillance ultra-agressive pour capturer la source brute.
 */
(function() {
    const check = () => {
		if(typeof document._needAriaML !== 'undefined' && !document._needAriaML) {
			return;
		}
		if(document.head && document.head.hasAttribute('data-ssr'))
			return;
		if(document.querySelector('body > aria-ml')) {
			const m =document.createElement('meta')
			m.setAttribute('charset', 'UTF-8')
			document.head.prepend(m);
			document._needAriaML = true;
			observer.disconnect();
			return true;
		}
		else {
			const pre = document.querySelector('pre');
			const isAriaFragment = (raw) => {
				for(begin of ['<!DOCTYPE aria-ml-fragment>', '<aria-ml-fragment>', '<aria-ml-fragment ', "<aria-ml-fragment\n" ])
					if(raw.indexOf(begin) === 0)
						return true;
				if(isAriaFragment(src)) {
					location.reload();
					observer.disconnect();
				}
			}
		}
            
        
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
    check();
})();
