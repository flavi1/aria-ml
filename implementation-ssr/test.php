<?php
	//sleep(2);
	
    require_once 'AriaML.php';
    $render = AriaML::handle();
?>
<aria-ml
    prefix="og: http://ogp.me/ns# another: http://another.org/ns#"
    lang="fr"
>
    <script type="ld+json">
	[{
		"@context": "https://ariaml.org/ns#",
		"@type": "PageProperties",
		"canonical": "https://canonical.lnk",
		"csrf-token": "MyToken",
		"metadatas": {
			"title": {
				"content": "Ma super page",
				"property": ["og:title", "another:title"]
			},
			"description" : {
				"name": ["description", "twitter:description"],
				"property": ["og:description", "another:description"],
				"content": "La référence HTML décrit tous les éléments et attributs HTML."
			}
		}
	}]
    </script>
    
	<script type="style+json">
	{
		"browserColor": "red",
		"viewport": "width=device-width, initial-scale=2",
		"assets": [
			{ "rel": "icon", "type": "image/png", "sizes": "32x32", "href": "/favicon-32x32.png" },
			{ "rel": "apple-touch-icon", "sizes": "180x180", "href": "/apple-touch-icon.png" },
			{ "rel": "shortcut icon", "href": "/favicon.ico" },
			{ "rel": "stylesheet", "href": "aria-ml-demo.css" },
			{ "rel": "stylesheet", "href": "persistant1.css" },
			{ "rel": "stylesheet", "href": "persistant2.css" },
			{ "rel": "stylesheet", "media": "(min-width: 1000px)", "href": "persistant-big-sreen.css" }
		],
		"volatileClasses": {
			"header" : "text-align-left",
			"main" : ["text-align-right", "center"]
		},
		"defaultTheme": "ThemeClair",
		"themeList": {
			"ThemeClair": {
				"media": "(prefers-color-scheme: light)",
				"browserColor": "green",
				"volatileClasses": {
					"header" : ["bg1"],
					"main" : ["bg2", "big"]
				},
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
	
	<header slot="header" style="view-transition-name: slot-header;"><h1>HEADER_<?php echo $i; ?></h1></header>
	
	<main slot="main" style="view-transition-name: slot-main;">
		<h2>MAIN_<?php echo $i; ?></h2>
		<h3>Le document est prêt.</h3>
		<a href="?i=<?php echo $i + 1; ?>">Page <?php echo $i + 1; ?></a>
		<a href="https://google.fr">google.fr</a>
		<p>Ce contenu est encapsulé dans &lt;aria-ml&gt;.</p>
		<span live-cache="remember">Ignoré?</span>
		<script>console.log('JS ACTIF')</script>
		
		<div role="tablist" aria-label="Exemple d'onglets">
            
            <button role="tab" 
                    aria-selected="true" 
                    aria-controls="panel-1" 
                    id="tab-1">
                Description
            </button>

            <button role="tab" 
                    aria-selected="false" 
                    aria-controls="panel-2" 
                    id="tab-2">
                Spécifications
            </button>

            <button role="tab" 
                    aria-selected="false" 
                    aria-controls="panel-3" 
                    id="tab-3">
                Commentaires
            </button>

        </div>

        <section role="tabpanel" id="panel-1" aria-labelledby="tab-1">
            <h3>Contenu Description</h3>
            <p>Voici le texte de présentation du produit.</p>
        </section>

        <section role="tabpanel" id="panel-2" aria-labelledby="tab-2" hidden>
            <h3>Fiche Technique</h3>
            <ul>
                <li>Poids : 500g</li>
                <li>Matière : Polymère</li>
            </ul>
        </section>

        <section role="tabpanel" id="panel-3" aria-labelledby="tab-3" hidden>
            <h3>Avis clients</h3>
            <p>Aucun commentaire pour le moment.</p>
        </section>
		
		
	</main>
	
	<script>
        // On active la verbosité maximum pour le debug
        window.ARIAML_LOG_LEVEL = 1;
    </script>
	
	<!--script type="text/behavior">
[role="tab"] {
	rel-tablist: "(closest: [role=tablist]) [role=tab]";
	rel-tabpanel: "(root) #{aria-controls}";
	
	on-click:
		log(self, tablist, tabpanel)
		set(tablist@aria-selected, "false")
		set(tablist/tabpanel@hidden)
		set(self@aria-selected, "true")
		rm(tabpanel@hidden);
	kb-arrowright: focus(next);
	kb-arrowleft: focus(prev);
}
	</script-->
	
	<!--script type="text/behavior">
[role="tab"] {
	on-click: behavior() log(tablist/tabpanel);
}
	</script-->



<script type="behavior">

[role="accordion"] [role="button"] {
    behavior: accordion-trigger;
}
</script>

<div role="accordion">
    <h3>
        <button role="button" aria-controls="p1" aria-expanded="true">Section 1</button>
    </h3>
    <div id="p1" role="region">Contenu 1...</div>

    <h3>
        <button role="button" aria-controls="p2" aria-expanded="false">Section 2</button>
    </h3>
    <div id="p2" role="region" hidden>Contenu 2...</div>
</div>
	
</aria-ml>
<?php $render(); ?>

