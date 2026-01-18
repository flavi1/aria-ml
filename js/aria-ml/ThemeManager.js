/**
 * ThemeManager.js
 * Gère l'état du thème et la persistance des préférences utilisateur.
 */
(function() {
    const ThemeManager = {
        activeName: null,
        config: null,
        storageKey: 'ariaml_user_theme',

        init: function() {
            // Tenter de récupérer le thème sauvegardé
            const savedTheme = localStorage.getItem(this.storageKey);
            if (savedTheme) {
                this.activeName = savedTheme;
            }
        },

        updateConfig: function(data) {
            this.config = data;
            // Si aucun thème n'est encore actif (premier boot), on suit la cascade
            if (!this.activeName) {
                this.activeName = this.resolveAutoTheme();
            }
        },

        resolveAutoTheme: function() {
            const list = this.config.themeList;
            // 1. Chercher un thème dont la media query matche
            for (const [name, theme] of Object.entries(list)) {
                if (theme.media && window.matchMedia(theme.media).matches) {
                    return name;
                }
            }
            // 2. Sinon, thème par défaut
            return this.config.defaultTheme;
        },

        setTheme: function(name) {
            if (this.config.themeList[name]) {
                this.activeName = name;
                localStorage.setItem(this.storageKey, name);
                // On demande à l'AppearanceManager de rafraîchir le rendu
                if (window.AppearanceManager) {
                    window.AppearanceManager.render(this.config);
                }
            }
        }
    };

    window.ThemeManager = ThemeManager;
    ThemeManager.init();
})();
