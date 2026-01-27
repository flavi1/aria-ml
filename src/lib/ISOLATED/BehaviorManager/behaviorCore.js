/**
 * behaviorCore.js
 * Orchestrateur v1.2.0 - Intelligence de Résolution & Patterns
 */
const behaviorCore = (() => {
    // Initialisation du Parser Agnostique
	const definitionFactory = GlobalSheetParser('behavior', 'script[type="text/behavior"]', 'src', 'BHV');
    const initializedElements = new WeakSet();

    /**
     * ALGORITHME DE RÉSOLUTION : Expansion des patterns (Mixins)
     * Transforme les règles brutes en propriétés finales calculées.
     */
	// BHV devient le pivot du namespace
    
    const resolveComputedProperties = (el) => {
        const finalProps = {};
        const rules = el.behavior.rules || [];
        const virtuals = window.sheets.behavior.virtualRules;

        rules.forEach(rule => {
            rule.properties.forEach(prop => {
                if (prop.key === 'behavior') {
                    // Le pattern a été stocké sous son nom court (ex: 'tab')
                    const pattern = virtuals.get(prop.value);
                    if (pattern) Object.assign(finalProps, pattern);
                } else {
                    finalProps[prop.key] = prop.value;
                }
            });
        });
        return finalProps;
    };

    const applyOrder = (el) => {
        const parent = el.parentElement;
        if (!parent) return;
        const props = el.behavior.computed;
        const sorted = Array.from(parent.children).sort((a, b) => {
            const orderA = parseInt(a.behavior.computed?.order) || 0;
            const orderB = parseInt(b.behavior.computed?.order) || 0;
            return orderA - orderB;
        });
        sorted.forEach((node, idx) => {
            if (parent.children[idx] !== node) parent.insertBefore(node, parent.children[idx]);
        });
    };

    /**
     * CYCLE DE VIE
     */
    const processLifecycle = async (el) => {
		if (!(el instanceof HTMLElement)) return;
		
		const props = resolveComputedProperties(el);
		console.log(`[AriaML] Analyse de l'élément :`, el, `Propriétés calculées :`, props);
		
		el.behavior.computed = props;

        if (!props || Object.keys(props).length === 0) return;

        // 3. Initialisation (une seule fois)
        if (!initializedElements.has(el)) {
            if (props.init) {
                if (typeof behaviorActions !== 'undefined') {
                    await behaviorActions.execute(el, 'init', props.init);
                }
            }
            initializedElements.add(el);
        }
        
        // 4. Mise à jour structurelle (Order)
        if (props.order) applyOrder(el);
        
        // 5. Hook d'attachement
        if (props['on-attach'] && typeof behaviorActions !== 'undefined') {
            await behaviorActions.execute(el, 'on-attach', props['on-attach']);
        }
    };

    /**
     * GESTION DES ÉVÉNEMENTS
     */
    const handleClickOut = (e) => {
        document.querySelectorAll('*').forEach(el => {
            if (!el.behavior) return;
            const props = el.behavior.computed;
            const action = props['on-click-out'] || props['click-out'];
            if (!action) return;

            const relatedNodes = [];
            Object.keys(props).forEach(key => {
                if (key.startsWith('rel-') && typeof behaviorResolvers !== 'undefined') {
                    relatedNodes.push(...behaviorResolvers.resolveChain(el, props[key]));
                }
            });

            const isInside = el.contains(e.target) || relatedNodes.some(n => n.contains(e.target));
            if (!isInside && typeof behaviorActions !== 'undefined') {
                behaviorActions.execute(el, 'click-out', action, e);
            }
        });
    };

    const start = async () => {
        console.info("[AriaML] behaviorCore : Attente des définitions...");
        await definitionFactory.ready;
        
        // Branchement sur l'événement du Parser pour réactivité
        document.addEventListener('behavior.applyRules', (e) => {
            processLifecycle(e.target);
        });

        // Initialisation du Keyboard si présent
        if (window.behaviorKeyboard) behaviorKeyboard.init();
        
        // Resize pour la propriété 'order'
        window.addEventListener('resize', () => {
            document.querySelectorAll('*').forEach(el => {
                if (el.behavior?.computed?.order) applyOrder(el);
            });
        });

        document.addEventListener('click', handleClickOut, true);

        // Délégation des événements standards
        ['click', 'focus', 'blur', 'input', 'change'].forEach(type => {
            document.addEventListener(type, e => {
                const el = e.target.closest('*');
                if (!el || !el.behavior) return;
                
                const props = el.behavior.computed;
                const action = props[type] || props['on-' + type];
                if (action && typeof behaviorActions !== 'undefined') {
                    behaviorActions.execute(el, type, action, e);
                }
            }, true);
        });

        // Premier passage sur le DOM existant
        document.querySelectorAll('*').forEach(processLifecycle);

        // Observation des mutations futures
        const observer = new MutationObserver(m => {
            m.forEach(record => {
                record.addedNodes.forEach(node => {
                    if (node.nodeType === 1) processLifecycle(node);
                });
            });
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });

        console.info("[AriaML] behaviorCore v1.2.0 démarré avec support Patterns.");
    };

    return { start, definitionFactory, refresh: () => definitionFactory.refresh() };
})();

// Lancement automatique
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => behaviorCore.start());
} else {
    behaviorCore.start();
}
