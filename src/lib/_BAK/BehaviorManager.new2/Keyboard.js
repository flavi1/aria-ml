/**
 * AriaML Behavior Keyboard
 */
const behaviorKeyboard = (() => {
    const activeKeys = new Set();
    const keyMap = { 'control': 'ctrl', 'altgraph': 'altgr', ' ': 'space', 'escape': 'esc' };

    const normalizeKey = (key) => {
        const k = key.toLowerCase().replace('arrow', '');
        return keyMap[k] || k;
    };

    const init = () => {
        window.addEventListener('keydown', (e) => {
            activeKeys.add(normalizeKey(e.key));
            const el = e.target.closest('[definition]');
            if (!el) return;
            const combo = `kb-${Array.from(activeKeys).sort().join('-')}`;
            if (el.definition.behavior[combo]) behaviorActions.execute(el, combo, el.definition.behavior[combo], e);
        });
        window.addEventListener('keyup', (e) => activeKeys.delete(normalizeKey(e.key)));
        window.addEventListener('blur', () => activeKeys.clear());
    };

    return { init };
})();
