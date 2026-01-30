/**
 * Core.js
 * Orchestrateur v1.4.2 - Full DOM Scanning pour réactivité CSS totale
 */
const behaviorCore = (() => {
    const definitionFactory = GlobalSheetParser('behavior', 'script[type="text/behavior"]', 'src');
    const initializedElements = new WeakSet();
    const patterns = new Map();

    const definePattern = (name, props) => {
        patterns.set(name, props);
    };

    const getResolvedProps = (el) => {
        if (!el.behavior) return {};
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

    const applyOrder = (el) => {
        const parent = el.parentElement;
        if (!parent) return;
        const sorted = Array.from(parent.children).sort((a, b) => {
            const propsA = getResolvedProps(a);
            const propsB = getResolvedProps(b);
            const orderA = parseInt(propsA.order) || 0;
            const orderB = parseInt(propsB.order) || 0;
            return orderA - orderB;
        });
        sorted.forEach((node, idx) => {
            if (parent.children[idx] !== node) parent.insertBefore(node, parent.children[idx]);
        });
    };

    const processLifecycle = async (el) => {
        if (!(el instanceof HTMLElement) || !el.behavior) return;
        
        // C'est ici que hasChanged() sauve les performances :
        // Si les styles calculés (prefixés) n'ont pas bougé, on s'arrête là.
        if (!el.behavior.hasChanged()) return;

        const props = getResolvedProps(el);
        if (Object.keys(props).length === 0) return;

        if (!initializedElements.has(el)) {
            if (props.init) await behaviorActions.execute(el, 'init', props.init);
            initializedElements.add(el);
        }

        if (props.order) applyOrder(el);
        if (props['on-attach']) await behaviorActions.execute(el, 'on-attach', props['on-attach']);
    };

    const start = async () => {
        await definitionFactory.ready;

        const scanAndRefresh = (elements) => {
            elements.forEach(el => processLifecycle(el));
        };

        // 1. MutationObserver : Structure et Attributs
        const mutationObserver = new MutationObserver(mutations => {
            mutations.forEach(m => {
                if (m.type === 'childList') {
                    m.addedNodes.forEach(n => { if (n instanceof HTMLElement) processLifecycle(n); });
                } else {
                    processLifecycle(m.target);
                }
            });
        });

        // 2. ResizeObserver sur le root : Le déclencheur universel des Media Queries
        const resizeObserver = new ResizeObserver(() => {
            requestAnimationFrame(() => {
                // Scan complet à chaque changement de dimension pour capter 
                // les nouvelles propriétés injectées par les Media Queries
                scanAndRefresh(document.querySelectorAll('*'));
            });
        });

        const root = document.documentElement;
        mutationObserver.observe(root, { childList: true, subtree: true, attributes: true });
        resizeObserver.observe(root);

        // Scan initial
        scanAndRefresh(document.querySelectorAll('*'));
        
        console.info("[AriaML] behaviorCore 1.4.2 : Réactivité Full-Scan activée.");
    };

    return { start, definitionFactory, definePattern, getResolvedProps, applyOrder };
})();

// Lancement
if (document.readyState === 'interactive' || document.readyState === 'complete') {
    behaviorCore.start();
} else {
    document.addEventListener('DOMContentLoaded', () => behaviorCore.start());
}
