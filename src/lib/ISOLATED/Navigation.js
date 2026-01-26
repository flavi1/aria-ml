/**
 * AriaMLNavigation - Orchestrateur de navigation SPA AriaML.
 */
class AriaMLNavigation {
    static instance = null;

    constructor(config) {
        if (AriaMLNavigation.instance) return AriaMLNavigation.instance;
        this.baseUrl = new URL(config.navigationBaseUrl).origin;
        AriaMLNavigation.instance = this;
        this.initEventListeners();
    }

    initEventListeners() {
        // Interception des clics (a)
        document.addEventListener('click', e => {
            const link = e.target.closest('a');
            if (link && this.shouldIntercept(link)) {
                const target = (link.getAttribute('target') || '_slots').toLowerCase();
                if (target === '_slots') {
                    e.preventDefault();
                    this.navigate(link.href);
                }
            }
        });

        // Interception des formulaires (form)
        document.addEventListener('submit', e => {
            const form = e.target;
            const action = form.getAttribute('action') || window.location.href;
            if (this.shouldIntercept({ href: action })) {
                e.preventDefault();
                this.handleFormSubmit(form, e.submitter);
            }
        });

        // Bouton retour navigateur
        window.addEventListener('popstate', () => this.navigate(window.location.href, false));
    }

    shouldIntercept(element) {
        if (!element?.href) return false;
        const url = new URL(element.href, window.location.origin);
        return url.origin === this.baseUrl && !element.hasAttribute('download');
    }

	async handleFormSubmit(form, submitter) {
        const options = await AriaMLForm.prepare(form, submitter);
        const url = new URL(options.action, window.location.origin);

        const buttons = form.querySelectorAll('button, input[type="submit"]');
        buttons.forEach(btn => btn.disabled = true);

        try {
            // Utilisation de la méthode exposée
            if (options.target === '_slots') {
                await this.navigate(url.toString(), true, options);
            } else {
                await this.executeClassicNavigation(url.toString(), options);
            }
        } finally {
            buttons.forEach(btn => btn.disabled = false);
        }
    }

    /**
     * Simule la navigation vers _self, _blank etc. pour les méthodes PUT/PATCH ou JSON.
     */
    async executeClassicNavigation(url, options) {
        const isStandard = (options.method === 'GET' || options.method === 'POST') && options.enctype !== 'application/json';
        
        // Si c'est du standard vers _blank, on laisse faire nativement le navigateur
        if (isStandard && options.target === '_blank') {
            const f = document.createElement('form');
            f.method = options.method; f.action = url; f.target = '_blank';
            if (options.method === 'POST') {
                for (const [k, v] of options.body.entries()) {
                    const i = document.createElement('input'); i.type='hidden'; i.name=k; i.value=v; f.appendChild(i);
                }
            }
            document.body.appendChild(f); f.submit(); document.body.removeChild(f);
            return;
        }

        // Sinon (PUT/PATCH/JSON), on utilise le Shadow Form avec les champs cachés de contournement
		const sf = document.createElement('form');
        sf.method = 'POST'; sf.action = url; sf.target = options.target;

        if (['PUT', 'PATCH', 'DELETE'].includes(options.method)) {
            const m = document.createElement('input'); m.type='hidden'; m.name='_method'; m.value=options.method; sf.appendChild(m);
        }
        
        const csrf = window.PageProperties?.['csrf-token'];
        if (csrf) {
            const c = document.createElement('input'); c.type='hidden'; c.name='_token'; c.value=csrf; sf.appendChild(c);
        }
        if (options.enctype === 'application/json') {
            const j = document.createElement('input'); j.type='hidden'; j.name='_json'; j.value=options.body; sf.appendChild(j);
        } else if (options.body instanceof FormData) {
            for (const [k, v] of options.body.entries()) {
                if (!(v instanceof File)) {
                    const i = document.createElement('input'); i.type='hidden'; i.name=k; i.value=v; sf.appendChild(i);
                }
            }
        }
        document.body.appendChild(sf); sf.submit(); document.body.removeChild(sf);
    }

