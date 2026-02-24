/**
 * ThemeManager.js
 * Gère l'intention thématique et la persistance utilisateur.
 */
(function() {
    const ThemeManager = {
        activeName: null,
        storageKey: 'ariaml_user_theme',

        init: function() {
            this.activeName = localStorage.getItem(this.storageKey);
        },

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

        shouldActivate: function(themeName, matchesMedia, isFirstMatch) {
            if (this.activeName) {
                return themeName === this.activeName;
            }
            return matchesMedia && isFirstMatch;
        }
    };

    window.ThemeManager = ThemeManager;
    ThemeManager.init();
})();
