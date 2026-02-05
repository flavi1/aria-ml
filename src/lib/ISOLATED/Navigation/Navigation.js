/**
 * AriaMLNavigation - Orchestrateur de navigation SPA AriaML.
 */
class AriaMLNavigation {
    static instance = null;

    constructor(config) {
        if (AriaMLNavigation.instance) return AriaMLNavigation.instance;
        this.baseUrl = new URL(config.navigationBaseUrl, window.location.origin).origin;
        AriaMLNavigation.instance = this;
        this.initEventListeners();
    }

    isInternal(url) {
        try {
            const target = new URL(url, window.location.origin);
            return target.origin === this.baseUrl;
        } catch (e) {
            return false;
        }
    }

    initEventListeners() {
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

        document.addEventListener('submit', e => {
            const form = e.target;
            const action = form.getAttribute('action') || window.location.href;
            if (this.isInternal(action)) {
                e.preventDefault();
                this.handleFormSubmit(form, e.submitter);
            }
        });

        window.addEventListener('popstate', () => this.navigate(window.location.href, false));
    }

    shouldIntercept(element) {
        if (!element?.href) return false;
        return this.isInternal(element.href) && !element.hasAttribute('download');
    }

    async handleFormSubmit(form, submitter) {
        const options = await AriaMLForm.prepare(form, submitter);
        const url = new URL(options.action, window.location.origin);
        const buttons = form.querySelectorAll('button, input[type="submit"]');
        buttons.forEach(btn => btn.disabled = true);

        try {
            if (options.target === '_slots') {
                await this.navigate(url.toString(), true, options);
            } else {
                await this.executeClassicNavigation(url.toString(), options);
            }
        } finally {
            buttons.forEach(btn => btn.disabled = false);
        }
    }

