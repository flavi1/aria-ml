/**
 * AriaML ProxyFactory.WEBEXT.js (MAIN World)
 */
(function() {
    const createManagerProxy = (managerName, methodWhitelist) => {
        const proxy = {};
        methodWhitelist.forEach(methodName => {
            proxy[methodName] = (...args) => {
                document.dispatchEvent(new CustomEvent('ariaml:proxy:call', {
                    detail: { 
                        manager: managerName, 
                        method: methodName, 
                        args: args 
                    }
                }));
            };
        });
        return proxy;
    };

    // --- Déclaration des interfaces exposées ---

    window.ThemeManager = createManagerProxy('ThemeManager', ['setTheme', 'init']);
    window.AppearanceManager = createManagerProxy('AppearanceManager', ['render']);
    window.NavigationManager = createManagerProxy('NavigationManager', ['navigate']);

})();
