/**
 * SecurityObserver pour AriaML
 * Responsable de la neutralisation préventive (AVOIDED-) et de la surveillance de l'intégrité.
 */
class SecurityObserver {
    constructor(config = { whitelist: [] }) {
        this.whitelist = new Set(config.whitelist);
        this.hasNeutralizedScripts = false;
        this.observer = null;
    }

    /**
     * Démarre l'observation du DOM de manière agressive (au plus tôt).
     */
    start() {
        this.observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        this.sanitize(node);
                        // Parcourir les enfants si injection massive (ex: innerHTML)
                        node.querySelectorAll?.('*').forEach(n => this.sanitize(n));
                    }
                });
            });
        });

        this.observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    }

    /**
     * Applique les règles de neutralisation AriaML.
     */
    sanitize(node) {
        const tagName = node.tagName;

        // 1. Gestion de <meta http-equiv> (Interdiction totale)
        if (tagName === 'META' && node.hasAttribute('http-equiv')) {
            this.neutralizeAttribute(node, 'http-equiv');
        }

        // 2. Gestion de <noscript> -> <no-script>
        if (tagName === 'NOSCRIPT') {
            this.transformNoScript(node);
        }

        // 3. Gestion des <script>
        if (tagName === 'SCRIPT') {
            const type = node.getAttribute('type') || 'text/javascript';
            
            // On laisse passer uniquement la whitelist (ex: application/consent+json)
            if (!this.whitelist.has(type)) {
                this.neutralizeScript(node, type);
            }
        }

        // 4. Gestion des événements inline (si JS non whitelisté)
        if (!this.whitelist.has('text/javascript')) {
            this.neutralizeInlineEvents(node);
        }
    }

    neutralizeAttribute(node, attrName) {
        const val = node.getAttribute(attrName);
        node.setAttribute(`AVOIDED-${attrName}`, val);
        node.removeAttribute(attrName);
        this.hasNeutralizedScripts = true;
    }

    neutralizeScript(node, originalType) {
        if (originalType.startsWith('AVOIDED-')) return;
        
        node.setAttribute('type', `AVOIDED-${originalType}`);
        // Empêche l'exécution des scripts src en supprimant l'attribut temporairement
        if (node.src) {
            node.setAttribute('AVOIDED-src', node.src);
            node.removeAttribute('src');
        }
        this.hasNeutralizedScripts = true;
    }

    transformNoScript(node) {
        const replacement = document.createElement('no-script');
        // Transfert du contenu brut (le navigateur ne l'exécute pas dans no-script)
        replacement.innerHTML = node.innerHTML; 
        node.parentNode.replaceChild(replacement, node);
    }

    neutralizeInlineEvents(node) {
        // Liste non exhaustive des events à neutraliser
        const attrs = Array.from(node.attributes);
        attrs.forEach(attr => {
            if (attr.name.startsWith('on') || attr.name === 'href' && attr.value.startsWith('javascript:')) {
                this.neutralizeAttribute(node, attr.name);
            }
        });
    }

    updateWhitelist(newWhitelist) {
        this.whitelist = new Set(newWhitelist);
    }

    stop() {
        if (this.observer) this.observer.disconnect();
    }
}
