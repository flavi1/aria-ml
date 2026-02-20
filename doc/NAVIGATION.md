# Navigation Fluide
**L’Évolution Dynamique du Document AriaML**

Dans le standard AriaML, la navigation n'est pas necessairement un remplacement de page, mais peut être une **mutation fluide**. Le document racine `<aria-ml>` est persistant, tandis que son contenu interne (les slots) évoluent dynamiquement par l'injection de fragments, orchestré par un cycle de transition sécurisé.

---

## 1. Le Fragment comme Vecteur de Mutation
Un fragment AriaML est une extension partielle du document permettant de mettre à jour une ou plusieurs parties du document.

### Architecture d'un Fragment
Un fragment doit intégrer sa propre logique de sécurité pour forcer la restauration du document racine s'il est consulté hors contexte.

```html
<!-- support des navigateurs Html (non AriaML) -->
<meta http-equiv="refresh" content="0;url=./">
<style>aria-ml .aria-ml-fallback {display: none;}</style>
<div class="aria-ml-fallback">Chargement du document...</div>

<aria-ml-fragment>
    <script type="application/ld+json" nav-slot="WebPage">
    [{
        "@context": "https://ariaml.org/ns#",
        "@type": "WebPage",
        "name": "title"
    }]
    </script>

    <main nav-slot="main">
        <h1>Contenu injecté</h1>
        <p nav-cache="unique-key">Ce nœud sera persisté en mémoire.</p>
    </main>
</aria-ml-fragment>
```

---

## 2. Le Cycle de Navigation SPA

### A. Négociation et Requête
1. **Interception** : Le navigateur identifie les intentions de navigation (`<a>` ou `<form>`) dont la cible (attribut target) est `_slots` (valeur par défaut de l'attribut target en AriaML).
2. **Verrouillage Initial** : Dès l'intention, le document racine (`<html>`) est marqué `aria-busy="true"` et `inert` pour signifier le transit.
3. **NavCache Header** : La requête inclut l'en-tête `Nav-Cache` listant les clefs déjà connues du client pour permettre au serveur d'optimiser sa réponse.

### B. Stratégie de Verrouillage Asymétrique
Le standard distingue deux types de mutations après réception de la réponse :

| Type de Mutation | Cible de Verrouillage (`aria-busy`/`inert`) | Durée du Verrouillage |
| :--- | :--- | :--- |
| **Full Replacement** (`<aria-ml>`) | Racine globale (`documentElement`) | Jusqu'à la fin de la transition. |
| **Partial Update** (`<aria-ml-fragment>`) | **Slots cibles uniquement** | Jusqu'à la fin de la mutation. |

> **Note :** Dans le cas d'une mise à jour partielle, la racine globale est libérée immédiatement pour permettre l'interaction avec le reste de la page (menus, header) pendant que les slots mutent.

---

## 3. Système NodeCache (Nav-Cache)

Le **NavCache** assure la persistance des nœuds DOM entre les vues, indépendamment de la pile d'historique.

* **Enregistrement** : Les éléments portant l'attribut `nav-cache` sont mémorisés par l'agent utilisateur dès leur insertion dans le DOM.
* **Restauration** :
    * **Slots (`<aria-ml-fragment>`)** : Le conteneur est préservé, le contenu (children) est déplacé depuis le cache vers le nouveau slot.
    * **Éléments standards** : Le nœud vide envoyé par le serveur est remplacé par le nœud réel stocké en mémoire.
* **Persistance** : Le cache survit même si l'élément est détaché du DOM (ex: pagination, filtres).

---

## 4. Transitions et Feedback Visuel

Le standard AriaML préconise l'utilisation des **View Transitions API** de manière progressive. Si les transitions ne sont pas supportées ou désactivées par l'utilisateur (`prefers-reduced-motion`), une mise à jour directe est effectuée sans rompre le cycle de navigation.

---

## 5. Gestion des Formulaires et Verbes Étendus

AriaML lève les limitations historiques du HTML concernant les méthodes de soumission de façon non normative :
* **Méthodes** : Support natif des verbes `GET`, `POST`, `PUT`, `PATCH`, `DELETE`. 
* **Périmètre** : L'utilisation des verbes étendus est restreinte aux URLs appartenant à la `navigationBaseUrl`.
* **Logique Serveur** : C'est à la charge du developpeur d'interprêter correctement le verbe : Le serveur doit adapter le traitement et la réponse en fonction du verbe reçu.
* **Encodage JSON** : `enctype="application/json"` permet la transmission d'un objet JSON unique. Les fichiers y sont sérialisés en Base64 (Data URI).

---

## 6. Sécurité et Intégrité

### Jeton CSRF
Le jeton de sécurité est extrait dynamiquement des `PageProperties`. Sa transmission est strictement limitée au périmètre de la `navigationBaseUrl` :
1. Dans l'en-tête `X-CSRF-TOKEN` pour les requêtes de mutation (`fetch`).
2. Dans un champ nommé `_token` pour toutes les soumissions de formulaires.

### Verrouillage du Périmètre
La `navigationBaseUrl` définit la zone de confiance. Toute navigation sortant de cette origine décharge le contexte AriaML pour revenir à un mode de navigation classique. Cela garantit qu'aucun site tiers ne peut accéder au `NavCache` ou aux propriétés internes du document.

---

## 7. Gestion automatique du Focus et Accessibilité

Après chaque mutation, le focus est réattribué pour garantir la continuité de l'expérience :
1. Priorité à l'élément portant l'attribut `autofocus` dans le nouveau contenu.
2. À défaut, le focus se déplace sur le premier slot impacté.
3. En dernier recours, la racine `<aria-ml>` reçoit le focus.

---

**Suite** : [Comment implémenter AriaML côté serveur?](/fr/implementation-ssr)
