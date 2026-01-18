# Spécification du Standard AriaML

## **1. Structure du Document**

### **a. Implémentation "Native"**

Dans une architecture native, AriaML remplace la structure HTML traditionnelle. Le document est un flux sémantique pur où la configuration est déclarée en premier.

```html
<!DOCTYPE aria-ml>
<aria-ml lang="fr">
    <script type="application/ld+json">
    [{
        "@context": "[https://ariaml.org/ns#](https://ariaml.org/ns#)",
        "@type": "PageProperties",
        "metadatas": [{ "name": "title", "content": "Accueil" }],
        "appearance": {
            "assets": [{ "rel": "stylesheet", "href": "base.css" }]
        }
    }]
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
        <script type="application/ld+json"> ... </script>
        
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
PageProperties.metadatas.find(m => m.name === 'title').content = "Tableau de bord";

// Modifie la couleur de la barre d'adresse/interface du navigateur
PageProperties.appearance.defaultBrowserColor = "#2c3e50";
```

---

## **3. Theme Manager**

Le `ThemeManager` est le module responsable de l'interprétation visuelle. Il utilise une structure JSON-LD riche pour orchestrer les assets.

### **Exemple de configuration riche**

```json
{
  "@type": "PageProperties",
  "appearance": {
    "defaultBrowserColor": "#ffffff",
    "defaultTheme": "ThemeClair",
    "themeList": {
      "ThemeClair": {
        "media": "(prefers-color-scheme: light)",
        "browserColor": "#f8f9fa",
        "assets": [
          { "rel": "stylesheet", "href": "light-mode.css" }
        ]
      },
      "ThemeSombre": {
        "media": "(prefers-color-scheme: dark)",
        "browserColor": "#1a1a1a",
        "assets": [
          { "rel": "stylesheet", "href": "dark-mode.css" }
        ]
      }
    }
  }
}
```

### **Logique de Résolution Stricte**

1. **Priorité Manuelle** : Si `ThemeManager.setTheme('Nom')` a été appelé (sauvegardé en localStorage).
2. **Match Média** : Si une propriété `media` correspond à l'état du système.
3. **Fallback** : Utilisation du `defaultTheme` spécifié.

---

## **4. Navigation : L’Évolution Dynamique du Document**

Dans le standard AriaML, la navigation n'est pas perçue comme un remplacement total du document, mais comme une **mutation sémantique**. Le document racine `<aria-ml>` demeure persistant, tandis que son contenu interne (les slots) et ses propriétés (`PageProperties`) évoluent dynamiquement par l'injection de fragments ou le repeuplement de la racine.

### **1. Le Fragment comme Vecteur de Mutation**

Un fragment AriaML est une extension partielle du document. Il permet de mettre à jour la substance sémantique sans rompre la continuité du rendu ou des ressources déjà chargées.

### **2. Architecture d’un Fragment de Document**

Pour garantir l'intégrité du standard, un fragment doit intégrer sa propre logique de sécurité. S'il est consulté en dehors d'un contexte de document complet, il doit forcer le navigateur à restaurer le document racine.



    <meta http-equiv="refresh" content="0;url=./">
    
    <style>aria-ml .aria-ml-fallback {display: none;}</style>
    
    <div class="aria-ml-fallback">
        Chargement du document...
    </div>
    
    <aria-ml-fragment>
        <script type="application/ld+json">
        [{
            "@context": "[https://ariaml.org/ns#](https://ariaml.org/ns#)",
            "@type": "PageProperties",
            "metadatas": [{ "name": "title", "content": "Nouveau Titre du Document" }]
        }]
        </script>
    
        <main slot="main">
            <h1>Mutation du document</h1>
            <p>Ce contenu est injecté dynamiquement.</p>
        </main>
    </aria-ml-fragment>

---

> **💡 Note sur l'économie de métadonnées**
>
> Dans un fragment, il est inutile et déconseillé de répéter l'intégralité des métadonnées du document source. Seul le **titre** (`title`) est réellement nécessaire pour mettre à jour l'onglet du navigateur et l'historique.

---

### **3. Fonctionnement du Cycle de Navigation**

Le cycle de navigation AriaML repose sur une interception intelligente des intentions utilisateur (`<a>` et `<form>`) :

1.  **Négociation de flux** : Le client émet une requête avec l'en-tête `Accept: text/aria-ml, application/aria-xml, text/html, application/xhtml+xml`.
2.  **Choix du Parser** : 
    * `application/xhtml+xml` pour les types `application/aria-xml` ou `application/xhtml+xml`.
    * `text/html` pour les types `text/aria-ml` ou `text/html`.
