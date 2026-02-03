/**
 * AriaMLAttributeSync - Synchronisation bidirectionnelle d'attributs et de classes.
 * @param {HTMLElement} source - L'élément de référence (ex: <aria-ml>)
 * @param {HTMLElement} target - L'élément qui doit refléter les changements (ex: <html>)
 */
class AriaMLAttributeSync {
    constructor(source, target) {
        if (!source || !target) return;
        this.source = source;
        this.target = target;
        this.isSyncing = false;
        this.init();
    }

    /**
     * Tente de synchroniser dès que possible.
     * @param {string} selector - Le sélecteur de l'élément à surveiller.
     * @param {HTMLElement} target - L'élément cible (ex: document.body).
     */
    static observeAndSync(selector, target) {
        const el = document.querySelector(selector);
        
        if (el) {
            return new AriaMLAttributeSync(el, target);
        }

        // Si l'élément n'existe pas encore, on surveille l'apparition dans le DOM
        const observer = new MutationObserver((mutations, obs) => {
            const found = document.querySelector(selector);
            if (found) {
                new AriaMLAttributeSync(found, target);
                obs.disconnect(); // On arrête de surveiller une fois trouvé
            }
        });

        observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    init() {
        // 1. Fusion initiale (Priorité Source)
        this.mergeInitialState();

        // 2. Mise en place des Observers
        this.sourceObserver = new MutationObserver((m) => this.handleMutations(m, this.target));
        this.targetObserver = new MutationObserver((m) => this.handleMutations(m, this.source));

        const config = { attributes: true, attributeOldValue: true };
        this.sourceObserver.observe(this.source, config);
        this.targetObserver.observe(this.target, config);
    }

    mergeInitialState() {
        this.isSyncing = true;
        
        // Synchroniser les attributs de la source vers la cible
        Array.from(this.source.attributes).forEach(attr => {
            if (attr.name === 'class') {
                attr.value.split(/\s+/).forEach(cls => {
                    if (cls) this.target.classList.add(cls);
                });
            } else {
                this.target.setAttribute(attr.name, attr.value);
            }
        });

        this.isSyncing = false;
    }

    handleMutations(mutations, destination) {
        if (this.isSyncing) return;
        this.isSyncing = true;

        mutations.forEach(mutation => {
            if (mutation.type === 'attributes') {
                const name = mutation.attributeName;
                const newValue = mutation.target.getAttribute(name);

                if (newValue === null) {
                    destination.removeAttribute(name);
                } else {
                    // Cas particulier des classes : on merge au lieu de remplacer brutalement ?
                    // Ici on suit la valeur de l'attribut pour une synchro stricte
                    if (destination.getAttribute(name) !== newValue) {
                        destination.setAttribute(name, newValue);
                    }
                }
            }
        });

        this.isSyncing = false;
    }

    destroy() {
        this.sourceObserver.disconnect();
        this.targetObserver.disconnect();
    }
}

AriaMLAttributeSync.observeAndSync('aria-ml', document.documentElement);
AriaMLAttributeSync.observeAndSync('#body', document.body);
