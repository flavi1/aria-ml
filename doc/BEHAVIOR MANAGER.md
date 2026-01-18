# AriaML Component Behavior (Spécification de Référence v1.0)
> **Statut :** Projet de standardisation pour l'User Agent.
> **Date :** Janvier 2026
> **Moteur :** AriaML_Core (Polyfill compatible HTML5)

L'**AriaML Component Behavior** est un standard de couche d'interface conçu pour séparer l'interactivité sémantique de la logique applicative. Il permet de définir des comportements interactifs, accessibles et structurels de manière déclarative via des **Behavior Sheets** (`.bhv`).

---

## 1. Principes Fondamentaux

* **Déclaratif & Natif :** Le comportement est interprété nativement par l'User Agent. Le polyfill utilise un `GlobalSheetParser` pour transformer les règles en propriétés d'interface via un Proxy sur `HTMLElement.prototype.behavior`.
* **Accessibilité Native :** Conçu pour implémenter les patterns de l'**ARIA Authoring Practices Guide (APG)** de façon automatisée.
* **Orthogonalité stricte :** Totalement indépendant du rendu visuel (CSS) et de la persistance des données (REST interne).
* **Sémantique Variable :** Le rôle et l'interactivité mutent dynamiquement selon le contexte via les Media Queries et les conditions de support.

---

## 2. Sécurité : "Safe-by-Design"

Le module est isolé du moteur JavaScript traditionnel :
* **Interdiction d'injection :** Impossible d'exécuter du code JS arbitraire ou d'injecter des balises `<script>`.
* **Isolation Réseau :** Les requêtes (`fetch`) sont limitées au Same-Origin pour les ressources `.bhv`.
* **Confinement :** Aucun accès aux cookies, au LocalStorage ou aux APIs d'empreinte numérique (fingerprinting).

---

## 3. Structure et Intégration

### 3.1 Le fichier .bhv (Flat Syntax)
Le standard utilise une syntaxe CSS-like simplifiée. Les propriétés sont automatiquement mappées sur le namespace `.behavior` des éléments DOM.


```css
/* Exemple : navigation.bhv */
[role="menuitem"] {
	rel-panel: (next) [role="menu"];
	on-click: toggle(panel@hidden);
}
```

### 3.2 Déclaration dans le document
Le moteur privilégie la déclaration via des balises scripts typées pour une isolation optimale.

```html
<script type="text/behavior" src="ui-patterns.bhv"></script>

<script type="text/behavior">
	[role="tab"] { on-click: focus(next); }
</script>
```

---

## 4. Remaniement Structurel : La propriété `order`

Contrairement au CSS, la propriété `order` dans AriaML effectue un **déplacement physique réel des nœuds dans le DOM**.

* **Algorithme :** Lors d'un changement de valeur ou d'un événement `resize`, l'User Agent trie les nœuds enfants d'un parent selon leur valeur `order` (ordre croissant).
* **Impact Accessibilité :** Garantit que l'ordre du focus clavier (Tab) et la lecture par synthèse vocale correspondent toujours à l'ordre visuel (Synchronisation Sémantique).

---

## 5. Relations et Chaînage (POV)

Le moteur de résolution (`behaviorResolvers`) transforme les chemins de navigation en listes de nœuds DOM.

### 5.1 Points de Vue Initiaux (POV)
| POV | Description |
| :--- | :--- |
| **root** | Racine du document (`<html>` ou `<aria-ml>`). |
| **self** | L'élément courant (Défaut). |
| **parent** | Parent direct. |
| **siblings** | Frères de l'élément (excluant self). |
| **closest: sel** | Ancêtre le plus proche correspondant au sélecteur `sel`. |
| **branch** | Tous les enfants du parent (incluant self). |

### 5.2 Relations Structurelles Natives
Permettent de naviguer sans identifiants : `first-child`, `last-child`, `next`, `prev`.

### 5.3 Relations Déclaratives (`rel-*`)
Permet de nommer des cibles complexes pour les réutiliser dans les actions.

	rel-table: (closest: section) table;
	on-click: set(table@data-active, "true");

---

## 6. Événements et Interactions

### 6.1 Cycle de Vie
* **init** : Exécuté une seule fois lors de la découverte de l'élément. Idéal pour injecter les rôles ARIA.
* **on-attach** : Exécuté à chaque insertion dans le DOM ou après un remaniement par `order`.

