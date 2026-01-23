/**
 * Logique de l'UI de Consentement (Inside Iframe)
 */
class ConsentUIManager {
    constructor() {
        this.form = document.getElementById('aria-consent-form');
        this.langContainer = document.getElementById('languages-section');
        this.scopeContainer = document.getElementById('scopes-section');
        this.initData = null;

        this._setupListeners();
    }

    /**
     * Écoute les messages d'initialisation venant de l'Arbitre.
     */
    _setupListeners() {
        window.addEventListener('message', (event) => {
            // SÉCURITÉ : L'arbitre est toujours le parent
            if (event.source !== window.parent) return;

            if (event.data.type === 'ARIAML_INIT_FORM') {
                this.initData = event.data.payload;
                this.renderForm();
            }
        });

        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitDecision();
        });
    }

    /**
     * Génère dynamiquement le HTML du formulaire.
     */
    renderForm() {
        const { languages, scopes } = this.initData.config;

        // Rendu des Langages
        this.langContainer.innerHTML = '<h2>Moteurs d\'exécution</h2>';
        Object.entries(languages).forEach(([mime, details]) => {
            this.langContainer.appendChild(this._createRow('lang', mime, details));
        });

        // Rendu des Scopes
        this.scopeContainer.innerHTML = '<h2>Accès réseaux & Données</h2>';
        Object.entries(scopes).forEach(([id, details]) => {
            this.scopeContainer.appendChild(this._createRow('scope', id, details));
        });
    }

    /**
     * Crée une ligne de contrôle (Checkbox + Reason).
     */
    _createRow(prefix, id, details) {
        const row = document.createElement('div');
        row.className = `field-row ${!details.isAvailable && details.status === 'recommended' ? 'warning' : ''}`;

        const isRequired = details.status === 'required' || details.required === true;
        const isDisabled = isRequired; // On ne peut pas décocher ce qui est requis
        const isChecked = isRequired || details.currentConsent === 'allowed';

        row.innerHTML = `
            <label>
                <input type="checkbox" name="${prefix}:${id}" 
                       ${isChecked ? 'checked' : ''} 
                       ${isDisabled ? 'disabled' : ''}>
                <strong>${id}</strong>
            </label>
            ${isRequired ? '<span class="badge required">Requis</span>' : ''}
            <p class="reason">${details.reason || details.description || ''}</p>
            ${!details.isAvailable ? '<p class="alert">Indisponible sur ce navigateur.</p>' : ''}
        `;
        return row;
    }

    /**
     * Collecte les données et les renvoie à l'Arbitre.
     */
    submitDecision() {
        const formData = new FormData(this.form);
        const decisions = {
            languages: {},
            scopes: {}
        };

        // Parcourir les données initiales pour inclure les éléments "disabled" (requis)
        // car FormData ne les prend pas par défaut.
        Object.keys(this.initData.config.languages).forEach(mime => {
            const isRequired = this.initData.config.languages[mime].status === 'required';
            decisions.languages[mime] = isRequired || formData.has(`lang:${mime}`);
        });

        Object.keys(this.initData.config.scopes).forEach(id => {
            const isRequired = this.initData.config.scopes[id].required;
            decisions.scopes[id] = isRequired || formData.has(`scope:${id}`);
        });

        window.parent.postMessage({
            type: 'ARIAML_CONSENT_SAVE',
            payload: {
                decisions,
                persistence: {
                    rememberForever: document.getElementById('persist-choice').checked
                }
            }
        }, '*'); // Le ConsentBridge filtrera l'origine de son côté
    }
}

// Initialisation au chargement du DOM
document.addEventListener('DOMContentLoaded', () => {
    new ConsentUIManager();
});
