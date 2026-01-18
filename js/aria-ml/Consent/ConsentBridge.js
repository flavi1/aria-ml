class ConsentBridge {
    constructor(config) {
        this.iframeUrl = config.iframeUrl || 'aria-consent-manager.html';
        this.targetOrigin = new URL(this.iframeUrl, window.location.origin).origin;
        this.dialog = null;
        this.iframe = null;
    }

    /**
     * Crée et affiche le dialogue de consentement.
     * @param {Object} initData - Les données de contrat issues du JSON de la page.
     * @returns {Promise} - Résout avec les décisions de l'utilisateur.
     */
    open(initData) {
        return new Promise((resolve) => {
            this._createUI();

            const handleMessage = (event) => {
                // SÉCURITÉ : Vérifier l'origine du message
                if (event.origin !== this.targetOrigin) return;

                const { type, payload } = event.data;

                if (type === 'ARIAML_CONSENT_SAVE') {
                    window.removeEventListener('message', handleMessage);
                    this._closeUI();
                    resolve(payload);
                }
            };

            window.addEventListener('message', handleMessage);

            // Une fois l'iframe chargée, on lui envoie les données d'initialisation
            this.iframe.onload = () => {
                this.iframe.contentWindow.postMessage({
                    type: 'ARIAML_INIT_FORM',
                    payload: initData
                }, this.targetOrigin);
            };
        });
    }

    /**
     * Structure DOM du dialogue (Utilise l'élément <dialog> natif).
     */
    _createUI() {
        this.dialog = document.createElement('dialog');
        this.dialog.id = 'aria-consent-manager';
        
        // Style de base pour l'isolation visuelle
        Object.assign(this.dialog.style, {
            width: '500px',
            padding: '0',
            border: 'none',
            borderRadius: '8px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
        });

        this.iframe = document.createElement('iframe');
        this.iframe.src = this.iframeUrl;
        Object.assign(this.iframe.style, {
            width: '100%',
            height: '450px',
            border: 'none',
            display: 'block'
        });

        this.dialog.appendChild(this.iframe);
        document.body.appendChild(this.dialog);
        
        // Affiche le modal (bloque les interactions avec le reste de la page)
        this.dialog.showModal();
    }

    _closeUI() {
        if (this.dialog) {
            this.dialog.close();
            this.dialog.remove();
            this.dialog = null;
            this.iframe = null;
        }
    }
}
