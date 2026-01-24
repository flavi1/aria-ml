/**
 * AriaML embed.js
 * Polyfill autonome (Standalone)
 * Rôle : Injecter les ressources AriaML sans dépendance à une extension.
 */
(async function() {
    // 1. Détecter le chemin de base du script embed.js
    const scriptUrl = new URL(import.meta.url || document.currentScript.src);
    const baseUrl = scriptUrl.href.substring(0, scriptUrl.href.lastIndexOf('/') + 1);

    // 2. Charger le manifest.json pour connaître les ressources
    let manifest;
    try {
        const res = await fetch(`${baseUrl}manifest.json`);
        manifest = await res.json();
    } catch (e) {
        console.error("AriaML: Impossible de charger le manifest.", e);
        return;
    }

    const resources = manifest.ariaml_ressources || {};

    // Fonction utilitaire pour vérifier si une ressource est éligible (pas de .WEBEXT.)
    const isEligible = (path) => !path.includes('.WEBEXT.');

    // --- Injection des ressources ---

    // 1. CSS (Injection immédiate via balise link)
    if (resources.css) {
        resources.css.filter(isEligible).forEach(path => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = `${baseUrl}${path}`;
            document.head.appendChild(link);
        });
    }

    // 2. Behaviors (Injection via balise script avec SRC)
    if (resources.bhv) {
        resources.bhv.filter(isEligible).forEach(path => {
            const script = document.createElement('script');
            script.type = 'text/behavior';
            script.src = `${baseUrl}${path}`;
            document.head.appendChild(script);
        });
    }

    // 3. JavaScript (Injection séquentielle pour respecter les dépendances)
    if (resources.js) {
        const jsFiles = resources.js.filter(isEligible);
        
        for (const path of jsFiles) {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = `${baseUrl}${path}`;
                // Important : en mode standalone, tout s'exécute dans le MAIN world
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
    }

    console.log("AriaML: Polyfill autonome chargé avec succès.");
})();
