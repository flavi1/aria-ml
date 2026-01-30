C'est un choix sage. Restreindre le secret (le jeton CSRF) à la zone de confiance (navigationBaseUrl) est la pratique standard la plus sûre : on ne donne les clés de la maison qu'à ceux qui habitent à la même adresse.

Voici le code source brut de votre document, formaté selon vos exigences (indentation de 4 espaces, sans blocs de code clôturés par des accents graves pour le bloc parent).

# Navigation : L’Évolution Dynamique du Document AriaML

Dans le standard AriaML, la navigation n'est pas un remplacement de page, mais une **mutation sémantique**. Le document racine `<aria-ml>` est persistant, tandis que son contenu interne (les slots) et ses propriétés (`PageProperties`) évoluent dynamiquement par l'injection de fragments ou le repeuplement de la racine, orchestré par un cycle de transition sécurisé.

---

## 1. Le Fragment comme Vecteur de Mutation
Un fragment AriaML est une extension partielle du document permettant de mettre à jour la substance sémantique sans rompre la continuité du rendu ou des ressources chargées.

### Architecture d'un Fragment
Un fragment doit intégrer sa propre logique de sécurité pour forcer la restauration du document racine s'il est consulté hors contexte.

```html
<meta http-equiv="refresh" content="0;url=./">
<style>aria-ml .aria-ml-fallback {display: none;}</style>
<div class="aria-ml-fallback">Chargement du document...</div>

<aria-ml-fragment>
    <script type="ld+json">
    [{
        "@context": "https://ariaml.org/ns#",
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
1. **Interception** : Le navigateur identifie les intentions de navigation (`<a>` ou `<form>`) dont la cible est `_slots`.
2. **Verrouillage Initial** : Dès l'intention, le document racine (`<html>`) est marqué `aria-busy="true"` et `inert` pour signifier le transit.
3. **NodeCache Header** : La requête inclut l'en-tête `Live-Cache` listant les clefs déjà connues du client pour permettre au serveur d'optimiser sa réponse.

### B. Stratégie de Verrouillage Asymétrique
Le standard distingue deux types de mutations après réception de la réponse :

| Type de Mutation | Cible de Verrouillage (`aria-busy`/`inert`) | Durée du Verrouillage |
| :--- | :--- | :--- |
| **Full Replacement** (`<aria-ml>`) | Racine globale (`documentElement`) | Jusqu'à la fin de la transition. |
| **Partial Update** (`<aria-ml-fragment>`) | **Slots cibles uniquement** | Jusqu'à la fin de la mutation. |

> **Note :** Dans le cas d'une mise à jour partielle, la racine globale est libérée immédiatement pour permettre l'interaction avec le reste de la page (menus, header) pendant que les slots mutent.

---

## 3. Système NodeCache (Live-Cache)

Le **NodeCache** assure la persistance des nœuds DOM entre les vues, indépendamment de la pile d'historique.

* **Enregistrement** : Les éléments portant l'attribut `live-cache` sont mémorisés par l'agent utilisateur dès leur insertion dans le DOM.
* **Restauration** :
    * **Slots (`<aria-ml-fragment>`)** : Le conteneur est préservé, le contenu (children) est déplacé depuis le cache vers le nouveau slot.
    * **Éléments standards** : Le nœud vide envoyé par le serveur est remplacé par le nœud réel stocké en mémoire.
* **Persistance** : Le cache survit même si l'élément est détaché du DOM (ex: pagination, filtres).

---

## 4. Transitions et Feedback Visuel

Le standard AriaML préconise l'utilisation des **View Transitions API** de manière progressive. Si les transitions ne sont pas supportées ou désactivées par l'utilisateur (`prefers-reduced-motion`), une mise à jour directe est effectuée sans rompre le cycle de navigation.

---

## 5. Gestion des Formulaires et Verbes Étendus

AriaML lève les limitations historiques du HTML concernant les méthodes de soumission :
* **Méthodes** : Support natif des verbes `GET`, `POST`, `PUT`, `PATCH`, `DELETE`. 
* **Périmètre** : L'utilisation des verbes étendus est restreinte aux URLs appartenant à la `navigationBaseUrl`.
* **Logique Serveur** : Le serveur adapte son traitement et la granularité de sa réponse (fragment ou page complète) en fonction du verbe reçu.
* **Encodage JSON** : `enctype="application/json"` permet la transmission d'un objet JSON unique. Les fichiers y sont sérialisés en Base64 (Data URI).

---

## 6. Sécurité et Intégrité

### Jeton CSRF
Le jeton de sécurité est extrait dynamiquement des `PageProperties`. Sa transmission est strictement limitée au périmètre de la `navigationBaseUrl` :
1. Dans l'en-tête `X-CSRF-TOKEN` pour les requêtes de mutation (`fetch`).
2. Dans un champ nommé `_token` pour toutes les soumissions de formulaires.

### Verrouillage du Périmètre
La `navigationBaseUrl` définit la zone de confiance. Toute navigation sortant de cette origine décharge le contexte AriaML pour revenir à un mode de navigation classique. Cela garantit qu'aucun site tiers ne peut accéder au `NodeCache` ou aux propriétés internes du document.

---

## 7. Gestion du Focus et Accessibilité

Après chaque mutation, le focus est réattribué pour garantir la continuité de l'expérience :
1. Priorité à l'élément portant l'attribut `autofocus` dans le nouveau contenu.
2. À défaut, le focus se déplace sur le premier slot impacté (avec l'ajout d'un `tabindex="-1"` si nécessaire).
3. En dernier recours, la racine `<aria-ml>` reçoit le focus.

L'utilisation de l'attribut `visually-hidden` sur des éléments sensibles au focus permet une prise en charge native de l'accessibilité contextuelle.
