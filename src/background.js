const api = typeof browser !== "undefined" ? browser : chrome;
const polyfillBase = 'https://flavi1.github.io/aria-ml/js/aria-ml/';
const distUrl = `${polyfillBase}dist.json`;

let cachedDist = null;

async function getDist() {
    if (cachedDist) return cachedDist;
    try {
        const response = await fetch(distUrl);
        cachedDist = await response.json();
        return cachedDist;
    } catch (e) {
        console.error("Erreur lors de la récupération du dist.json", e);
        return null;
    }
}

api.webNavigation.onCommitted.addListener((details) => {
    if (details.url.startsWith('http')) {
        injectAriaML(details.tabId, details.frameId);
    }
});

async function injectAriaML(tabId, frameId) {
    const dist = await getDist();
    if (!dist) return;

    // --- 1. CORE CONVERTER (Monde ISOLATED) ---
    // Exécuté directement pour piloter la conversion
    await api.scripting.executeScript({
        target: { tabId: tabId, frameIds: [frameId] },
        files: ['converter.js'],
        world: "ISOLATED"
    });

    // --- 2. RESSOURCES JS (Monde ISOLATED) ---
    // On injecte le code via eval pour qu'il soit disponible dans le scope ISOLATED
    if (dist.js) {
        for (const fileName of dist.js) {
            const fullPath = `${polyfillBase}${fileName}`;
            const code = await fetch(fullPath).then(r => r.text());
            
            await api.scripting.executeScript({
                target: { tabId: tabId, frameIds: [frameId] },
                func: (code) => { eval(code); },
                args: [code],
                world: "ISOLATED"
            });
        }
    }

    // --- 3. RESSOURCES BHV (Monde MAIN via appendChild) ---
    // On crée une balise script pour que le comportement soit "public" pour la page
    if (dist.bhv) {
        for (const fileName of dist.bhv) {
            const fullPath = `${polyfillBase}${fileName}`;
            
            await api.scripting.executeScript({
                target: { tabId: tabId, frameIds: [frameId] },
                func: (url) => {
                    const s = document.createElement('script');
                    s.src = url;
                    s.onload = () => s.remove(); // Nettoyage propre
                    (document.head || document.documentElement).appendChild(s);
                },
                args: [fullPath],
                world: "MAIN" // Très important pour les interactions DOM/Scripts tiers
            });
        }
    }

    // --- 4. CSS (API Native) ---
    if (dist.css) {
        for (const file of dist.css) {
            const cssContent = await fetch(`${polyfillBase}${file}`).then(r => r.text());
            await api.scripting.insertCSS({
                target: { tabId: tabId, frameIds: [frameId] },
                css: cssContent
            });
        }
    }
}