	/**
     * Cœur de la navigation SPA.
     */
    async navigate(url, pushState = true, customOptions = {}) {
        const useTransition = document.startViewTransition && 
                            !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        // --- PHASE DE REQUÊTE : Verrouillage Global immédiat ---
        document.documentElement.setAttribute('aria-busy', 'true');
        document.documentElement.setAttribute('inert', '');

        try {
            const fetchOptions = {
                method: customOptions.method || 'GET',
                headers: {
                    'Accept': 'text/aria-ml, application/aria-xml, text/html, application/xhtml+xml',
                    ...(customOptions.headers || {})
                },
                body: customOptions.method !== 'GET' ? customOptions.body : null,
                redirect: 'follow'
            };

            const response = await fetch(url, fetchOptions);
            const finalUrl = response.url || url;

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const text = await response.text();
            const contentType = response.headers.get('Content-Type') || 'text/html';
            const mimeType = contentType.includes('xml') ? 'application/xhtml+xml' : 'text/html';
            const doc = new DOMParser().parseFromString(text, mimeType);

            // Le transfert vers applyDOMUpdate gère la transition de busy
            await this.applyDOMUpdate(doc, finalUrl, pushState);

        } catch (error) {
            console.warn('AriaML Navigation Fallback:', error.message);
            // En cas d'erreur, on libère le document avant le fallback
            document.documentElement.removeAttribute('aria-busy');
            document.documentElement.removeAttribute('inert');
            
            if (pushState && (!customOptions.method || customOptions.method === 'GET')) {
                window.location.href = url;
            }
        }
    }

	async applyDOMUpdate(doc, url, pushState) {
        const currentRoot = document.querySelector('aria-ml');
        const incomingRoot = doc.querySelector('aria-ml, aria-ml-fragment');
        const useTransition = document.startViewTransition && 
                              !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (!currentRoot || !incomingRoot) {
            document.documentElement.removeAttribute('aria-busy');
            document.documentElement.removeAttribute('inert');
            return;
        }

        const isFullReplacement = incomingRoot.tagName.toLowerCase() === 'aria-ml';
        const targetSlots = [];

        // --- PHASE DE MUTATION : Transition de Verrouillage ---
        if (isFullReplacement) {
            // On garde le verrouillage global, mais on prépare le nom de transition
            if (useTransition) currentRoot.style.viewTransitionName = 'aria-ml-root';
            targetSlots.push(currentRoot);
        } else {
            // Libération de la racine pour permettre l'interaction hors-slots
            document.documentElement.removeAttribute('aria-busy');
            document.documentElement.removeAttribute('inert');

            doc.querySelectorAll('[slot]').forEach(newSlot => {
                const slotName = newSlot.getAttribute('slot');
                const target = currentRoot.querySelector(`[slot="${slotName}"]`);
                if (target) {
                    // Verrouillage local du slot pendant sa mutation/animation
                    target.setAttribute('aria-busy', 'true');
                    target.setAttribute('inert', ''); 
                    if (useTransition) target.style.viewTransitionName = `slot-${slotName}`;
                    targetSlots.push(target);
                }
            });
        }

        const performUpdate = () => {
            if (isFullReplacement) {
                currentRoot.innerHTML = incomingRoot.innerHTML;
                Array.from(incomingRoot.attributes).forEach(a => currentRoot.setAttribute(a.name, a.value));
            } else {
                doc.querySelectorAll('[slot]').forEach(newSlot => {
                    const slotName = newSlot.getAttribute('slot');
                    const target = currentRoot.querySelector(`[slot="${slotName}"]`);
                    if (target) {
                        target.innerHTML = newSlot.innerHTML;
                        Array.from(newSlot.attributes).forEach(a => target.setAttribute(a.name, a.value));
                    }
                });
            }
            if (pushState) history.pushState(null, '', url);
            window.scrollTo(0, 0);
        };

        // --- EXÉCUTION & LIBÉRATION FINALE ---
        if (useTransition) {
            const transition = document.startViewTransition(() => performUpdate());
            await transition.finished;

            // Nettoyage des styles et attributs après animation
            targetSlots.forEach(el => {
                el.style.viewTransitionName = '';
                el.removeAttribute('aria-busy');
                el.removeAttribute('inert');
            });
        } else {
            performUpdate();
            targetSlots.forEach(el => {
                el.removeAttribute('aria-busy');
                el.removeAttribute('inert');
            });
        }

        // Libération de la racine (essentiel pour le cas isFullReplacement)
        document.documentElement.removeAttribute('aria-busy');
        document.documentElement.removeAttribute('inert');

        // GESTION DU FOCUS
        const manageFocus = (container) => {
            const auto = container.querySelector('[autofocus]');
            if (auto) {
                auto.focus();
            } else {
                if (!container.hasAttribute('tabindex')) container.setAttribute('tabindex', '-1');
                container.focus();
            }
        };

        if (targetSlots.length > 0) manageFocus(targetSlots[0]);

        document.dispatchEvent(new CustomEvent('ariaml:navigated', { detail: { url } }));
    }
}

// Initialisation automatique au chargement du script isolé
window.NavigationManager = new AriaMLNavigation({ 
    navigationBaseUrl: window.location.origin 
});
