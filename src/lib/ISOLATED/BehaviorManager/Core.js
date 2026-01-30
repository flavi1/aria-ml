/**
 * Core.js
 * Orchestrateur v1.4.3 - Dynamic Event Registration & Anti-Cycle
 */
const behaviorCore = (() => {
    const definitionFactory = GlobalSheetParser('behavior', 'script[type="behavior"], script[type="text/behavior"]', 'src');
    const initializedElements = new WeakSet();
    const registeredEvents = new Set(); // Pour ne pas attacher 2 fois le même event au document
    const patterns = new Map();
    
    let isProcessing = false; // Flag anti-cycle
    let mutationObserver = null;

    const definePattern = (name, props) => patterns.set(name, props);

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

    const registerGlobalEvent = (type) => {
        if (registeredEvents.has(type) || type === 'clickout' || type === 'init' || type === 'apply') return;
        
        document.addEventListener(type, async (e) => {
            const el = e.target.closest('*');
            if (!el || !el.behavior) return;
            
            const props = getResolvedProps(el);
            const action = props['on-' + type] || props[type];
            
            if (action) {
                isProcessing = true; // On bloque l'observer durant l'action
                await behaviorActions.execute(el, type, action, e);
                isProcessing = false;
            }
        }, { capture: true, passive: true });
        
        registeredEvents.add(type);
    };

    const processLifecycle = async (el) => {
        if (!(el instanceof HTMLElement) || !el.behavior) return;
        if (!el.behavior.hasChanged()) return;

        const props = getResolvedProps(el);
        if (Object.keys(props).length === 0) return;

        // Enregistrement dynamique des événements détectés dans les propriétés
        Object.keys(props).forEach(key => {
            if (key.startsWith('on-')) {
                const eventType = key.replace('on-', '');
                registerGlobalEvent(eventType);
            }
        });

        // Cycle de vie
        if (!initializedElements.has(el)) {
            if (props['on-init'] || props['init']) {
                isProcessing = true;
                await behaviorActions.execute(el, 'on-init', props['on-init'] || props['init']);
                isProcessing = false;
            }
            initializedElements.add(el);
        }
		
		if (props.order) applyOrder(el);
		
        if (props['on-apply']) {
            isProcessing = true;
            await behaviorActions.execute(el, 'on-apply', props['on-apply']);
            isProcessing = false;
        }
    };

    const start = async () => {
        await definitionFactory.ready;

        const scanAndRefresh = (elements) => {
            elements.forEach(el => processLifecycle(el));
        };

        // 1. MutationObserver avec protection anti-cycle
        mutationObserver = new MutationObserver(mutations => {
            if (isProcessing) return; // Ignore les mutations induites par AriaML
            
            mutations.forEach(m => {
                if (m.type === 'childList') {
                    m.addedNodes.forEach(n => { if (n instanceof HTMLElement) processLifecycle(n); });
                } else {
                    processLifecycle(m.target);
                }
            });
        });

        // 2. ResizeObserver
        const resizeObserver = new ResizeObserver(() => {
            if (isProcessing) return;
            requestAnimationFrame(() => scanAndRefresh(document.querySelectorAll('*')));
        });

        const root = document.documentElement;
        mutationObserver.observe(root, { childList: true, subtree: true, attributes: true });
        resizeObserver.observe(root);

        // 3. Gestion Click-Out
        document.addEventListener('click', async (e) => {
            const candidates = document.querySelectorAll('*');
            for (const el of candidates) {
                if (!el.behavior) continue;
                const props = getResolvedProps(el);
                const action = props['on-clickout'];
                if (action && !el.contains(e.target)) {
                    isProcessing = true;
                    await behaviorActions.execute(el, 'clickout', action, e);
                    isProcessing = false;
                }
            }
        }, true);

        // Scan initial
        scanAndRefresh(document.querySelectorAll('*'));
        console.info("[AriaML] Core 1.4.3 : Full-Scan & Dynamic Events Ready.");
    };

    return { start, definitionFactory, definePattern, getResolvedProps };
})();
