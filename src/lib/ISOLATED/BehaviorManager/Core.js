/**
 * Core.js
 * Orchestrateur v1.4.7 - Full-Scan, Order, Keyboard & Semantic Subscription Registry
 */
const behaviorCore = (() => {
    const definitionFactory = GlobalSheetParser('behavior', 'script[type="behavior"], script[type="text/behavior"]', 'src');
    const initializedElements = new WeakSet();
    const registeredEvents = new Set();
    const patterns = new Map();
    
    // Registre des éléments abonnés aux événements globaux (ex: current-change)
    const globalSubscribers = {
        'current-change': new Set()
    };
    
    let isProcessing = false;
    let mutationObserver = null;

    const definePattern = (name, props) => patterns.set(name, props);

    const getResolvedProps = (el) => {
        if (!el || !el.behavior) return {};
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
            return (parseInt(propsA.order) || 0) - (parseInt(propsB.order) || 0);
        });
        sorted.forEach((node, idx) => {
            if (parent.children[idx] !== node) parent.insertBefore(node, parent.children[idx]);
        });
    };

    const registerGlobalEvent = (type) => {
        // "current-change" et "clickout" sont gérés par délégation spécifique
        if (registeredEvents.has(type) || ['clickout', 'init', 'apply', 'current-change'].includes(type) || type.startsWith('kb-')) return;
        
        document.addEventListener(type, async (e) => {
            const el = (e.target == document) ? document.documentElement : e.target.closest('*');
            if (!el || !el.behavior) return;
            
            const props = getResolvedProps(el);
            const action = props['on-' + type] || props[type];
            
            if (action) {
                isProcessing = true;
                await behaviorActions.execute(el, type, action, e);
                isProcessing = false;
            }
        }, { capture: true });
        
        registeredEvents.add(type);
    };

    const processLifecycle = async (el) => {
        if (!(el instanceof HTMLElement) || !el.behavior) return;
        
        // Nettoyage des anciens abonnements si l'élément est ré-évalué
        globalSubscribers['current-change'].delete(el);

        if (!el.behavior.hasChanged()) {
            // Si l'élément n'a pas changé mais possède toujours l'action, on le maintient dans le registre
            if (el.behavior.computed['on-current-change']) globalSubscribers['current-change'].add(el);
            return;
        }

        const props = getResolvedProps(el);
        if (Object.keys(props).length === 0) return;

        // Inscription au registre sémantique si la propriété est présente
        if (props['on-current-change']) {
            globalSubscribers['current-change'].add(el);
        }

        // Enregistrement des événements standards
        Object.keys(props).forEach(key => {
            if (key.startsWith('on-')) {
                registerGlobalEvent(key.replace('on-', ''));
            }
        });

        // Initialisation unique
        if (!initializedElements.has(el)) {
            const initAction = props['on-init'] || props['init'];
            if (initAction) {
                isProcessing = true;
                await behaviorActions.execute(el, 'on-init', initAction);
                isProcessing = false;
            }
            initializedElements.add(el);
        }

        if (props.order !== undefined) applyOrder(el);

        if (props['on-apply']) {
            isProcessing = true;
            await behaviorActions.execute(el, 'on-apply', props['on-apply']);
            isProcessing = false;
        }
    };

    const fullScan = () => {
        if (isProcessing) return;
        console.info("[AriaML] Scanning for behavior changes...");
        document.querySelectorAll('*').forEach(el => processLifecycle(el));
    };

    const start = async () => {
        definitionFactory.onRefresh(() => {
            requestAnimationFrame(fullScan);
        });

        await definitionFactory.ready;

        // 1. Gestion Clavier
        const keysDown = new Set();
        document.addEventListener('keydown', (e) => {
            const k = e.key.toLowerCase();            
            if (keysDown.has(k)) return; 
            keysDown.add(k);
            const combo = Array.from(keysDown).sort().join('-');
            const kbEventName = 'kb-' + combo;
            const el = e.target.closest('*');
            if (!el || !el.behavior) return;
            const props = getResolvedProps(el);
            const action = props['on-' + kbEventName] || props[kbEventName];
            if (action) {
                isProcessing = true;
                behaviorActions.execute(el, kbEventName, action, e);
                isProcessing = false;
            }
        });
        document.addEventListener('keyup', (e) => keysDown.delete(e.key.toLowerCase()));
        window.addEventListener('blur', () => keysDown.clear());

        // 2. MutationObserver
        mutationObserver = new MutationObserver(mutations => {
            if (isProcessing) return;
            mutations.forEach(m => {
                if (m.type === 'childList') {
                    m.addedNodes.forEach(n => { 
                        if (n instanceof HTMLElement) processLifecycle(n); 
                    });
                    m.removedNodes.forEach(n => {
                        if (n instanceof HTMLElement) globalSubscribers['current-change'].delete(n);
                    });
                } else {
                    processLifecycle(m.target);
                }
            });
        });

        // 3. ResizeObserver
        const resizeObserver = new ResizeObserver(() => {
            if (isProcessing) return;
            requestAnimationFrame(() => {
                document.querySelectorAll('*').forEach(el => processLifecycle(el));
            });
        });

        // 4. Gestion Click-Out
        document.addEventListener('click', async (e) => {
            // Le click-out reste sur un scan global car il dépend de la position de la souris relative à TOUS les éléments
            document.querySelectorAll('*').forEach(el => {
                if (!el.behavior) return;
                const props = getResolvedProps(el);
                const action = props['on-clickout'];
                if (action && !el.contains(e.target)) {
                    isProcessing = true;
                    behaviorActions.execute(el, 'clickout', action, e);
                    isProcessing = false;
                }
            });
        }, true);

        // 4. Délégation "current-change" OPTIMISÉE
        document.addEventListener('current-change', async (e) => {
            // On n'itère QUE sur les éléments inscrits dans le registre
            globalSubscribers['current-change'].forEach(async (el) => {
                // Sécurité : si l'élément n'est plus dans le DOM, on le retire
                if (!el.isConnected) {
                    globalSubscribers['current-change'].delete(el);
                    return;
                }
                const props = getResolvedProps(el);
                const action = props['on-current-change'];
                if (action) {
                    isProcessing = true;
                    await behaviorActions.execute(el, 'current-change', action, e);
                    isProcessing = false;
                }
            });
        }, true);

        fullScan();
        
        mutationObserver.observe(document.documentElement, { 
            childList: true, 
            subtree: true, 
            attributes: true 
        });
        
        console.info("[AriaML] Core 1.4.7 : Semantic Registry Ready.");
    };

    return { start, fullScan, definitionFactory, definePattern, getResolvedProps, applyOrder };
})();

const initAriaML = () => {
    console.log('[AriaML] Lancement du moteur...');
    behaviorCore.start();
};

if (document.readyState === 'interactive' || document.readyState === 'complete') {
    initAriaML();
} else {
    document.addEventListener('DOMContentLoaded', initAriaML);
}
