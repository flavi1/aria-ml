# AriaML

**AriaML** est une évolution *accessibility-first* et *JS-unobtrusive* du HTML.
En outre, c'est un standard de document auto-éditable et "Privacy-by-Design" conçu pour le Web moderne.
Contrairement aux applications web traditionnelles, AriaML traite le document comme une entité souveraine où l'information circule de manière hermétique, garantissant une sécurité et une confidentialité natives.

---

## 💡 Concepts Fondamentaux

### ♿ Une évolution « Accessibility-First »
Là où le HTML classique exige que l'accessibilité soit ajoutée statiquement, AriaML l'intègre nativement dans le cycle de vie du document. 
* **Sémantique Variable et Responsive** : AriaML résout le dilemme du "layout vs rôle". Grâce aux feuilles de comportement (`.bhv`), un élément peut muter sémantiquement selon le contexte. Un menu peut passer d'un rôle `navigation` à un rôle `dialog` (modal) sur mobile sans changer le DOM, garantissant une expérience sans rupture pour les lecteurs d'écran.
* **Cohérence Automatique** : En liant l'apparence, l'ordre d'affichage (`order`) et le rôle sémantique dans une couche orthogonale, AriaML élimine les décalages entre ce que l'utilisateur voit et ce que l'accessibilité rapporte.



### 🧩 Une approche « JS Unobtrusive » (Non-obstructif)
AriaML réhabilite la séparation des préoccupations : le JavaScript n'est plus le moteur de rendu, mais un assistant optionnel.
* **Déclaration plutôt que Manipulation** : Les interactions sont définies de manière déclarative. On ne "code" pas une ouverture de menu, on "déclare" une relation entre un déclencheur et sa cible dans une couche isolée.
* **Robustesse Native** : Le document est fonctionnel avant même l'exécution du premier script tiers. La mécanique d'interface (Behavior Manager) tourne de manière hermétique, rendant l'interface insensible au blocage des scripts par le firewall intégré.

---

## 📚 Documentation

Pour comprendre et implémenter AriaML, explorez les trois piliers du standard :

### 🛠️ [Architecture & Intégration](https://flavi1.github.io/aria-ml/doc/INTEGRATION.md)
Structure d'un document AriaML, nœud racine, Appearance Manager (thèmes) et navigation fluide par slots.

### 🎭 [Behavior Manager](https://flavi1.github.io/aria-ml/doc/BEHAVIOR%20MANAGER.md)
Feuilles de comportement **.bhv** (syntaxe CSS) pour définir une sémantique responsive et des relations dynamiques.

### 🛡️ [Consentement & Sécurité](https://flavi1.github.io/aria-ml/doc/CONSENT.md)
Gestion du consentement arbitré par le navigateur et firewall d'exécution (Scripts, WASM) intégré.

---

## 🚀 Installation & Test

### Utilisation Standalone (Polyfill)
Pour tester AriaML sans extension, injectez le polyfill dans votre document HTML :
```html
<script src="https://flavi1.github.io/aria-ml/src/standalone.js"></script>
```

### Tester la Web Extension (Mode Développeur)
Pour bénéficier du firewall et de la gestion du consentement native :

1. **Cloner le dépôt :**
   ```bash
   git clone https://github.com/flavi1/aria-ml.git
   cd aria-ml
   ```

2. **Charger dans le navigateur (Chrome/Edge/Brave) :**
   * Accédez à `chrome://extensions/`.
   * Activez le **Mode développeur**.
   * Cliquez sur **Charger l'extension décompressée** et sélectionnez le dossier racine.

3. **Charger dans Firefox :**
   * Accédez à `about:debugging#/runtime/this-firefox`.
   * Cliquez sur **Charger un module complémentaire temporaire** et sélectionnez le `manifest.json`.

---
*AriaML est un projet tourné vers un Web plus respectueux, plus léger et plus intelligent.*
