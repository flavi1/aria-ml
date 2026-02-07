/**
 * AriaMLWebPage.js
 * Gère la synchronisation du <head> et des propriétés globales du document.
 */
export default class AriaMLWebPage {
    constructor(data) {
        this.data = data;
        this.prefix = "ariaml-sync-"; // Pour identifier et nettoyer les balises injectées
    }

    /**
     * Point d'entrée principal
     */
    sync() {
        if (!this.data) return;

        this.clearPreviousSync();
        this.syncGlobals();
        this.syncMetadatas();
        this.syncProperties();
        this.syncWorkTranslations();
        this.syncRelatedLinks();
        this.syncLegacyLinks();
    }

    /**
     * Nettoie les balises injectées lors de la précédente navigation
     */
    clearPreviousSync() {
        document.querySelectorAll(`[data-origin^="${this.prefix}"]`).forEach(el => el.remove());
    }

    /**
     * Synchronise les éléments globaux (Titre, Langue, Direction)
     */
    syncGlobals() {
        if (this.data.name) document.title = this.data.name;
        if (this.data.direction) document.documentElement.dir = this.data.direction;
        if (this.data.inLanguage) document.documentElement.lang = this.data.inLanguage;
        
        // Gestion du CSRF (souvent utile pour les formulaires internes)
        if (this.data.csrfToken) {
            this.createTag('meta', { name: 'csrf-token', content: this.data.csrfToken });
        }
    }

    /**
     * Mappe le bloc "metadatas" -> meta[name]
     */
    syncMetadatas() {
        const metas = this.data.metadatas || {};
        for (const [name, content] of Object.entries(metas)) {
            this.createTag('meta', { name, content });
        }
    }

    /**
     * Mappe le bloc "properties" -> meta[property]
     */
    syncProperties() {
        const props = this.data.properties || {};
        for (const [property, content] of Object.entries(props)) {
            this.createTag('meta', { property, content });
        }
    }

    /**
     * Mappe "workTranslation" -> link[rel="alternate"]
     */
    syncWorkTranslations() {
        const translations = this.data.workTranslation || [];
        translations.forEach(item => {
            this.createTag('link', {
                rel: 'alternate',
                hreflang: item.inLanguage,
                href: item.url,
                media: item.media,
                title: item.name || item.headline
            });
        });
    }

    /**
     * Mappe "relatedLink" -> link (RSS, PDF, etc.)
     */
    syncRelatedLinks() {
        const related = this.data.relatedLink || [];
        related.forEach(item => {
            this.createTag('link', {
                rel: item.rel || 'related',
                type: item.encodingFormat,
                href: item.url,
                title: item.name || item.headline,
                integrity: item.integrity
            });
        });
    }

    /**
     * Mappe "legacyLinks" -> link (Tags bruts)
     */
    syncLegacyLinks() {
        const legacy = this.data.legacyLinks || [];
        legacy.forEach(attrs => {
            // Ici, attrs contient déjà rel, href, sizes, etc.
            this.createTag('link', attrs);
        });
    }

    /**
     * Utilitaire de création de balise
     */
    createTag(tagName, attributes) {
        const el = document.createElement(tagName);
        el.setAttribute('data-origin', this.prefix + tagName);
        
        for (const [key, value] of Object.entries(attributes)) {
            if (value) el.setAttribute(key, value);
        }
        
        document.head.appendChild(el);
    }
}