3.  **Analyse de la Cible (Target)** :
    * **Target `_slots` (Défaut)** : Le client traite la réponse en mode SPA.
    * **Target explicite (ex: `_self`, `_blank`)** : Le client simule une navigation classique. Pour les méthodes `PUT/PATCH/DELETE` ou l'encodage `json`, un formulaire éphémère ("Shadow Form") est utilisé pour transmettre l'intention via un `POST` enrichi de champs cachés (`_method`, `_json`).
4.  **Application de la Mutation** :
    * **Si `<aria-ml-fragment>` est reçu** : Seuls les éléments portant l'attribut `slot` sont synchronisés.
    * **Si `<aria-ml>` est reçu (Page complète)** : Le contenu interne de la racine actuelle est intégralement remplacé ("Repeuplement").
    * **Fallback** : Si aucune balise AriaML n'est détectée, une navigation classique forcée est déclenchée.

### **4. Gestion des Formulaires et Verbes Étendus**

AriaML étend les capacités natives du HTML en supportant :
* **Verbes HTTP** : `GET`, `POST`, `PUT`, `PATCH`, `DELETE`.
* **Encodage JSON** : Via `enctype="application/json"` ou l'alias court `enctype="json"`. Les fichiers sont alors automatiquement convertis en **Base64 (Data URI)**.
* **Sécurité** : Le jeton CSRF, s'il est présent dans `PageProperties.CSRF`, est injecté systématiquement dans l'en-tête `X-CSRF-TOKEN`.



### **5. Propriétés de Continuité**

* **Stabilité visuelle** : La racine `<aria-ml>` est persistante, les feuilles de style ne sont jamais rechargées.
* **Suivi des Redirections** : Le standard gère les codes **303 See Other**. Le client suit la redirection et met à jour l'URL finale dans l'historique du navigateur.
* **Protection du Flux** : Les boutons de soumission sont automatiquement désactivés pendant le transit pour éviter les doubles envois.
* **Accessibilité** : La mise à jour par slots ou repeuplement préserve le focus et le contexte pour les technologies d'assistance.


---


## **5. Sécurité et Intégrité des Échanges**

Le standard AriaML intègre la sécurité au cœur de son cycle de navigation. L'utilisation d'un document racine persistant impose une gestion stricte des jetons de sécurité et des origines pour prévenir les injections et les détournements de session.

### **1. Le Jeton CSRF Centralisé**

Dans AriaML, le jeton de protection contre la falsification de requête intersites est déclaré une seule fois dans les `PageProperties` initiales. 

* **Déclaration** : Le serveur injecte le jeton dans le bloc JSON-LD initial.
* **Transmission** : Pour toute mutation (`POST`, `PUT`, `PATCH`, `DELETE`), le client extrait ce jeton et l'injecte automatiquement dans l'en-tête HTTP `X-CSRF-TOKEN`.

> **Note technique** : En mode "Shadow Form" (pour les cibles `_blank` ou `_self`), si le verbe est émulé, le jeton est également transmis via un champ caché `_token` pour garantir la compatibilité avec les middlewares serveurs standards.



### **2. Verrouillage du Périmètre de Navigation**

Afin d'éviter qu'un fragment malveillant ne redirige l'application vers une origine tierce tout en conservant l'accès aux `PageProperties` sensibles, AriaML applique un verrouillage d'origine :

* **navigationBaseUrl** : Cette propriété est immuable (`read-only`) après son initialisation.
* **Interception** : Toute tentative de navigation vers une URL dont l'origine (`origin`) diffère de la `navigationBaseUrl` est traitée comme une navigation classique sortante, provoquant le déchargement complet de l'application AriaML.

### **3. Validation des Intentions Serveur**

Le serveur doit valider la cohérence de la requête AriaML :

1.  **Vérification de l'En-tête** : Le serveur peut restreindre l'envoi de fragments aux seules requêtes contenant `Accept: text/aria-ml`.
2.  **Traitement des Verbes Émulés** : Le serveur doit être configuré pour lire le paramètre `_method` (lorsque `Content-Type` est `multipart/form-data`) ou l'en-tête `X-HTTP-Method-Override` pour traiter correctement les requêtes `PUT` ou `PATCH`.
3.  **Dépaquetage JSON** : Lorsque `enctype="json"` est utilisé, le serveur reçoit les données dans le corps de la requête ou via le champ `_json` (en mode simulation). Il doit alors désérialiser le contenu et, le cas échéant, décoder les fichiers transmis en **Base64**.



### **4. Politique de Sécurité du Contenu (CSP)**

AriaML encourage l'utilisation de politiques CSP strictes. Comme le swapping de slots utilise `innerHTML`, il est fortement recommandé de :

