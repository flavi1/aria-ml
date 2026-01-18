# DOCUMENTATION TECHNIQUE : INFRASTRUCTURE DE CONSENTEMENT ET SÉCURITÉ ARIAML

## 1. DÉCLARATION DES BESOINS (`application/consent+json`)

Le document AriaML doit déclarer ses intentions de manière explicite via un bloc JSON unique. Ce bloc est la "source de vérité" lue par l'Arbitre pour configurer la sécurité.

    <script type="application/consent+json">
    {
        "languages": {
            "text/javascript": { "status": "required" },
            "application/wasm+rust": { 
                "status": "recommended", 
                "reason": "Nécessaire pour le rendu 3D haute performance." 
            }
        },
        "scopes": {
            "sync-service": {
                "description": "Synchronisation de vos brouillons.",
                "base-urls": ["[https://api.aria-cloud.io](https://api.aria-cloud.io)", "[https://backup.aria.org](https://backup.aria.org)"],
                "required": false
            }
        }
    }
    </script>

- **base-urls** : Liste blanche de domaines autorisés pour ce scope. L'accès réseau est physiquement bloqué si non consenti.
- **reason** : Texte explicatif affiché à l'utilisateur pour justifier la recommandation ou l'exigence.

## 2. HIÉRARCHIE ET PERSISTANCE DU CONSENTEMENT

L'Arbitre résout le consentement en interrogeant les couches de stockage selon une priorité décroissante :

### A. Préférences Générales (Niveau Global)
- **Signal GPC (Global Privacy Control)** : Si détecté, les scopes non requis sont refusés par défaut.
- **Compatibilité WebExtension** : L'Arbitre vérifie si une extension de gestion de préférences (AriaML-Global ou tierce) a déjà défini des règles pour ce domaine ou ce type de langage.
- **Règles Utilisateur** : Préférences globales du navigateur (ex: "Toujours interdire JS sur ce domaine").

### B. Shadow Storage (Niveau Origine)
- Utilisé pour stocker les décisions spécifiques à un document si aucune règle globale ne s'applique.
- **Implémentation** : `IndexedDB` (Shadow Storage) pour empêcher les scripts du document de lire ou modifier les consentements.
- **Indexation** : Par `origin` (protocole + domaine).

## 3. L'ARBITRAGE VISUEL (IFRAME ISOLÉE)

Si aucune décision automatique n'est possible, l'Arbitre lance la phase d'interaction utilisateur.

- **Isolation Zero-Trust** : Le formulaire est rendu dans une Iframe isolée à l'intérieur d'un `dialog#consent-manager`. Le document hôte ne peut pas simuler d'interaction ni lire les saisies.
- **Injection automatique** : L'Arbitre crée les éléments `dialog#consent-manager` et `consent-manager` s'ils n'existent pas.
- **États des options** :
    - **Required** : Checkbox cochée et verrouillée.
    - **Recommended** : Cochée par défaut, modifiable.
    - **Manquant** : Si un moteur (ex: Rust) n'est pas enregistré via `registerLanguage`, une alerte spécifique invite à continuer en mode dégradé.

## 4. LE PARE-FEU SÉMANTIQUE (MUTATION OBSERVER)

Pendant toute la phase de consentement, un `MutationObserver` protège l'intégrité du document :

- **Neutralisation préventive** :
    - `meta[http-equiv]` -> `AVOIDED-http-equiv` (Bloque les redirections cachées).
    - `noscript` -> `no-script` (Neutralise la logique binaire du navigateur).
- **Neutralisation conditionnelle** :
    - Bloque l'exécution de tout script (`AVOIDED-type`) dont le langage n'est pas encore dans la Whitelist.
    - Neutralise les attributs `onEvent` et `href="javascript:"` si le consentement JS est absent.

## 5. CYCLE DE VALIDATION ET RELOAD

Une fois la décision validée dans l'Iframe, l'Arbitre procède comme suit :

1. **Réception** : Reçoit le `postMessage` contenant les choix de l'utilisateur.
2. **Persistence** : Enregistre dans le Shadow Storage (si `persist: true`).
3. **Évaluation du Reload** :
    - Si un langage requis a été accepté : `location.reload()` est forcé.
    - Si l'Observer a déjà neutralisé des éléments (`hasNeutralizedScripts`) : `location.reload()` est forcé pour garantir que le navigateur ré-analyse le document proprement avec la nouvelle Whitelist.
4. **Libération** : Si aucun reload n'est nécessaire, la `Promise` de blocage est résolue et les modules AriaML s'initialisent.

## 6. INTERFACE DE RÉOUVERTURE (POST-LOAD)

L'utilisateur peut réviser ses choix à tout moment.

- **Bouton dédié** : L'Arbitre cherche `button#open-consent-manager`.
- **Injection de secours** : S'il est absent, l'Arbitre injecte un bouton d'accès aux réglages de confidentialité (Affichage "Post-Load").
- **Effet** : La modification d'un consentement entraînera les mêmes règles de reload pour appliquer les nouveaux paramètres de sécurité.





---

# SPÉCIFICATION DU PROTOCOLE DE COMMUNICATION : ARIAML CONSENT BRIDGE

