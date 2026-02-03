/**
 * AriaMLAttributeSync - Synchronisation bidirectionnelle d'attributs et de classes.
 * @param {HTMLElement} source - L'élément de référence (ex: <aria-ml>)
 * @param {HTMLElement} target - L'élément qui doit refléter les changements (ex: <html>)
 */
class AriaMLAttributeSync {
    constructor(source, target) {
        this.source = source;
        this.target = target;
        this.isSyncing = false; // Flag pour éviter les boucles infinies de mutations

        this.init();
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

// Au démarrage du moteur
const ariaRoot = document.querySelector('aria-ml');
const htmlEl = document.documentElement;

// On crée la liaison vivante
window.AriaMLSync = new AriaMLAttributeSync(ariaRoot, htmlEl);
window.ViewportSync = new AriaMLAttributeSync(ariaRoot, document.body);
