<?php
    require_once 'AriaML.php';
    $render = AriaML::handle(true); // Active le mode test client
?>
<aria-ml
    prefix="og: http://ogp.me/ns# another: http://another.org/ns#"
    lang="fr"
>
    <script type="application/ld+json">
	[{
		"@context": "https://ariaml.org/ns#",
		"@type": "PageProperties",
		"canonical": "https://canonical.lnk",
		"CSRF": "MyToken",
		"metadatas": [{
				"name": "title",
				"content": "Ma super page",
				"property": ["og:title", "another:title"]
			},
			{
				"name": ["description", "twitter:description"],
				"property": ["og:description", "another:description"],
				"content": "La référence HTML décrit tous les éléments et attributs HTML."
			}
		]
	}]
    </script>
    
	<script type="application/appearance+json">
	{
		"defaultBrowserColor": "red",
		"defaultViewport": "width=device-width, initial-scale=2",
		"assets": [
			{ "rel": "icon", "type": "image/png", "sizes": "32x32", "href": "/favicon-32x32.png" },
			{ "rel": "apple-touch-icon", "sizes": "180x180", "href": "/apple-touch-icon.png" },
			{ "rel": "shortcut icon", "href": "/favicon.ico" },
			{ "rel": "stylesheet", "href": "persistant1.css" },
			{ "rel": "stylesheet", "href": "persistant2.css" },
			{ "rel": "stylesheet", "media": "(min-width: 1000px)", "href": "persistant-big-sreen.css" }
		],
		"defaultTheme": "ThemeClair",
		"themeList": {
			"ThemeClair": {
				"media": "(prefers-color-scheme: light)",
				"browserColor": "green",
				"assets": [
					{ "rel": "stylesheet", "href": "clair.css" },
					{ "rel": "stylesheet", "media": "(min-width: 1000px)", "href": "big-sreen.css" }
				]
			},
			"ThemeSombre": {
				"media": "(prefers-color-scheme: dark)",
				"browserColor": "#ccc",
				"viewport": "width=device-width, initial-scale=1",
				"assets": [
					{ "rel": "stylesheet", "href": "sombre.css" },
					{ "rel": "stylesheet", "media": "(min-width: 1000px)", "href": "big-sreen-dark.css" }
				]
			}
		}
	}
	</script>
	
	<main slot="main">
		<h1>Le document est prêt.</h1>
		<p>Ce contenu est encapsulé dans &lt;aria-ml&gt;.</p>
		<span slot="a-slot-in-another-slot">Yes! Rien à faire!</span>
	</main>
</aria-ml>
<?php $render(); ?>

