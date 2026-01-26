# Navigation : L’Évolution Dynamique du Document AriaML

Dans le standard AriaML, la navigation n'est pas un remplacement de page, mais une **mutation sémantique**. Le document racine `<aria-ml>` est persistant, tandis que son contenu évolue par injection de fragments ou repeuplement total, orchestré par un cycle de transition sécurisé.

---

## 1. Le Fragment comme Vecteur de Mutation
Un fragment AriaML permet de mettre à jour la substance sémantique sans rompre la continuité du rendu.

### Architecture d'un Fragment (V1.4)
Un fragment doit être capable de restaurer le document racine s'il est consulté hors contexte.

```html
<meta http-equiv="refresh" content="0;url=./">
<style>aria-ml .aria-ml-fallback {display: none;}</style>
<div class="aria-ml-fallback">Chargement du document...</div>

<aria-ml-fragment>
	<script type="application/ld+json">
	[{
		"@context": "[https://ariaml.org/ns#](https://ariaml.org/ns#)",
		"@type": "PageProperties",
		"metadatas": [{ "name": "title", "content": "Nouvelle Vue" }]
	}]
	</script>

	<main slot="main">
		<h1>Contenu injecté</h1>
		<p live-cache="unique-key">Ce nœud sera persisté en mémoire.</p>
	</main>
</aria-ml-fragment>
```

---

## 2. Le Cycle de Navigation SPA

### A. Négociation et Requête
1. **Interception** : Le `NavigationManager` intercepte les clics (`<a>`) et les soumissions (`<form>`) dont la cible est `_slots`.
2. **Verrouillage Initial** : Dès l'intention, le document racine (`<html>`) est marqué `aria-busy="true"` et `inert`.
3. **NodeCache Header** : La requête inclut l'en-tête `Live-Cache: ["key1", "key2"]` listant les nœuds déjà connus du client.

### B. Stratégie de Verrouillage Asymétrique
AriaML 1.4 distingue deux types de mutations après réception de la réponse :

| Type de Mutation | Cible de Verrouillage (`aria-busy`/`inert`) | Durée du Verrouillage |
| :--- | :--- | :--- |
| **Full Replacement** (`<aria-ml>`) | Racine globale (`documentElement`) | Jusqu'à la fin de la transition. |
| **Partial Update** (`<aria-ml-fragment>`) | **Slots cibles uniquement** | Jusqu'à la fin de l'animation du slot. |

> **Note :** Dans le cas d'une mise à jour partielle, la racine globale est libérée immédiatement pour permettre l'interaction avec le reste de la page (menus, header) pendant que les slots mutent.

---

## 3. Système NodeCache (Live-Cache)

Le **NodeCache** assure la persistance des nœuds DOM entre les vues, indépendamment de la pile d'historique.

* **Enregistrement** : Un `MutationObserver` capture tout élément portant l'attribut `live-cache`.
* **Restauration** :
    * **Slots (`<aria-ml-fragment>`)** : Le conteneur est préservé, le contenu (children) est déplacé depuis le cache vers le nouveau slot.
    * **Éléments standards** : Le nœud vide envoyé par le serveur est remplacé par le nœud réel stocké en mémoire.
* **Persistance** : Le cache survit même si l'élément est détaché du DOM (ex: pagination).



---

## 4. Transitions et Feedback Visuel

AriaML utilise les **View Transitions API** de manière optionnelle et progressive :

* **Fallback CSS** : Si les transitions ne sont pas supportées ou désactivées (`prefers-reduced-motion`), une mise à jour directe est effectuée.
* **Loading State** : Un backdrop (flou/voile) s'affiche après un délai de **300ms** sur tout élément `aria-busy`.
* **Accessibilité** : Les éléments masqués visuellement (`[visually-hidden]`) utilisent le pattern **FFOODD** pour réapparaître proprement au focus clavier.

---

## 5. Gestion des Formulaires et Verbes Étendus

AriaML bypass les limitations natives du HTML :
* **Méthodes** : Support de `PUT`, `PATCH`, `DELETE` via une émulation par champ caché (`_method`) dans un **Shadow Form**.
* **Encodage JSON** : `enctype="application/json"` convertit les données et les fichiers (Base64) en un objet JSON unique transmis via le champ `_json`.
* **Cibles Classiques** : Si la `target` n'est pas `_slots` (ex: `_blank`), le moteur génère un formulaire éphémère pour soumettre la requête en conservant les verbes étendus.

---

## 6. Sécurité et Intégrité

### Jeton CSRF
Extrait dynamiquement des `PageProperties` (JSON-LD), le jeton est injecté :
1. Dans l'en-tête `X-CSRF-TOKEN` pour les requêtes `fetch`.
2. Dans un champ caché `_token` pour les navigations via Shadow Form.

### Verrouillage du Périmètre
Le `navigationBaseUrl` définit la zone de confiance. Toute navigation sortant de cette origine décharge l'AriaML Engine pour revenir à un mode de navigation classique, garantissant qu'aucun fragment tiers ne puisse accéder aux nœuds mis en cache ou aux propriétés du document.

---

## 7. Gestion du Focus
Après chaque mutation, le focus est réattribué selon la priorité suivante :
1. Élément portant l'attribut `autofocus` dans le nouveau contenu.
2. Le premier slot impacté (avec `tabindex="-1"` si nécessaire).
3. La racine `<aria-ml>`.
