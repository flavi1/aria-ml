(function() {
    if (typeof window.AriaMLElement === 'undefined') {
        window.AriaMLElement = class extends HTMLElement {
            constructor() {
                super();
            }
			/**
             * Retourne les slots racines (non imbriqués dans des templates ou d'autres slots)
             * Permet d'isoler le contenu sémantique des scripts de données.
             */
            get slots() {
                const allSlots = this.getRootNode().querySelectorAll('[slot]');
                const filtered = [];
                for (let s of allSlots) {
                    // Cohérence : on ignore ce qui est dans un <template> ou déjà dans un sous-slot
                    if (!s.parentElement.closest('template, [slot]')) {
                        filtered.push(s);
                    }
                }
                // Simulation d'une interface NodeList (statique)
                return {
                    length: filtered.length,
                    item: (i) => filtered[i] || null,
                    forEach: (cb) => filtered.forEach(cb),
                    [Symbol.iterator]: function* () { yield* filtered; }
                };
            }
            
        };
    }

    if (!customElements.get('aria-ml')) {
        customElements.define('aria-ml', window.AriaMLElement);
    }
    
    const originalGetRootNode = Node.prototype.getRootNode;

    Node.prototype.getRootNode = function(options) {
        const root = originalGetRootNode.call(this, options);

        if (root === document) {
            const ariaRoot = this.closest ? this.closest('aria-ml') : null;
            if (ariaRoot)
                return ariaRoot;
        }
        return root;
    };
    
	window.getRootNode = () => {
		return document.querySelector('body > aria-ml') ?? document.documentElement;
	}
    
})();

