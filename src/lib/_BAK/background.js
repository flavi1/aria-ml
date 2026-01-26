const api = typeof browser !== "undefined" ? browser : chrome;

async function injectAriaResources(tabId) {
    const manifest = chrome.runtime.getManifest();
    const resources = manifest.web_accessible_resources[0].ariaml_ressources;

    try {
		
        // 1. Injection des Beahaviors
        if (resources.bhv)
			for(f of resources.bhv) {
				await chrome.scripting.executeScript({
					target: { tabId: tabId, allFrames: true },
					world: 'MAIN',
					args: [chrome.runtime.getURL(f)],
					func: (url) => {
						if(!document.querySelector('aria-ml'))
							return;
						const s = document.createElement('script');
						s.type = 'text/behavior';
						s.src = url;
						document.head.appendChild(s);
					}
				});
			}

        // 2. Injection du CSS
        if (resources.css)
			for(f of resources.css) {
				await chrome.scripting.executeScript({
					target: { tabId: tabId, allFrames: true },
					world: 'MAIN',
					args: [chrome.runtime.getURL(f)],
					func: (url) => {
						if(!document.querySelector('aria-ml'))
							return;
						const l = document.createElement('link');
						l.rel = 'stylesheet';
						l.href = url;
						document.head.appendChild(l);
					}
				});
			}
		
        // 3. Injection des scripts JS
        if (resources.js)
			for(s of resources.js) {
				await api.scripting.executeScript({
					target: { tabId: tabId, allFrames: true },
					files: [s],
					world: (s.indexOf('/ISOLATED/') !== -1) ? 'ISOLATED' : 'MAIN'
				});
			}



        console.log("AriaML: Ressources dynamiques injectées avec succès.");
    } catch (err) {
        console.error("AriaML: Erreur d'injection", err);
    }
}

api.webNavigation.onCommitted.addListener((details) => {
    if (details.url.startsWith('http')) {
            api.scripting.executeScript({
                target: { tabId: details.tabId, frameIds: [details.frameId] },
                func: () => {
					if(document._needAriaML)
						console.info('Document converti du AriaML vers HTML par la web extension.')
					document.documentElement.style.display = 'block';
				},
                world: "ISOLATED"
            });
            injectAriaResources(details.tabId);
    }
});