    async executeClassicNavigation(url, options) {
        const internal = this.isInternal(url);
        const isStandard = (options.method === 'GET' || options.method === 'POST') && options.enctype !== 'application/json';
        
        if (isStandard && options.target === '_blank') {
            const f = document.createElement('form');
            f.method = options.method; f.action = url; f.target = '_blank';
            if (options.method === 'POST' && options.body instanceof FormData) {
                for (const [k, v] of options.body.entries()) {
                    const i = document.createElement('input'); i.type='hidden'; i.name=k; i.value=v; f.appendChild(i);
                }
            }
            document.body.appendChild(f); f.submit(); document.body.removeChild(f);
            return;
        }

        const sf = document.createElement('form');
        sf.method = 'POST'; sf.action = url; sf.target = options.target;

        if (internal) {
            if (['PUT', 'PATCH', 'DELETE'].includes(options.method)) {
                const m = document.createElement('input'); m.type='hidden'; m.name='_method'; m.value=options.method; sf.appendChild(m);
            }
            const csrf = window.PageProperties?.['csrf-token'];
            if (csrf) {
                const c = document.createElement('input'); c.type='hidden'; c.name='_token'; c.value=csrf; sf.appendChild(c);
            }
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

    async navigate(url, pushState = true, customOptions = {}) {
        document.documentElement.setAttribute('aria-busy', 'true');
        document.documentElement.setAttribute('inert', '');

        try {
            const internal = this.isInternal(url);
            const cacheKeys = window.NodeCache ? NodeCache.getValidKeys() : [];

            const headers = {
                'Accept': 'text/aria-ml-fragment, application/aria-xml-fragment, text/aria-ml, application/aria-xml, text/html, application/xhtml+xml',
                ...(customOptions.headers || {})
            };

            if (internal) {
                headers['nav-cache'] = JSON.stringify(cacheKeys);
                const csrf = window.PageProperties?.['csrf-token'];
                if (csrf) headers['X-CSRF-TOKEN'] = csrf;
            }

            const fetchOptions = {
                method: customOptions.method || 'GET',
                headers: headers,
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

            await this.applyDOMUpdate(doc, finalUrl, pushState);

        } catch (error) {
            console.warn('AriaML Navigation Fallback:', error.message);
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
        
        if (!currentRoot || !incomingRoot || currentRoot.getAttribute('nav-base-url') != incomingRoot.getAttribute('nav-base-url')) {
            window.location.href = url;
            return;
        }

        // --- PHASE 1 : CAPTURE DU CONTENU ACTUEL ---
        // Avant de vider quoi que ce soit, on déplace les enfants vivants vers le cache
        document.querySelectorAll('[nav-cache]').forEach(el => NodeCache.capture(el));

        const isFullReplacement = incomingRoot.tagName.toLowerCase() === 'aria-ml';
        const targetSlots = [];

        if (isFullReplacement) {
            targetSlots.push(currentRoot);
        } else {
            doc.querySelectorAll('[nav-slot]').forEach(newSlot => {
                const slotName = newSlot.getAttribute('nav-slot');
                const target = currentRoot.querySelector(`[nav-slot="${slotName}"]`);
                if (target) {
                    target.setAttribute('aria-busy', 'true');
                    target.setAttribute('inert', ''); 
                    targetSlots.push(target);
                }
            });
        }

        const performUpdate = () => {
            const fragmentsToProcess = isFullReplacement ? [incomingRoot] : doc.querySelectorAll('[nav-slot]');

            fragmentsToProcess.forEach(sourceEl => {
                const slotName = sourceEl.getAttribute('nav-slot');
                const targetEl = isFullReplacement ? currentRoot : currentRoot.querySelector(`[nav-slot="${slotName}"]`);

                if (targetEl) {
                    // On vide le conteneur (les nœuds vivants sont déjà en sécurité dans NodeCache)
                    targetEl.innerHTML = '';

                    // CAS A : Le slot lui-même a un nav-cache
                    const key = sourceEl.getAttribute('nav-cache');
                    const cachedFragment = key ? window.NodeCache?.registry?.get(key) : null;

                    if (cachedFragment instanceof DocumentFragment && cachedFragment.hasChildNodes()) {
                        // RESTAURATION : On ré-injecte les nœuds vivants du fragment
                        targetEl.appendChild(cachedFragment);
                    } else {
                        // CAS B : On transplante les nouveaux nœuds du serveur
                        while (sourceEl.firstChild) {
                            const child = sourceEl.firstChild;
                            
                            // Récursivité pour les sous-éléments cachés
                            if (child.nodeType === 1 && child.hasAttribute('nav-cache')) {
                                const subKey = child.getAttribute('nav-cache');
                                const subFragment = window.NodeCache?.registry?.get(subKey);
                                if (subFragment instanceof DocumentFragment && subFragment.hasChildNodes()) {
                                    document.adoptNode(child);
                                    child.appendChild(subFragment);
                                    targetEl.appendChild(child);
                                    continue;
                                }
                            }
                            document.adoptNode(child);
                            targetEl.appendChild(child);
                        }
                    }

                    // On synchronise les attributs du slot (pour les classes ou la nouvelle clé de cache)
                    Array.from(sourceEl.attributes).forEach(a => targetEl.setAttribute(a.name, a.value));
                }
            });

            if (pushState) history.pushState(null, '', url);
            window.scrollTo(0, 0);
        };

        if (useTransition) {
            const transition = document.startViewTransition(() => performUpdate());
            await transition.finished;
        } else {
            performUpdate();
        }

        targetSlots.forEach(el => {
            el.removeAttribute('aria-busy');
            el.removeAttribute('inert');
        });

        document.documentElement.removeAttribute('aria-busy');
        document.documentElement.removeAttribute('inert');

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

// Initialisation
const navigationBaseUrl = document.querySelector('aria-ml')?.getAttribute('nav-base-url');
if(navigationBaseUrl)
    window.NavigationManager = new AriaMLNavigation({navigationBaseUrl});
