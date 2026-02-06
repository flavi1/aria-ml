/**
 * AriaML ScrollSpy.js
 * Gère l'état de lecture local sans interférer avec la navigation globale.
 */
(function() {
    const ScrollSpy = {
        observer: null,
        
        init: function() {
            // On cible les ancres qui ont un ID dans le contenu principal
            const sections = document.querySelectorAll('aria-ml [id]');
            if (!sections.length) return;

            this.observer = new IntersectionObserver((entries) => {
                // On cherche l'élément le plus visible qui remonte
                const visibleEntry = entries.find(e => e.isIntersecting && e.threshold >= 0.5);
                
                if (visibleEntry) {
                    this.notify(visibleEntry.target.id);
                }
            }, {
                rootMargin: '-10% 0px -70% 0px', // Focus sur le haut de l'écran
                threshold: [0.5]
            });

            sections.forEach(s => this.observer.observe(s));
        },

        notify: function(id) {
            const url = `#${id}`;

            // On émet l'événement pour la Behavior Sheet (#toc)
            // On utilise un type différent de 'page' pour éviter tout conflit
            document.dispatchEvent(new CustomEvent('current-change', {
                detail: {
                    type: 'location', 
                    value: url
                },
                bubbles: true,
                cancelable: true
            }));
        }
    };

    // Initialisation après le rendu initial du moteur
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => ScrollSpy.init());
    } else {
        ScrollSpy.init();
    }
    
    // Ré-attachement après une mise à jour Internal REST
    document.addEventListener('ariaml:updated', () => {
        if (ScrollSpy.observer) ScrollSpy.observer.disconnect();
        ScrollSpy.init();
    });
})();
