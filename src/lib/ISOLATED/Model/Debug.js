/**
 * Génère un sélecteur CSS unique basé sur la position structurelle (nth-child)
 */
function getPathSelector(el, rootNode = null) {
    if (!(el instanceof Element)) return '';
    const path = [];
    let current = el;

    while (current && current.nodeType === Node.ELEMENT_NODE) {
        if (rootNode && current === rootNode) break;
        const tagName = current.nodeName.toLowerCase();
        const parent = current.parentNode;
        
        if (parent) {
            const siblings = Array.from(parent.children);
            const index = siblings.indexOf(current) + 1;
            // On garde le tagname pour la précision du querySelector
            path.unshift(`:nth-child(${index})`);
        } else {
            path.unshift(tagName);
        }
        current = parent;
    }
    return path.join(' > ');
}

(function() {
    const AriaMLModel = {
        isSyncing: false,

        init() {
            const modelElement = document.querySelector('aria-ml-model');
            const sourceNode = document.model?.dom; 
            if (!modelElement || !sourceNode) return;

            this.setupStructureObserver(modelElement);
            this.setupSourceObserver(sourceNode, modelElement);

            // Premier rendu : on enveloppe dans model- pour la gestion des Custom Elements
            modelElement.innerHTML = '<model->' + sourceNode.innerHTML + '</model->';
        },

        /**
         * Source -> Vue
         */
        setupSourceObserver(sourceNode, view) {
            const observer = new MutationObserver(() => {
                if (this.isSyncing) return;
                
                this.isSyncing = true;
                try {
                    // On synchronise le contenu interne de <model->
                    const wrapper = view.querySelector('model-');
                    if (wrapper) {
                        wrapper.innerHTML = this.addSuffixes(sourceNode.innerHTML);
                    } else {
                        view.innerHTML = '<model->' + this.addSuffixes(sourceNode.innerHTML) + '</model->';
                    }
                } finally {
                    setTimeout(() => { this.isSyncing = false; }, 0);
                }
            });

            observer.observe(sourceNode, {
                childList: true, subtree: true, attributes: true, characterData: true
            });
        },

        /**
         * Vue -> Source
         */
        setupStructureObserver(view) {
            const observer = new MutationObserver((mutations) => {
                if (this.isSyncing) return;

                this.isSyncing = true;
                observer.disconnect();

				try {
					mutations.forEach(m => {
						// Résolution de l'élément porteur du sélecteur
						// Si m.target est un nœud de texte (3), on prend le parent.
						const el = m.target.nodeType === 1 ? m.target : m.target.parentElement;
						
						if (!el || el == view) return;

						// On calcule le sélecteur RELATIF au wrapper <model->
						const sel = getPathSelector(el, view);
						
						if(!sel)
							return;

						// Si sel est vide, c'est qu'on est sur le root (view lui-même)
						const sourceTarget = document.model.dom.querySelector(sel);

console.warn('vue => src', el, sourceTarget, m.type)

						if (!sourceTarget) {
							console.warn(sel + ' non trouvé dans model.');
							return;
						}

						if (m.type === 'attributes') {
							// Ici m.target est l'Element, on peut utiliser getAttribute
							sourceTarget.setAttribute(m.attributeName, m.target.getAttribute(m.attributeName));
						}
						else if (m.type === 'characterData') {
							// Ici m.target est le TextNode, on synchronise son contenu
							sourceTarget.textContent = m.target.textContent;
						}
						else if (m.type === 'childList') {
							// Ici m.target est l'Element parent des nœuds ajoutés/supprimés
							sourceTarget.innerHTML = this.cleanSuffixes(m.target.innerHTML);
						}
					});

					// Normalisation de TOUS les tags : ajout du suffixe '-'
					// Note: On utilise innerHTML ici, ce qui va recréer le DOM de la vue.
					// Le verrou isSyncing empêchera la boucle.
					view.innerHTML = this.addSuffixes(view.innerHTML);

				} finally {
					observer.observe(view, { 
						childList: true, subtree: true, attributes: true, characterData: true 
					});
					setTimeout(() => { this.isSyncing = false; }, 0);
				}
            });

            observer.observe(view, { 
                childList: true, subtree: true, attributes: true, characterData: true 
            });
        },

        cleanSuffixes(htmlString) {
            const tmp = document.createElement('div');
            tmp.innerHTML = htmlString;
            tmp.querySelectorAll('*').forEach(el => {
                const tag = el.tagName.toLowerCase();
                if (tag.endsWith('-')) {
                    const newNode = document.createElement(tag.slice(0, -1));
                    Array.from(el.attributes).forEach(a => newNode.setAttribute(a.name, a.value));
                    while (el.firstChild) newNode.appendChild(el.firstChild);
                    el.replaceWith(newNode);
                }
            });
            return tmp.innerHTML;
        },
        
        addSuffixes(htmlString) {
            const tmp = document.createElement('div');
            tmp.innerHTML = htmlString;
            tmp.querySelectorAll('*').forEach(el => {
                const tag = el.tagName.toLowerCase();
                if (!tag.endsWith('-')) {
					const newNode = document.createElement(`${tag}-`);
					Array.from(el.attributes).forEach(a => newNode.setAttribute(a.name, a.value));
					while (el.firstChild) newNode.appendChild(el.firstChild);
					el.replaceWith(newNode);
                }
            });
            return tmp.innerHTML;
		}
        
    };

    if (document.readyState === 'complete') AriaMLModel.init();
    else window.addEventListener('DOMContentLoaded', () => AriaMLModel.init());
})();
