 
/**
 * AriaML Bridge.WEBEXT.ISOLATED.js
 * Routeur universel pour les appels provenant du MAIN world.
 */
(function() {
    document.addEventListener('ariaml:proxy:call', (e) => {
        const { manager, method, args } = e.detail;
        
        // Accès dynamique au manager via window (ex: window["ThemeManager"])
        const targetManager = window[manager];
        
        if (targetManager && typeof targetManager[method] === 'function') {
            targetManager[method](...args);
        } else {
            console.warn(`AriaML Bridge: Method ${method} not found on ${manager}`);
        }
    });
})();
