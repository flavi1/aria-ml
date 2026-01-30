/**
 * AriaML Behavior Actions
 * Version 1.4.6 - Explicit 'nodes' type & Structural safety
 */
const behaviorActions = (() => {

/**
     * Analyse le token pour déterminer la cible, le type d'accès et la propriété
     */
    const resolveTarget = (el, token) => {
        const lastAt = token.lastIndexOf('@');
        const lastDot = token.lastIndexOf('.');
        const sepIdx = Math.max(lastAt, lastDot);
        
        // Si aucun @ ou . en fin de token, c'est une chaîne de relations pure
        if (sepIdx === -1) {
            return behaviorResolvers.resolveChain(el, token);
        }

        // Sinon, on sépare le chemin de la propriété finale
        let chainPath = token.substring(0, sepIdx);
        if (chainPath === "") chainPath = 'self'; 

        const property = token.substring(sepIdx + 1);
        const type = token[sepIdx] === '@' ? 'attribute' : 'class';

        const result = behaviorResolvers.resolveChain(el, chainPath);

        return { 
            nodes: result.nodes, 
            type: type, 
            name: property 
        };
    };

    const actions = {
        'log': (el, { args }) => {
            const logs = args.map(a => resolveTarget(el, a));
            console.group('[AriaML Action Log]');
            console.log('Targets Resolved:', logs);
            console.log('Source context:', el);
            console.groupEnd();
        },

        'set': (el, { args }) => {
            const target = resolveTarget(el, args[0]);
            const value = args[1] !== undefined ? args[1] : "";
            if (target.type === 'nodes') return;

            target.nodes.forEach(n => {
                if (target.type === 'attribute') n.setAttribute(target.name, value);
                else if (target.type === 'class') n.classList.add(target.name);
            });
        },

        'rm': (el, { args }) => {
            const target = resolveTarget(el, args[0]);
            target.nodes.forEach(n => {
                if (target.type === 'attribute') n.removeAttribute(target.name);
                else if (target.type === 'class') n.classList.remove(target.name);
            });
        },

        'toggle': (el, { args }) => {
            const target = resolveTarget(el, args[0]);
            const cycle = args.slice(1);
            target.nodes.forEach(n => {
                if (target.type === 'class') {
                    n.classList.toggle(target.name);
                } else if (target.type === 'attribute') {
                    if (cycle.length > 1) {
                        const curr = n.getAttribute(target.name);
                        const idx = cycle.indexOf(curr);
                        const next = cycle[(idx + 1) % cycle.length];
                        n.setAttribute(target.name, next);
                    } else {
                        n.toggleAttribute(target.name);
                    }
                }
            });
        },

        'append': (el, { args }) => {
            const dest = behaviorResolvers.resolveChain(el, args[0]).nodes[0];
            const subject = behaviorResolvers.resolveChain(el, args[1]).nodes[0];
            if (dest && subject) dest.appendChild(subject);
        },

        'prepend': (el, { args }) => {
            const dest = behaviorResolvers.resolveChain(el, args[0]).nodes[0];
            const subject = behaviorResolvers.resolveChain(el, args[1]).nodes[0];
            if (dest && subject) dest.prepend(subject);
        },

        'remove': (el, { args }) => {
            behaviorResolvers.resolveChain(el, args[0]).nodes.forEach(n => n.remove());
        },

        'open': (el, { args }) => {
            behaviorResolvers.resolveChain(el, args[0]).nodes.forEach(n => {
                if (n.tagName === 'DIALOG') n.show();
                else n.removeAttribute('hidden');
            });
        },

        'open-modal': (el, { args }) => {
            behaviorResolvers.resolveChain(el, args[0]).nodes.forEach(n => {
                if (n.tagName === 'DIALOG') n.showModal();
                else n.removeAttribute('hidden');
            });
        },

        'close': (el, { args }) => {
            behaviorResolvers.resolveChain(el, args[0]).nodes.forEach(n => {
                if (n.tagName === 'DIALOG') n.close();
                else n.setAttribute('hidden', '');
            });
        },

        'focus': (el, { args }) => {
            const target = behaviorResolvers.resolveChain(el, args[0]).nodes[0];
            if (target) target.focus();
        },

		'trigger': (el, { args }) => {
            const eventName = args[1];
            behaviorResolvers.resolveChain(el, args[0]).nodes.forEach(n => {
                if (window.behaviorCore) behaviorCore.registerGlobalEvent(eventName);
                
                n.dispatchEvent(new CustomEvent(eventName, { 
                    bubbles: true, 
                    cancelable: true,
                    detail: { source: el } 
                }));
            });
        },

        'wait': (el, { args }) => new Promise(res => setTimeout(res, parseInt(args[0]))),

        'cancel': (el, { event }) => {
            if (event && typeof event.preventDefault === 'function') event.preventDefault();
        },

        'stop': (el, { event }) => {
            if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
        }
    };

	const execute = async (el, evName, behaviorStr, originalEvent = null) => {
        if (!behaviorStr) return;

        // Split intelligent (ignore espaces dans parenthèses)
        const sequence = behaviorStr.split(/\s+(?![^()]*\))/);

        for (const actionStr of sequence) {
            const match = actionStr.match(/^([\w-]+)(?:\((.*)\))?$/);
            if (!match) continue;

            const name = match[1].trim();
            const rawArgs = match[2] || "";
            
            // Split arguments (ignore virgules dans guillemets)
            let args = rawArgs 
                ? rawArgs.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
                         .map(a => a.trim().replace(/^["']|["']$/g, ''))
                : [];

            // /!\ ATTENTION : Suppression de la résolution automatique ici 
            // pour laisser resolveTarget gérer les @ et . proprement.

            if (actions[name]) {
                try {
                    // On attend l'action (important pour wait ou request)
                    await actions[name](el, {
                        args,
                        event: originalEvent,
                        evName,
                        props: el.behavior ? el.behavior.computed : {}
                    });
                } catch (err) {
                    console.error(`[AriaML] Erreur action "${name}":`, err);
                }
            }
        }
    };


    return { execute, actions, resolveTarget };
})();
