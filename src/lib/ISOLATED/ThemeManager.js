/**
 * ThemeManager.js
 * Gère l'intention thématique et la persistance utilisateur.
 */
(function() {
    const ThemeManager = {
        activeName: null,
        storageKey: 'ariaml_user_theme',

        init: function() {
            // Récupération de la préférence manuelle
            this.activeName = localStorage.getItem(this.storageKey);
        },

        /**
         * Définit manuellement le thème.
         * Passer 'null' pour revenir au mode "Automatique".
         */
        setTheme: async function(name) {
            this.activeName = name;
            if (name) {
                localStorage.setItem(this.storageKey, name);
            } else {
                localStorage.removeItem(this.storageKey);
            }

            if (window.AppearanceManager) {
                await window.AppearanceManager.render();
            }
        },

        /**
         * Détermine si un thème donné doit être considéré comme actif.
         * @param {string} themeName - Le nom du thème à tester.
         * @param {boolean} matchesMedia - Si la media query du nœud est valide.
         * @param {boolean} isFirstMatch - Si c'est le premier thème valide trouvé.
         */
        shouldActivate: function(themeName, matchesMedia, isFirstMatch) {
            // 1. Si l'utilisateur a choisi un thème, seul celui-là gagne.
            if (this.activeName) {
                return themeName === this.activeName;
            }
            // 2. Sinon, le premier thème dont le média matche gagne (Mode Auto).
            return matchesMedia && isFirstMatch;
        }
    };

    window.ThemeManager = ThemeManager;
    ThemeManager.init();
})();
