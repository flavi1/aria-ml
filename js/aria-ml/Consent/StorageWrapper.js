/**
 * StorageWrapper pour AriaML
 * Gère la persistance hybride (Extension Storage ou IndexedDB).
 */
class StorageWrapper {
    constructor() {
        this.dbName = 'AriaML_ShadowStorage';
        this.storeName = 'consent_cache';
        this.db = null;
    }

    /**
     * Initialise la connexion à IndexedDB.
     */
    async init() {
        // Si on est dans une WebExtension, on pourrait utiliser chrome.storage.local
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            this.type = 'EXTENSION';
            return true;
        }

        this.type = 'INDEXEDDB';
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName);
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(true);
            };

            request.onerror = () => reject(new Error("Shadow Storage inaccessible"));
        });
    }

    /**
     * Récupère le consentement pour l'origine actuelle.
     */
    async getConsent() {
        const key = window.location.origin;

        if (this.type === 'EXTENSION') {
            return new Promise(res => {
                chrome.storage.local.get([key], (result) => res(result[key] || null));
            });
        }

        return new Promise((resolve) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(key);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => resolve(null);
        });
    }

    /**
     * Sauvegarde les décisions de consentement.
     */
    async saveConsent(decisions) {
        const key = window.location.origin;
        const data = {
            decisions,
            timestamp: Date.now(),
            version: "1.0"
        };

        if (this.type === 'EXTENSION') {
            return new Promise(res => {
                chrome.storage.local.set({ [key]: data }, res);
            });
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.put(data, key);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error("Échec de l'écriture Shadow Storage"));
        });
    }

    /**
     * Supprime le consentement (Révocation).
     */
    async clearConsent() {
        const key = window.location.origin;
        if (this.type === 'EXTENSION') {
            return new Promise(res => chrome.storage.local.remove([key], res));
        }
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        transaction.objectStore(this.storeName).delete(key);
    }
}
