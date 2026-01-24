/**
 * behaviorCore
 * Orchestrateur enrichi pour AriaML v1.1.
 */
const behaviorCore = (() => {
    const definitionFactory = GlobalSheetParser('behavior', 'script[type="text/behavior"]', 'src');
    const initializedElements = new WeakSet();

    // Injection du Proxy Global
    Object.defineProperty(HTMLElement.prototype, 'behavior', {
        get() { return definitionFactory.getProperties(this); },
        configurable: true
    });

    const supportsElement = (conditionText) => {
        const match = conditionText.match(/element\(<(.*?)>\)/);
        if (!match) return CSS.supports(conditionText);
        const tagName = match[1];
        const el = document.createElement(tagName);
        return !(el instanceof HTMLUnknownElement);
    };

    const applyOrder = (el) => {
        const parent = el.parentElement;
        if (!parent) return;

        const children = Array.from(parent.children);
        const sorted = children.sort((a, b) => {
            return (parseInt(a.behavior.order) || 0) - (parseInt(b.behavior.order) || 0);
        });

        sorted.forEach((node, idx) => {
            if (parent.children[idx] !== node) parent.insertBefore(node, parent.children[idx]);
        });
    };

    const processLifecycle = async (el) => {
        const props = el.behavior;
        if (!props || Object.keys(props).length === 0) return;

        if (!initializedElements.has(el)) {
            if (props.init) await behaviorActions.execute(el, 'init', props.init);
            initializedElements.add(el);
        }
        
        if (props.order) applyOrder(el);
        if (props['on-attach']) await behaviorActions.execute(el, 'on-attach', props['on-attach']);
    };

    /**
     * Logique Click-Out : Vérifie si le clic est extérieur à l'élément 
     * ET à toutes ses relations déclarées.
     */
    const handleClickOut = (e) => {
        document.querySelectorAll('*').forEach(el => {
            const action = el.behavior['on-click-out'] || el.behavior['click-out'];
            if (!action) return;

            // On récupère toutes les cibles liées par des relations
            const relatedNodes = [];
            Object.keys(el.behavior).forEach(key => {
                if (key.startsWith('rel-')) {
                    relatedNodes.push(...behaviorResolvers.resolveChain(el, el.behavior[key]));
                }
            });

            const isInside = el.contains(e.target) || relatedNodes.some(n => n.contains(e.target));
            if (!isInside) behaviorActions.execute(el, 'click-out', action, e);
        });
    };

    const start = () => {
        const observer = new MutationObserver(m => m.forEach(res => res.addedNodes.forEach(n => {
            if (n instanceof HTMLElement) processLifecycle(n);
        })));
        observer.observe(document.documentElement, { childList: true, subtree: true });
        
        if (window.behaviorKeyboard) behaviorKeyboard.init();
        
        window.addEventListener('resize', () => {
            document.querySelectorAll('[style*="--order"], [behavior*="order"]').forEach(el => {
                if (el.behavior.order) applyOrder(el);
            });
        });

        document.addEventListener('click', handleClickOut, true);

        ['click', 'focus', 'blur', 'input', 'change'].forEach(type => {
            document.addEventListener(type, e => {
                const el = e.target.closest('*');
                if (!el || !el.behavior) return;
                const action = el.behavior[type] || el.behavior['on-' + type];
                if (action) behaviorActions.execute(el, type, action, e);
            }, true);
        });

        document.querySelectorAll('*').forEach(processLifecycle);
    };

    window.supportsElement = supportsElement;
    return { start, definitionFactory };
})();

document.addEventListener('DOMContentLoaded', behaviorCore.start);
