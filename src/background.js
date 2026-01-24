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
						const s = document.createElement('script');
						s.type = 'text/behavior';
						s.src = url;
						document.head.appendChild(s);
					}
				});
			}

        // 2. Injection du CSS
        if (resources.css)
            await api.scripting.insertCSS({
                target: { tabId: tabId, allFrames: true },
                files: resources.css
            });
		
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
					const rawContent = document.body ? document.body.innerText : document.documentElement.textContent;
					
console.log({source: rawContent})
					
					const isAria = (raw) => {
						for(begin of ['<!DOCTYPE aria-ml>', '<aria-ml>', '<aria-ml ', "<aria-ml\n" ])
							if(raw.indexOf(begin) === 0)
								return true;
					}

					if(isAria(rawContent.trim())) {

						const htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
	<meta charset="UTF-8">
</head>
<body>
	${rawContent}
</body>
</html>
`;

						document.open("text/html", "replace");
						document.write(htmlContent);
						document.close();
						document._convertedFromAriaML = true;
						console.info('Document converti du AriaML vers HTML par la web extension.')
					}
				},
                world: "ISOLATED"
            });
            injectAriaResources(details.tabId);
    }
});
