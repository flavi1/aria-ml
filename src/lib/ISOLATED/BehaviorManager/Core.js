/**
 * Core.js
 * Orchestrateur v1.4.4 - Full-Scan, Anti-Cycle, Order & Keyboard
 */
const behaviorCore = (() => {
    const definitionFactory = GlobalSheetParser('behavior', 'script[type="behavior"], script[type="text/behavior"]', 'src');
    const initializedElements = new WeakSet();
    const registeredEvents = new Set();
    const patterns = new Map();
    
    let isProcessing = false;
    let mutationObserver = null;
    const activeKeys = new Set();

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
            return (parseInt(propsA.order) || 0) - (parseInt(propsB.order) || 0);
        });
        sorted.forEach((node, idx) => {
            if (parent.children[idx] !== node) parent.insertBefore(node, parent.children[idx]);
        });
    };

    const registerGlobalEvent = (type) => {
        // Ne pas enregistrer les types internes ou déjà présents
        if (registeredEvents.has(type) || ['clickout', 'init', 'apply'].includes(type) || type.startsWith('kb-')) return;
        
        
        document.addEventListener(type, async (e) => {
            const el = e.target.closest('*');
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
        if (!el.behavior.hasChanged()) return;

        const props = getResolvedProps(el);

        if (Object.keys(props).length === 0) return;

        // Enregistrement dynamique (Events standards)
        Object.keys(props).forEach(key => {
            if (key.startsWith('on-')) {
                registerGlobalEvent(key.replace('on-', ''));
            }
        });

        // Initialisation
        if (!initializedElements.has(el)) {
            const initAction = props['on-init'] || props['init'];
            if (initAction) {
                isProcessing = true;
                await behaviorActions.execute(el, 'on-init', initAction);
                isProcessing = false;
            }
            initializedElements.add(el);
        }

        // Structure (Order)
        if (props.order !== undefined) applyOrder(el);

        // Application (Mutation)
        if (props['on-apply']) {
            isProcessing = true;
            await behaviorActions.execute(el, 'on-apply', props['on-apply']);
            isProcessing = false;
        }
    };

	// Fonction de scan complet
    const fullScan = () => {
        if (isProcessing) return;
        console.info("[AriaML] Scanning for behavior changes...");
        document.querySelectorAll('*').forEach(el => processLifecycle(el));
    };

    const start = async () => {
		// Branchement de la réactivité sur les nouvelles feuilles
        definitionFactory.onRefresh(() => {
            // On laisse un micro-tick au navigateur pour appliquer le CSS injecté
            requestAnimationFrame(fullScan);
        });

        // Attente du chargement initial
        await definitionFactory.ready;

		// 1. Gestion Clavier Optimisée (kb-key1-key2)
		const keysDown = new Set();

		document.addEventListener('keydown', (e) => {
			const k = e.key.toLowerCase();			
			// Empêche l'auto-répétition du système d'exploitation
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

		document.addEventListener('keyup', (e) => {
			keysDown.delete(e.key.toLowerCase());
		});

		// Reset de sécurité si on change de fenêtre (évite les touches "bloquées")
		window.addEventListener('blur', () => keysDown.clear());

        // 2. MutationObserver (Anti-cycle)
        mutationObserver = new MutationObserver(mutations => {
            if (isProcessing) return;
            mutations.forEach(m => {
                if (m.type === 'childList') {
                    m.addedNodes.forEach(n => { if (n instanceof HTMLElement) processLifecycle(n); });
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

		// Scan initial
        fullScan();
        
		// Activation MutationObserver pour le DOM
        mutationObserver.observe(document.documentElement, { 
            childList: true, 
            subtree: true, 
            attributes: true 
        });
        
        console.info("[AriaML] Core 1.4.4 : Full-Scan, Order & Keyboard Ready.");
    };

    return { start, fullScan, definitionFactory, definePattern, getResolvedProps, applyOrder };
})();

// Fonction de lancement sécurisée
const initAriaML = () => {
    console.log('[AriaML] Lancement du moteur...');
    behaviorCore.start();
};

// Si le DOM est déjà prêt (ou en cours de finalisation), on lance immédiatement
if (document.readyState === 'interactive' || document.readyState === 'complete') {
    initAriaML();
} else {
    // Sinon, on attend sagement l'événement
    document.addEventListener('DOMContentLoaded', initAriaML);
}