* Utiliser des **Nonces** pour les scripts injectés.
* Interdire l'exécution de scripts en ligne (`unsafe-inline`) sauf s'ils proviennent du domaine de confiance défini par `navigationBaseUrl`.

---

### **Résumé des En-têtes de Sécurité Recommandés**

| En-tête | Rôle dans AriaML |
| :--- | :--- |
| `X-CSRF-TOKEN` | Porteur du jeton de sécurité pour les mutations. |
| `X-AriaML-Navigation` | (Optionnel) Permet au serveur de savoir si la requête est une navigation SPA. |
| `Content-Security-Policy` | Restreint les sources de scripts et de styles au périmètre AriaML. |



## **6. Modèles Internes : L’État Applicatif Local**

AriaML permet de définir des sources de données locales via la balise `<aria-ml-model>`. En utilisant le XML et XPath, ces modèles offrent une puissance de manipulation supérieure au JSON, tout en restant parfaitement intégrés au DOM.

### **1. Définition d'un modèle**

Un modèle est un conteneur passif qui s'active au premier appel REST (#id).

```html
<aria-ml-model id="store">
    <script type="xml">
        <app>
            <user role="editor">
                <name>Aria</name>
                <age>24</age>
            </user>
            <inventory>
                <item id="1">Clavier</item>
            </inventory>
        </app>
    </script>
</aria-ml-model>
```

### **2. Manipulation des données (REST Local)**

L'attribut `action` pointant vers un ID (`#store`) redirige la requête vers le moteur interne plutôt que vers le réseau.

#### **A. Modification d'une donnée (PATCH)**
On utilise l'attribut `ref` avec un chemin XPath pour cibler la donnée.

```html
<form action="#store" method="PATCH">
    <input type="text" name="username" ref="/app/user/name" value="Nouveau Nom">
    <button type="submit">Mettre à jour</button>
</form>
```

#### **B. Ajout d'une propriété ou d'un attribut**
XPath permet de cibler des attributs avec le préfixe `@`.

```html
<form action="#store" method="PATCH">
    <select ref="/app/user/@role">
        <option value="admin">Administrateur</option>
        <option value="editor">Éditeur</option>
    </select>
</form>
```

#### **C. Gestion de listes (POST / DELETE)**



```html
<form action="#store/app/inventory" method="POST">
    <input type="text" name="label" placeholder="Nom de l'article">
    <button type="submit">Ajouter à la liste</button>
</form>

<form action="#store/app/inventory/item[@id='1']" method="DELETE">
    <button type="submit">Supprimer le Clavier</button>
</form>
```

---

### **3. Contraintes et Liaisons Avancées (Bind)**

La force du modèle XML est la capacité de lier plusieurs champs à une même donnée et de cumuler les contraintes de validation.

#### **A. Multi-liaison (Synchronisation d'états)**
Si deux champs pointent vers le même `ref`, ils partagent la même valeur en temps réel.

```html
<input type="range" min="0" max="100" ref="/app/user/age">
<input type="number" min="18" ref="/app/user/age">
```

#### **B. Cumul des contraintes**
Lorsqu'une valeur du modèle est liée à plusieurs champs, AriaML applique une **intersection des contraintes** :

* Le champ `range` impose `max="100"`.
* Le champ `number` impose `min="18"`.
* **Résultat** : La valeur dans le modèle XML ne sera valide que si elle est comprise entre 18 et 100. Si une contrainte échoue, le `PATCH` vers le modèle est rejeté.

#### **C. Logique de calcul (Calculated Binds)**
Inspiré de XForms, on peut utiliser des scripts de contraintes pour définir des états calculés.

```html
<aria-ml-model id="cart">
    <script type="xml">
        <cart total="0">
            <item price="10" qty="2" />
            <item price="5" qty="1" />
        </cart>
    </script>
    <bind ref="/cart/@total" calculate="sum(/cart/item/@price * /cart/item/@qty)" />
</aria-ml-model>
```

---

### **4. Comportement du Moteur**

* **Abstraction des Namespaces** : Le développeur écrit du XML pur. Le moteur nettoie systématiquement les attributs `xmlns` générés par le navigateur pour garder le DOM propre.
* **Lazy Activation** : Le `DOMParser` ne crée l'instance XML qu'au premier appel `#id`.
* **Persistance DOM** : Toute modification du XML est immédiatement sérialisée dans le texte du `<script>` interne, permettant de voir l'état du modèle en inspectant le code source (F12).
* **Événementiel** : Chaque mutation déclenche un événement `ariaml:updated` sur l'élément `<aria-ml-model>`, permettant à l'interface de réagir.

---
