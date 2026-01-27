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
        
        // CAS 1 : Cible structurelle (ex: "tabpanel", "self", "parent")
        if (sepIdx === -1) {
            const result = behaviorResolvers.resolveChain(el, token);
            return { 
                nodes: result.nodes, 
                type: 'nodes', 
                name: token 
            };
        }

        // CAS 2 : Cible de propriété (ex: "self@aria-expanded", "item.active")
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
        'log': (el, args) => {
            const logs = args.map(a => resolveTarget(el, a));
            console.group('[AriaML Action Log]');
            console.log('Targets Resolved:', logs);
            console.log('Source context:', el);
            console.groupEnd();
        },

        'set': (el, args) => {
            const target = resolveTarget(el, args[0]);
            const value = args[1] !== undefined ? args[1] : "";
            if (target.type === 'nodes') return; // On ne "set" pas un nœud directement

            target.nodes.forEach(n => {
                if (target.type === 'attribute') n.setAttribute(target.name, value);
                else if (target.type === 'class') n.classList.add(target.name);
            });
        },

        'rm': (el, args) => {
            const target = resolveTarget(el, args[0]);
            target.nodes.forEach(n => {
                if (target.type === 'attribute') n.removeAttribute(target.name);
                else if (target.type === 'class') n.classList.remove(target.name);
            });
        },

        'toggle': (el, args) => {
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

        'append': (el, args) => {
            const dest = behaviorResolvers.resolveChain(el, args[0]).nodes[0];
            const subject = behaviorResolvers.resolveChain(el, args[1]).nodes[0];
            if (dest && subject) dest.appendChild(subject);
        },

        'prepend': (el, args) => {
            const dest = behaviorResolvers.resolveChain(el, args[0]).nodes[0];
            const subject = behaviorResolvers.resolveChain(el, args[1]).nodes[0];
            if (dest && subject) dest.prepend(subject);
        },

        'remove': (el, args) => {
            // Ici on cible le nœud lui-même pour suppression physique
            behaviorResolvers.resolveChain(el, args[0]).nodes.forEach(n => n.remove());
        },

        'open': (el, args) => {
            behaviorResolvers.resolveChain(el, args[0]).nodes.forEach(n => {
                if (n.tagName === 'DIALOG') n.show();
                else n.removeAttribute('hidden');
            });
        },

        'open-modal': (el, args) => {
            behaviorResolvers.resolveChain(el, args[0]).nodes.forEach(n => {
                if (n.tagName === 'DIALOG') n.showModal();
                else n.removeAttribute('hidden');
            });
        },

        'close': (el, args) => {
            behaviorResolvers.resolveChain(el, args[0]).nodes.forEach(n => {
                if (n.tagName === 'DIALOG') n.close();
                else n.setAttribute('hidden', '');
            });
        },

        'focus': (el, args) => {
            const target = behaviorResolvers.resolveChain(el, args[0]).nodes[0];
            if (target) target.focus();
        },

        'trigger': (el, args) => {
            behaviorResolvers.resolveChain(el, args[0]).nodes.forEach(n => {
                n.dispatchEvent(new CustomEvent(args[1], { bubbles: true }));
            });
        },

        'wait': (el, args) => new Promise(res => setTimeout(res, parseInt(args[0]))),

        'cancel': (el, args, ev) => {
            if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
        },

        'stop': (el, args, ev) => {
            if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
        }
    };

    const execute = async (el, evName, behaviorStr, originalEvent = null) => {
        if (!behaviorStr) return;
        
        // Découpe par espace en protégeant ce qui est entre parenthèses
        const sequence = behaviorStr.split(/\s+(?![^()]*\))/);

        for (const actionStr of sequence) {
            const match = actionStr.match(/^([\w-]+)(?:\((.*)\))?$/);
            if (!match) continue;

            const name = match[1].trim();
            const rawArgs = match[2] || "";
            
            // Parsing des arguments avec support des guillemets
            const args = rawArgs 
                ? rawArgs.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(a => a.trim().replace(/^["']|["']$/g, ''))
                : [];

            if (actions[name]) {
                await actions[name](el, args, originalEvent);
            } else {
                console.warn(`[AriaML] Action inconnue: ${name}`);
            }
        }
    };

    return { execute, actions };
})();
