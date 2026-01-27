/**

 * behaviorCore.js

 * Orchestrateur v1.1.2 - Synchronisé avec GlobalSheetParser

 */

const behaviorCore = (() => {

    const definitionFactory = GlobalSheetParser('behavior', 'script[type="text/behavior"]', 'src');
    const initializedElements = new WeakSet();

console.log(definitionFactory)

    const supportsElement = (conditionText) => {
        const match = conditionText.match(/element\(<(.*?)>\)/);
        if (!match) return CSS.supports(conditionText);
        const el = document.createElement(match[1]);
        return !(el instanceof HTMLUnknownElement);
    };

    const applyOrder = (el) => {
        const parent = el.parentElement;
        if (!parent) return;
        const sorted = Array.from(parent.children).sort((a, b) => {
            return (parseInt(a.behavior.computed.order) || 0) - (parseInt(b.behavior.computed.order) || 0);
        });

        sorted.forEach((node, idx) => {
            if (parent.children[idx] !== node) parent.insertBefore(node, parent.children[idx]);
        });
    };

    const processLifecycle = async (el) => {
//console.log(el)
        if (!(el instanceof HTMLElement)) return;
        const props = el.behavior.computed;
        if (!props || Object.keys(props).length === 0) return;

        if (!initializedElements.has(el)) {
            if (props.init) await behaviorActions.execute(el, 'init', props.init);
            initializedElements.add(el);
        }
        
        if (props.order) applyOrder(el);
        if (props['on-attach']) await behaviorActions.execute(el, 'on-attach', props['on-attach']);
    };

    const handleClickOut = (e) => {
        document.querySelectorAll('*').forEach(el => {
            const props = el.behavior.computed;
            const action = props['on-click-out'] || props['click-out'];
            if (!action) return;

            const relatedNodes = [];
            Object.keys(props).forEach(key => {
                if (key.startsWith('rel-')) {
                    relatedNodes.push(...behaviorResolvers.resolveChain(el, props[key]));
                }
            });

            const isInside = el.contains(e.target) || relatedNodes.some(n => n.contains(e.target));
            if (!isInside) behaviorActions.execute(el, 'click-out', action, e);
        });
    };

    const start = async () => {
console.log('start awaiting BS')
        // ATTENTE CRUCIALE DES FEUILLES DISTANTES
        await definitionFactory.ready;
        
console.log('end awaiting BS')
        
        const observer = new MutationObserver(m => m.forEach(res => res.addedNodes.forEach(processLifecycle)));
        observer.observe(document.documentElement, { childList: true, subtree: true });
        
        if (window.behaviorKeyboard) behaviorKeyboard.init();
        
        window.addEventListener('resize', () => {
            document.querySelectorAll('*').forEach(el => {
                if (el.behavior.computed.order) applyOrder(el);
            });
        });

        document.addEventListener('click', handleClickOut, true);

        ['click', 'focus', 'blur', 'input', 'change'].forEach(type => {
            document.addEventListener(type, e => {
                const el = e.target.closest('*');
                if (!el || !el.behavior) return;
                const props = el.behavior.computed;
                const action = props[type] || props['on-' + type];
                if (action) behaviorActions.execute(el, type, action, e);
            }, true);
        });

        document.querySelectorAll('*').forEach(processLifecycle);
        console.info("[AriaML] behaviorCore démarré.");
    };

    window.supportsElement = supportsElement;
    return { start, definitionFactory };
})();


document.addEventListener('DOMContentLoaded', () => {

console.log('DOMContentLoaded!!!')

behaviorCore.start()

});

