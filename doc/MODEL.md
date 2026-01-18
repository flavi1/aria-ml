# Dossier de Conception : AriaML Model (In-Memory REST XML)

## 1. État de la Réflexion et Vision
AriaML Model n'est pas une simple bibliothèque de gestion d'état, mais un polyfill pour un futur standard de "Programmable HTML". Il permet de manipuler des données locales avec la même logique qu'une API REST distante, rendant le JavaScript facultatif à terme.

### Choix Structuraux Validés :
* **Format de donnée** : XML pur (choisi pour la puissance de XPath et sa structure arborescente native).
* **Sélecteur de données** : XPath (standard, ultra-performant, gère les attributs et les prédicats).
* **Interface de communication** : Verbes HTTP simulés (GET, POST, PUT, PATCH, DELETE).
* **Cible (Target)** : L'identifiant local `#id` (ex: `action="#mon-model"`).

---

## 2. Architecture Technique

### 2.1. Le Conteneur `<aria-ml-model>`
Élément personnalisé (`CustomElement`) servant de serveur local.
* **Lazy Initialization** : Le `DOMParser` ne s'active qu'au premier appel REST.
* **Persistance** : L'état est sérialisé en temps réel dans un `<script type="xml">` interne.
* **Clean Serialization** : Nettoyage systématique des attributs `xmlns` par Regex pour garantir un DOM propre et lisible (F12).

### 2.2. Actions Express (Syntax Sugar)
Simplification radicale de l'UI pour éviter la lourdeur des balises `<form>` :
* `<button delete="#store/path">`
* `<button patch="#store/path" value="v">`
* `<input ref="#store/path">`

---

## 3. Mécanisme de Liaison (Binding) et Accessibilité

### 3.1. Le Dependency Tracking (Inventaire)
L'un des points clés de notre discussion. L'engine maintient une carte :
`Chemin XPath` <---> `Éléments DOM Observateurs`.

### 3.2. Automatisation Sémantique (AriaML-Safe)
Pour que le système soit accessible sans effort du développeur :
* **aria-controls** : Injecté sur les déclencheurs (boutons) pour pointer vers les zones de rendu (`render_by`).
* **aria-live** : Placé sur les conteneurs de rendu pour annoncer les mutations de vue après mise à jour du XML.

---

## 4. Spécifications du "Bind" (Héritage XForms)
Le système doit supporter le cumul des contraintes :
* Si une valeur XML est liée à un `input type="number"` (min 10) et un `input type="range"` (max 100), le modèle rejette tout `PATCH` hors de l'intervalle [10, 100].
* Support futur des calculs dynamiques : `<bind ref="/total" calculate="sum(...)">`.

---

## 5. Incertitudes et Points à Résoudre (Roadmap)

Lors de la reprise, nous devrons trancher les points suivants :

1.  **Granularité du Rendu** : Lorsqu'une donnée change, doit-on redessiner tout le conteneur `render_by` via son template, ou utiliser XPath pour modifier uniquement le nœud texte précis dans le HTML ?
2.  **Moteur de Template** : Quelle syntaxe pour le template ciblé par `render_by` ? (XSLT simplifié, template strings HTML5, ou moteur interne AriaML ?).
3.  **Validation Temps Réel** : L'attribut `live` sur un input doit-il déclencher un `PATCH` à chaque frappe (debounced) ou uniquement au changement de focus ?
4.  **Conflits de Namespaces** : Bien que nous ayons opté pour le "zéro namespace", comment gérer les conflits si le XML importé en contient nativement ?

---

## 6. Exemples de Code de Référence



    <aria-ml-model id="cart">
        <script type="xml"><items><prod id="1">Café</prod></items></script>
    </aria-ml-model>
    
    <ul ref="#cart/items" render_by="tpl-item"></ul>
    
    <button delete="#cart/items/prod[@id='1']">Supprimer le café</button>

---
**Note au prochain système AriaML** : Ce document constitue la base sémantique de la couche Model. Pour démarrer, commence par implémenter la classe `AriaMLModel` avec sa méthode `_syncBackToScript()` incluant le nettoyage Regex des namespaces.