## 1. INITIALISATION (ARBITRE -> IFRAME)
Dès que l'Iframe est chargée, l'Arbitre envoie l'état complet du document et les préférences connues pour construire l'interface.

    {
        "type": "ARIAML_INIT_FORM",
        "payload": {
            "origin": "[https://document-host.org](https://document-host.org)",
            "config": {
                "languages": {
                    "text/javascript": {
                        "status": "required",
                        "isAvailable": true,
                        "currentConsent": "pending"
                    },
                    "application/wasm+rust": {
                        "status": "recommended",
                        "reason": "L'émulateur x86 a besoin de ce langage pour fonctionner",
                        "isAvailable": false,
                        "currentConsent": "pending"
                    }
                },
                "scopes": {
                    "cloud-sync": {
                        "description": "Accès à votre espace de stockage distant",
                        "base-urls": ["[https://api.aria-cloud.com](https://api.aria-cloud.com)"],
                        "required": false,
                        "currentConsent": "denied",
                        "source": "gpc-signal"
                    }
                }
            },
            "preferences": {
                "gpcEnabled": true,
                "globalStorageAvailable": true
            }
        }
    }

## 2. ACTIONS UTILISATEUR (IFRAME -> ARBITRE)
L'Iframe transmet les interactions en temps réel ou lors de la validation finale.

### A. Validation Finale (Enregistrement)
Envoyé lorsque l'utilisateur clique sur "Enregistrer" ou "Tout accepter".

    {
        "type": "ARIAML_CONSENT_SAVE",
        "payload": {
            "decisions": {
                "languages": {
                    "text/javascript": "allowed",
                    "application/wasm+rust": "denied"
                },
                "scopes": {
                    "cloud-sync": "denied"
                }
            },
            "persistence": {
                "rememberForever": true,
                "applyGlobally": false
            }
        }
    }

### B. Annulation / Fermeture
Envoyé si l'utilisateur ferme le dialogue sans modifier ses choix (si le document n'est pas bloqué).

    {
        "type": "ARIAML_CONSENT_CLOSE",
        "payload": {
            "reason": "user_cancel"
        }
    }

## 3. RÉPONSES ET SYNCHRONISATION (ARBITRE -> IFRAME)
L'Arbitre confirme la bonne réception et l'application des règles.

### A. Confirmation de Persistance
L'Iframe peut ainsi afficher un état "Enregistré avec succès".

    {
        "type": "ARIAML_SAVE_CONFIRMED",
        "payload": {
            "nextStep": "reload_required",
            "timestamp": 1737220000000
        }
    }

## 4. SÉCURITÉ DU TRANSPORT
Pour éviter les attaques par injection de messages, l'Arbitre et l'Iframe appliquent les règles suivantes :

- **Validation d'Origine** : L'Arbitre vérifie systématiquement `event.origin` pour s'assurer que le message provient de l'URL interne de l'extension ou du domaine de confiance de l'Iframe.
- **Intégrité du Payload** : L'Arbitre rejette tout message contenant des types MIME ou des Scopes non déclarés initialement dans le `application/consent+json` du document.
- **Sanitization** : Toutes les chaînes de caractères (`reason`, `description`) passées à l'Iframe sont traitées comme du texte brut pour éviter les attaques XSS à l'intérieur du manager de consentement.

## 5. ÉTATS DE CONSENTEMENT POSSIBLES
Les valeurs autorisées pour les décisions sont :
- `allowed` : L'utilisateur accepte l'exécution/l'accès.
- `denied` : L'utilisateur refuse explicitement.
- `pending` : En attente de décision (état par défaut).
- `degraded` : Cas spécifique où l'utilisateur accepte de continuer malgré l'absence d'un moteur de langage (`isAvailable: false`).


---

# LISTE DES FICHIERS À IMPLÉMENTER : INFRASTRUCTURE DE CONSENTEMENT ARIAML

## 1. LE CŒUR DE L'ARBITRE (POLYFILL / EXTENSION)
Ces fichiers constituent le moteur de sécurité qui s'exécute sur la page hôte.

- **Arbitrator.js** : Le chef d'orchestre. Il initialise la Promise globale, gère le flux entre le stockage et l'UI, et décide du `location.reload()`.
- **SecurityObserver.js** : Contient la logique du `MutationObserver`. Il gère la whitelist dynamique et la neutralisation des balises (`AVOIDED-`).
- **StorageWrapper.js** : Abstraction pour la persistance. Il gère le basculement entre `chrome.storage.local` (si extension) et `IndexedDB` (Shadow Storage).
- **ConsentBridge.js** : Gère la messagerie `postMessage` sécurisée entre la page hôte et l'Iframe.
- **AriaML-Global.js** : Expose l'objet `window.AriaML` et la méthode `registerLanguage` pour les extensions tierces.

## 2. LE GESTIONNAIRE DE CONSENTEMENT (IFRAME ISOLÉE)
Ces fichiers sont chargés uniquement à l'intérieur de l'Iframe du dialogue de consentement.

- **consent-manager.html** : Structure du formulaire (Header, Sections Langages/Scopes, Footer).
- **consent-manager.css** : Design "système" AriaML pour le formulaire (styles isolés du document hôte).
- **consent-ui-logic.js** : Reçoit le JSON d'initialisation, génère dynamiquement les lignes du formulaire (avec les `reasons` et badges) et renvoie les décisions.

## 3. RESSOURCES DE STYLE (HOST SIDE)
Fichiers injectés dans le document principal pour l'interface de l'arbitre.

- **arbitrator-overlay.css** : Styles pour le `dialog#consent-manager` et le bouton d'affichage "Post-Load" (`#open-consent-manager`).
- **consent-aware.css** : Règles CSS pour gérer l'affichage/masquage des éléments `<no-script>` et des états dégradés.

## 4. EXEMPLES ET TESTS
- **manifest.json** : Si implémentation sous forme de WebExtension.
- **test-document.html** : Un document AriaML de test contenant un bloc `application/consent+json`, du JSON-LD, et divers scripts (acceptés/refusés).
