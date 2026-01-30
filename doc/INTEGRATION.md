# Spécification du Standard AriaML

## **1. Structure du Document**

### **a. Implémentation "Native"**

Dans une architecture native, AriaML remplace la structure HTML traditionnelle. Le document est un flux sémantique pur où la configuration est déclarée en premier.

```html
<!DOCTYPE aria-ml>
<aria-ml lang="fr">
    <script type="ld+json" slot="definition">
    [{
        "@context": "[https://ariaml.org/ns#](https://ariaml.org/ns#)",
        "@type": "PageProperties",
        "metadatas": {"title": { "name": "title", "content": "Accueil" }},
    }]
    </script>
	<script type="application/appearance+json" slot="appearance">
	{
		"browserColor": "red",
		"viewport": "width=device-width, initial-scale=1",
		"assets": [
			{ "rel": "shortcut icon", "href": "/favicon.ico" },
			{ "rel": "stylesheet", "href": "persistant1.css" },
			{ "rel": "stylesheet", "media": "(min-width: 1000px)", "href": "persistant-big-sreen.css" }
		]
	}
	</script>
    <main slot="main">
        <h1>Contenu natif</h1>
    </main>
</aria-ml>
```

### **b. Implémentation Embarquée (Polyfill)**

Pour les environnements web actuels, AriaML s'intègre via un polyfill unique. Le serveur peut délivrer un squelette HTML minimaliste qui sera interprété par le client en document AriaML.

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <script src="aria-ml-polyfill.js" defer></script>
</head>
<body>
    <aria-ml>

        <script type="ld+json" slot="definition"> ... </script>
        <script type="style+json" slot="appearance"> ... </script>
        <main slot="main">...</main>

    </aria-ml>
</body>
</html>
```

### **c. Traitement Serveur et Négociation de Contenu**

Le standard AriaML permet au serveur de se comporter comme un orchestrateur intelligent. Grâce à la **négociation de contenu**, le serveur peut décider de servir soit un document complet (pour un premier accès ou le SEO), soit un fragment (pour une mise à jour fluide).

#### **Principe de fonctionnement**

1. **Analyse de la requête** : Le serveur vérifie la présence de l'en-tête HTTP `Accept`. Si la valeur contient `text/aria-ml`, le serveur sait qu'il s'adresse à un document déjà chargé capable de traiter une mutation.
2. **Extraction Sémantique** : Le serveur traite le document AriaML source pour en extraire :
   * Les **PageProperties** (JSON-LD) afin de mettre à jour le contexte global (titre, thèmes).
   * Les **Slots** spécifiques demandés ou modifiés.
3. **Génération du Flux** :
   * **Accès Standard** : Le serveur génère un document HTML complet. Il injecte les métadonnées dans le `<head>` (SSR) et place le contenu AriaML dans le `<body>`.
   * **Accès Dynamique** : Le serveur génère uniquement un `<aria-ml-fragment>` contenant les slots mis à jour et les métadonnées essentielles.

#### **Responsabilités du Serveur**

| Tâche | Description |
| :--- | :--- |
| **Normalisation JSON-LD** | S'assurer que les propriétés définies dans `<aria-ml>` sont syntaxiquement correctes. |
| **Mapping des Assets** | Identifier quels fichiers CSS/JS sont persistants ou liés à un thème spécifique. |
| **Transpilation** | Convertir les données du JSON-LD en balises HTML standards (`<title>`, `<meta>`, `<link>`) lors d'un rendu complet. |
| **Sécurité (CSP)** | Extraire l'attribut `csp` de la balise `<aria-ml>` pour l'envoyer via les en-têtes HTTP. |

---

## **2. Modification Dynamique des Propriétés**

Le cœur d'AriaML est son **Proxy réactif**. Contrairement au HTML classique où vous manipulez le DOM, ici vous manipulez l'objet `window.PageProperties`.

### **Synchronisation Immédiate**

Dès qu'une propriété de l'objet est modifiée, le moteur AriaML répercute le changement sur les API du navigateur ou les balises du `<head>`.

| Propriété JSON | Impact sur le document |
| :--- | :--- |
| `metadatas[title].content` | Met à jour `document.title`. |
| `appearance.defaultBrowserColor` | Met à jour `<meta name="theme-color">`. |
| `lang` | Met à jour l'attribut `lang` sur `<html>`. |

### **Exemples de manipulation JS**

```javascript
// Le titre passe instantanément de "Accueil" à "Tableau de bord"
PageProperties.metadatas.title.content = "Tableau de bord";

// Modifie la couleur de la barre d'adresse/interface du navigateur
Appearance.defaultBrowserColor = "#2c3e50";
```

---

## **3. Theme Manager**

Le `ThemeManager` est le module responsable de l'interprétation visuelle. Il utilise une structure JSON-LD riche pour orchestrer les assets.

### **Exemple de configuration riche**

```json
	{
		"browserColor": "red",
		"viewport": "width=device-width, initial-scale=2",
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
```

### **Logique de Résolution Stricte**

1. **Priorité Manuelle** : Si `ThemeManager.setTheme('Nom')` a été appelé (sauvegardé en localStorage).
2. **Match Média** : Si une propriété `media` correspond à l'état du système.
3. **Fallback** : Utilisation du `defaultTheme` spécifié.

---



