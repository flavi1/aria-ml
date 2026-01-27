/**
 * AriaML Behavior Actions
 * Version 1.4.4 - Fix ResolveTarget & Node targeting
 */
const behaviorActions = (() => {

    const resolveTarget = (el, token) => {
        const lastAt = token.lastIndexOf('@');
        const lastDot = token.lastIndexOf('.');
        const sepIdx = Math.max(lastAt, lastDot);
        
        // CAS 1 : Cible directe de nœuds (ex: "tabpanel", "self", "list")
        if (sepIdx === -1) {
            return { 
                nodes: behaviorResolvers.resolveChain(el, token), 
                type: 'nodes', 
                name: token 
            };
        }

        // CAS 2 : Cible de propriété (ex: "self@aria-expanded", "item.active")
        let chainPath = token.substring(0, sepIdx);
        if (chainPath === "") chainPath = 'self'; 

        const property = token.substring(sepIdx + 1);
        const type = token[sepIdx] === '@' ? 'attribute' : 'class';

        return { 
            nodes: behaviorResolvers.resolveChain(el, chainPath), 
            type, 
            name: property 
        };
    };

    const actions = {
        'log': (el, args) => {
            const logs = args.map(a => resolveTarget(el, a));
            console.group('[Behavior Sheet Log]');
            console.log('Targets:', logs);
            console.log('Source element:', el);
            console.log('Raw arguments:', args);
            console.groupEnd();
        },

        'set': (el, args) => {
            const target = resolveTarget(el, args[0]);
            const value = args[1] !== undefined ? args[1] : "";
            target.nodes.forEach(n => {
                if (target.type === 'attribute') n.setAttribute(target.name, value);
                else if (target.type === 'class') n.classList.add(target.name);
                // On ne fait rien si le type est 'nodes' pour un 'set'
            });
        },

        'rm': (el, args) => {
            const target = resolveTarget(el, args[0]);
            target.nodes.forEach(n => {
                if (target.type === 'attribute') n.removeAttribute(target.name);
                else n.classList.remove(target.name);
            });
        },

        'toggle': (el, args) => {
            const target = resolveTarget(el, args[0]);
            const cycle = args.slice(1);
            target.nodes.forEach(n => {
                if (target.type === 'class') {
                    n.classList.toggle(target.name);
                } else {
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
            const dest = behaviorResolvers.resolveChain(el, args[0])[0];
            const subject = behaviorResolvers.resolveChain(el, args[1])[0];
            if (dest && subject) dest.appendChild(subject);
        },

        'prepend': (el, args) => {
            const dest = behaviorResolvers.resolveChain(el, args[0])[0];
            const subject = behaviorResolvers.resolveChain(el, args[1])[0];
            if (dest && subject) dest.prepend(subject);
        },

        'remove': (el, args) => {
            const targets = behaviorResolvers.resolveChain(el, args[0]);
            targets.forEach(n => n.remove());
        },

        'open': (el, args) => {
            behaviorResolvers.resolveChain(el, args[0]).forEach(n => {
                if (n.tagName === 'DIALOG') n.show();
                else n.removeAttribute('hidden');
            });
        },

        'open-modal': (el, args) => {
            behaviorResolvers.resolveChain(el, args[0]).forEach(n => {
                if (n.tagName === 'DIALOG') n.showModal();
                else n.removeAttribute('hidden');
            });
        },

        'close': (el, args) => {
            behaviorResolvers.resolveChain(el, args[0]).forEach(n => {
                if (n.tagName === 'DIALOG') n.close();
                else n.setAttribute('hidden', '');
            });
        },

        'focus': (el, args) => {
            const target = behaviorResolvers.resolveChain(el, args[0])[0];
            if (target) target.focus();
        },

        'trigger': (el, args) => {
            const nodes = behaviorResolvers.resolveChain(el, args[0]);
            nodes.forEach(n => n.dispatchEvent(new CustomEvent(args[1], { bubbles: true })));
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
        
        // Découpe de la séquence par espace (ignore espaces dans parenthèses)
        const sequence = behaviorStr.split(/\s+(?![^()]*\))/);

        for (const actionStr of sequence) {
            const match = actionStr.match(/^([\w-]+)(?:\((.*)\))?$/);
            if (!match) continue;

            const name = match[1].trim();
            const rawArgs = match[2] || "";
            
            // Parsing des arguments : on sépare par virgule, on nettoie les guillemets
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
