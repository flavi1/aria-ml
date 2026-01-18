/**
 * AriaML Behavior Actions
 * Bibliothèque des micro-actions et exécuteur de séquences.
 */
const behaviorActions = (() => {

    const resolveTarget = (el, token) => {
        const lastAt = token.lastIndexOf('@');
        const lastDot = token.lastIndexOf('.');
        const sepIdx = Math.max(lastAt, lastDot);
        
        // Si sepIdx est -1, c'est que le token ne contient ni @ ni . (erreur de syntaxe ou sélecteur pur)
        // Si sepIdx est 0, le chemin est vide (ex: "@attr"), on assume "self"
        let chainPath = token.substring(0, sepIdx);
        if (sepIdx <= 0) chainPath = 'self'; 

        const property = token.substring(sepIdx + 1);
        const type = token[sepIdx] === '@' ? 'attribute' : 'class';

        return { 
            nodes: behaviorResolvers.resolveChain(el, chainPath), 
            type, 
            name: property 
        };
    };

    const actions = {
        'set': (el, args) => {
            const target = resolveTarget(el, args[0]);
            const value = args[1] !== undefined ? args[1] : "";
            target.nodes.forEach(n => {
                if (target.type === 'attribute') n.setAttribute(target.name, value);
                else n.classList.add(target.name);
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
        // Découpe de la séquence par espace, en ignorant les espaces dans les parenthèses
        const sequence = behaviorStr.split(/\s+(?![^()]*\))/);

        for (const actionStr of sequence) {
            const match = actionStr.match(/^([\w-]+)(?:\((.*)\))?$/);
            if (!match) continue;

            const name = match[1].trim();
            const rawArgs = match[2] || "";
            
            // Parsing des arguments gérant les virgules et les guillemets
            const args = rawArgs ? rawArgs.split(/,\s*(?=(?:[^"]*"[^"]*")*[^"]*$)/)
                                          .map(a => a.replace(/['"]/g, '').trim()) 
                                 : [];

            if (actions[name]) {
                await actions[name](el, args, originalEvent);
            }
        }
    };

    return { execute };
})();
