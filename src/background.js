/**
 * background.js - Gestionnaire d'injection AriaML
 */
const api = typeof browser !== "undefined" ? browser : chrome;

/**
 * Vérifie si le document est identifié comme AriaML dans le monde ISOLATED.
 */
async function isAriaMLContext(tabId, frameId) {
    try {
        const [result] = await api.scripting.executeScript({
            target: { tabId: tabId, frameIds: [frameId] },
            world: 'ISOLATED',
            func: () => {
                // On vérifie le marqueur posé par start.WEBEXT.js
                return !!(document._needAriaML || document.querySelector('aria-ml'));
            }
        });
        return !!result?.result;
    } catch (e) {
        return false;
    }
}

/**
 * Injecte les ressources AriaML définies dans le manifest.
 */
async function injectAriaResources(tabId, frameId) {
    // 1. Diagnostic de sécurité
    const isAria = await isAriaMLContext(tabId, frameId);
    if (!isAria) return;

    const manifest = api.runtime.getManifest();
    const resources = manifest.web_accessible_resources[0].ariaml_ressources;

    try {
        // 2. Injection des Behaviors (MAIN WORLD)
        if (resources.bhv) {
            for (const f of resources.bhv) {
                await api.scripting.executeScript({
                    target: { tabId: tabId, frameIds: [frameId] },
                    world: 'MAIN',
                    args: [api.runtime.getURL(f)],
                    func: (url) => {
                        const s = document.createElement('script');
                        s.type = 'text/behavior';
                        s.src = url;
                        document.head.appendChild(s);
                    }
                });
            }
        }

        // 3. Injection du CSS (MAIN WORLD)
        if (resources.css) {
            for (const f of resources.css) {
                await api.scripting.executeScript({
                    target: { tabId: tabId, frameIds: [frameId] },
                    world: 'MAIN',
                    args: [api.runtime.getURL(f)],
                    func: (url) => {
                        const l = document.createElement('link');
                        l.rel = 'stylesheet';
                        l.href = url;
                        document.head.appendChild(l);
                    }
                });
            }
        }

        // 4. Injection des scripts JS (ISOLATED ou MAIN)
        if (resources.js) {
            for (const s of resources.js) {
                await api.scripting.executeScript({
                    target: { tabId: tabId, frameIds: [frameId] },
                    files: [s],
                    world: (s.includes('/ISOLATED/')) ? 'ISOLATED' : 'MAIN'
                });
            }
        }

        console.info(`AriaML: Ressources injectées dans le frame ${frameId}.`);
    } catch (err) {
        console.error("AriaML: Erreur d'injection", err);
    }
}

/**
 * Écouteur de navigation
 */
api.webNavigation.onCommitted.addListener((details) => {
    // On ignore les protocoles spéciaux (chrome://, about://, etc.)
    if (details.url.startsWith('http')) {
        
        // On affiche le message de conversion si nécessaire dans la console ISOLATED
        api.scripting.executeScript({
            target: { tabId: details.tabId, frameIds: [details.frameId] },
            world: "ISOLATED",
            func: () => {
                if (document._needAriaML) {
                    console.info('Document converti du AriaML vers HTML par la web extension.');
                }
                else
					console.info('Ce document n\'est pas un document AriaML.');
                document.documentElement.style.display = 'block';
            }
        });

        // Lancement de la procédure d'injection conditionnelle
        injectAriaResources(details.tabId, details.frameId);
    }
});