### 6.2 Accords Clavier (`kb-*`)
Utilise une convention de nommage alphabétique pour les touches de modification.
* ✅ `kb-ctrl-s`
* ❌ `kb-s-ctrl` (Invalide)

---

## 7. Bibliothèque des Micro-Actions

L'exécuteur `behaviorActions` traite les séquences de manière asynchrone via `await`.

### 7.1 Mutation d'État et de Classe
* **set(cible@attr, "val")** : Définit l'attribut.
* **set(cible.classe)** : Ajoute la classe.
* **rm(cible@attr)** ou **rm(cible.classe)** : Suppression.
* **toggle(cible@attr, ...états)** : Bascule de classe ou cycle de valeurs (ex: "true", "false", "mixed").

### 7.2 Manipulation du DOM
* **append(parent, enfant)** : Déplace l'enfant à la fin du parent.
* **prepend(parent, enfant)** : Déplace l'enfant au début du parent.
* **remove(cible)** : Destruction physique du nœud.

### 7.3 Affichage et Focus
* **open(cible)** : Affiche (gère nativement `<dialog>`).
* **open-modal(cible)** : Ouverture de dialogue avec **Focus Trap** (via `showModal()`).
* **close(cible)** : Masquage ou fermeture.
* **focus(cible)** : Transfert du focus utilisateur.

---

## 8. Exemples de Patterns Avancés

### 8.1 Détection de Support (Polyfill Natif)

```css
@supports not (element(<details>)) {
	details {
		rel-sum: "(self) summary";
		rel-content: "(siblings) :not(summary)";
		init: set(sum@role, "button") set(sum@tabindex, "0") set(content@hidden);
	}
	summary {
		on-click: toggle(parent@open);
	}
	details[open] {
		init: set(sum@aria-expanded, "true") rm(content@hidden);
	}
}
```

### 8.2 Pattern Tablist (Onglets)

```css
[role="tab"] {
	rel-list: (closest: [role="tablist"]);
	rel-panels: (root) [role="tabpanel"];
	on-click: 
		set(list.branch@aria-selected, "false") 
		set(self@aria-selected, "true")
		set(panels@hidden)
		rm(root.#{{self@aria-controls}}@hidden);
	kb-arrowright: focus(next);
	kb-arrowleft: focus(prev);
}
```

### 8.3 Adaptabilité Sémantique et Layout (Media Queries)

L'une des plus grandes forces d'AriaML est sa capacité à synchroniser l'ordre physique du DOM avec la disposition visuelle. Contrairement au `order` CSS qui n'est que cosmétique (trompeur pour les lecteurs d'écran), le `order` d'AriaML déplace réellement les nœuds dans le DOM pour garantir une navigation clavier cohérente.

#### Fichier : layout.css (Style) MAUVAISE METHODE

```css
/* Le CSS gère uniquement le rendu visuel */
.container {
	display: flex;
	flex-direction: column;
}

@media (min-width: 1024px) {
	.container {
		flex-direction: row;
	}
}
```

#### Fichier : layout.bhv (Comportement AriaML) BONNE METHODE

```css
/* AriaML gère la cohérence du DOM et de l'Accessibilité */
.column-main { 
	order: 1; 
}

.column-aside { 
	order: 2; 
}

@media (min-width: 1024px) {
	.column-aside {
		/* L'Aside passe physiquement en premier nœud du container */
		order: 1; 
		/* Mutation sémantique : devient un repère (landmark) sur Desktop */
		role: complementary;
		aria-label: "Navigation latérale";
	}
	
	.column-main {
		order: 2;
		role: main;
	}
}
```


**Pourquoi cette distinction est capitale ?**

1.  **Cohérence du Focus :** Sur Desktop, si l'Aside est à gauche, l'utilisateur s'attend à ce que la première pression sur `Tab` arrive dans l'Aside. AriaML garantit que l'ordre du focus suit l'ordre visuel.
2.  **Sémantique Responsive :** Un élément peut n'être qu'un simple conteneur sur mobile et acquérir un `role` sémantique fort sur desktop, optimisant ainsi l'arbre d'accessibilité sans modifier le code HTML source.
3.  **DOM Unique :** Évite la duplication de contenu (souvent utilisée en "Mobile First" pour masquer/afficher des blocs différents), ce qui réduit le poids de la page et évite les conflits d'IDs.

---
