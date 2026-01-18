/**
 * Arbitrator pour AriaML
 * Orchestre le cycle de vie : Consentement -> Whitelist -> Exécution.
 */
class Arbitrator {
    constructor() {
        this.observer = new SecurityObserver({
            whitelist: ['application/consent+json', 'application/ld+json']
        });
        this.consentPromise = null;
        this.resolveConsent = null;
    }

    /**
     * Point d'entrée principal.
     * Doit être appelé immédiatement après l'instanciation.
     */
    async init() {
        // 1. Démarrer l'observer immédiatement pour protéger le DOM
        this.observer.start();

        // 2. Créer la "Barrière" (Promise bloquante)
        this.consentPromise = new Promise((resolve) => {
            this.resolveConsent = resolve;
        });

        // 3. Tenter de récupérer le consentement (Cache ou Global)
        const savedConsent = await this.loadConsent();

        if (savedConsent) {
            this.applyConsent(savedConsent);
        } else {
            this.requestUserConsent();
        }

        return this.consentPromise;
    }

    /**
     * Simule la lecture du Shadow Storage ou des préférences globales.
     */
    async loadConsent() {
        // Logique déléguée au StorageWrapper plus tard
        // Retourne null si aucun consentement n'est trouvé
        return null; 
    }

    /**
     * Déclenche l'affichage de l'Iframe isolée.
     */
    requestUserConsent() {
        const consentData = this.extractConsentContract();
        
        // Ici, on appelle le ConsentBridge pour ouvrir l'Iframe
        // On écoute le retour via postMessage
        window.addEventListener('message', (event) => {
            if (event.data.type === 'ARIAML_CONSENT_SAVE') {
                this.handleDecision(event.data.payload);
            }
        }, { once: true });

        console.log('AriaML: En attente du consentement utilisateur...');
        // Logique d'affichage du dialogue...
    }

    /**
     * Analyse le bloc <script type="application/consent+json">
     */
    extractConsentContract() {
        const script = document.querySelector('script[type="application/consent+json"]');
        return script ? JSON.parse(script.textContent) : {};
    }

    /**
     * Traite la décision renvoyée par l'Iframe.
     */
    async handleDecision(payload) {
        const decisions = payload.decisions;
        
        // Sauvegarde (Shadow Storage)
        if (payload.persistence.rememberForever) {
            await this.saveConsent(decisions);
        }

        this.applyConsent(decisions);
    }

    /**
     * Applique la whitelist et décide du reload.
     */
    applyConsent(decisions) {
        const newWhitelist = ['application/consent+json', 'application/ld+json'];
        
        // On ajoute les langages autorisés à la whitelist de l'observer
        if (decisions.languages) {
            Object.entries(decisions.languages).forEach(([lang, status]) => {
                if (status === 'allowed' || status === true) newWhitelist.push(lang);
            });
        }

        this.observer.updateWhitelist(newWhitelist);

        // ANALYSE DU RELOAD
        // Si des scripts ont été neutralisés, on doit recharger pour être propre.
        if (this.observer.hasNeutralizedScripts) {
            console.warn('AriaML: Scripts neutralisés détectés. Rechargement de la page...');
            location.reload();
        } else {
            // Libérer la barrière
            this.resolveConsent();
        }
    }

    async saveConsent(decisions) {
        // Appel au StorageWrapper
        console.log('AriaML: Consentement sauvegardé.');
    }
}

// Instanciation immédiate
const ariaArbitrator = new Arbitrator();
window.ariaMLGate = ariaArbitrator.init();
