/**
 * AriaML standalone.js
 * Polyfill autonome (Standalone)
 * Rôle : Injecter les ressources AriaML sans dépendance à une extension.
 */
(async function() {
    // 1. Détecter le chemin de base du script embed.js
    const scriptUrl = new URL(document.currentScript.src);
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

    const resources = manifest.web_accessible_resources[0].ariaml_ressources || {};

    // Fonction utilitaire pour vérifier si une ressource est éligible (pas de .WEBEXT.)
    const isEligible = (path) => !path.includes('.WEBEXT.');

	// --- Injection des ressources (Ordre de priorité : Système en premier dans le DOM) ---

	// Note : On traite JS en dernier car il dépend du DOM, 
	// mais on injecte CSS et BHV en haut du <head> (prepend).

	// 1. Behaviors (Préfixés pour être surchargés)
	if (resources.bhv) {
		// On inverse pour maintenir l'ordre interne du manifest lors du prepend
		[...resources.bhv].reverse().filter(isEligible).forEach(path => {
			const script = document.createElement('script');
			script.type = 'text/behavior';
			script.src = `${baseUrl}${path}`;
			document.head.prepend(script);
		});
	}

	// 2. CSS (Préfixés pour être surchargés)
	if (resources.css) {
		[...resources.css].reverse().filter(isEligible).forEach(path => {
			const link = document.createElement('link');
			link.rel = 'stylesheet';
			link.href = `${baseUrl}${path}`;
			document.head.prepend(link);
		});
	}

	// 3. JavaScript (Reste en bas du head ou body pour l'exécution)
	if (resources.js) {
		const jsFiles = resources.js.filter(isEligible);
		for (const path of jsFiles) {
			await new Promise((resolve, reject) => {
				const script = document.createElement('script');
				script.src = `${baseUrl}${path}`;
				script.onload = resolve;
				script.onerror = reject;
				document.head.appendChild(script); 
			});
		}
	}

    console.log("AriaML: Polyfill autonome chargé avec succès.");
})();
