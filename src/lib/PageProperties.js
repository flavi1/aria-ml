/**
 * AriaML PageProperties.Proxy.js
 * Polyfill pour le MAIN world : expose l'API réactive.
 * Synchronise uniquement avec la balise <script type="application/ld+json">.
 */
(function() {
	
	// --- Surcharge de document.title ---
    const originalTitleDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'title');

    Object.defineProperty(document, 'title', {
        get() {
            return originalTitleDescriptor.get.call(this);
        },
        set(val) {
            // 1. On met à jour le DOM réel (convention HTML)
            originalTitleDescriptor.set.call(this, val);

            // 2. On synchronise avec PageProperties (AriaML)
            if (window.PageProperties) {
                if (!window.PageProperties.metadatas) window.PageProperties.metadatas = {};
                if (!window.PageProperties.metadatas.title) window.PageProperties.metadatas.title = {};
                
                window.PageProperties.metadatas.title.content = val;
                // Le setter du Proxy s'occupe de dispatcher 'ariaml:updated' et de sauver le script
            }
        },
        configurable: true
    });
	
    const findTargetScript = () => {
        const scripts = document.querySelectorAll('aria-ml script[type="application/ld+json"]');
        for (const s of scripts) {
            try {
                const j = JSON.parse(s.textContent);
                if ((Array.isArray(j) ? j : [j]).some(i => i["@type"] === "PageProperties")) return s;
            } catch (e) { continue; }
        }
        return null;
    };

    const updateScriptSource = (data) => {
        const s = findTargetScript();
        if (!s) return;
        try {
            let j = JSON.parse(s.textContent);
            if (Array.isArray(j)) {
                const idx = j.findIndex(i => i["@type"] === "PageProperties");
                if (idx !== -1) j[idx] = data;
            } else {
                j = data;
            }
            s.textContent = JSON.stringify(j, null, 2);
        } catch (e) { console.error("AriaML: Failed to sync proxy to script tag."); }
    };

    function createDeepProxy(obj, onChange) {
        return new Proxy(obj, {
            get(target, prop) {
                const value = Reflect.get(target, prop);
                return (value && typeof value === 'object') ? createDeepProxy(value, onChange) : value;
            },
            set(target, prop, value) {
                const res = Reflect.set(target, prop, value);
                onChange();
                return res;
            }
        });
    }

    // Initialisation du Proxy avec les données actuelles de la balise script
    let initialData = {};
    const s = findTargetScript();
    if (s) {
        try {
            const j = JSON.parse(s.textContent);
            initialData = Array.isArray(j) ? j.find(i => i["@type"] === "PageProperties") : j;
        } catch (e) {}
    }

    window.PageProperties = createDeepProxy(initialData || {}, () => {
        updateScriptSource(window.PageProperties);
        // Notification pour le monde ISOLATED (sans PostMessage)
        document.dispatchEvent(new CustomEvent('ariaml:updated'));
    });
})();
