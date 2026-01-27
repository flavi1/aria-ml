/**
 * behaviorCore.js
 * Orchestrateur v1.3.6 - Mixins & Extension behavior()
 */
const behaviorCore = (() => {
    const definitionFactory = GlobalSheetParser('behavior', 'script[type="text/behavior"]', 'src');
    const initializedElements = new WeakSet();
    const patterns = new Map();

    console.log(definitionFactory);

    const definePattern = (name, props) => {
        patterns.set(name, props);
        console.info(`[AriaML] Pattern défini : ${name}`);
    };

    const getResolvedProps = (el) => {
        const rawProps = el.behavior.computed;
        const resolved = {};
        const patternName = rawProps['behavior'];
        const patternProps = (patternName && patterns.has(patternName)) ? patterns.get(patternName) : null;

        const allKeys = new Set([...Object.keys(rawProps), ...(patternProps ? Object.keys(patternProps) : [])]);

        allKeys.forEach(key => {
            if (key === 'behavior') return;
            const localValue = rawProps[key];
            const patternValue = patternProps ? patternProps[key] : null;

            if (localValue && localValue.includes('behavior()') && patternValue) {
                resolved[key] = localValue.replace(/behavior\(\)/g, patternValue);
            } else {
                resolved[key] = localValue !== undefined ? localValue : patternValue;
            }
        });
        return resolved;
    };

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
            const orderA = parseInt(getResolvedProps(a).order) || 0;
            const orderB = parseInt(getResolvedProps(b).order) || 0;
            return orderA - orderB;
        });
        sorted.forEach((node, idx) => {
            if (parent.children[idx] !== node) parent.insertBefore(node, parent.children[idx]);
        });
    };

    const processLifecycle = async (el) => {
        if (!(el instanceof HTMLElement)) return;
        const props = getResolvedProps(el);
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
            if (!el.behavior) return;
            const props = getResolvedProps(el);
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
        console.log('start awaiting BS');
        await definitionFactory.ready;
        console.log('end awaiting BS');
        
        const observer = new MutationObserver(m => m.forEach(res => res.addedNodes.forEach(n => {
            if (n instanceof HTMLElement) processLifecycle(n);
        })));
        observer.observe(document.documentElement, { childList: true, subtree: true });
        
        if (window.behaviorKeyboard) behaviorKeyboard.init();
        
        window.addEventListener('resize', () => {
            document.querySelectorAll('*').forEach(el => {
                if (el.behavior && getResolvedProps(el).order) applyOrder(el);
            });
        });

        document.addEventListener('click', handleClickOut, true);

        ['click', 'focus', 'blur', 'input', 'change'].forEach(type => {
            document.addEventListener(type, e => {
                const el = e.target.closest('*');
                if (!el || !el.behavior) return;
                const props = getResolvedProps(el);
                const action = props[type] || props['on-' + type];
                if (action) behaviorActions.execute(el, type, action, e);
            }, true);
        });

        document.querySelectorAll('*').forEach(processLifecycle);
        console.info("[AriaML] behaviorCore démarré.");
    };

    window.supportsElement = supportsElement;
    return { start, definitionFactory, definePattern, getResolvedProps };
})();

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded!!!');
    behaviorCore.start();
});
