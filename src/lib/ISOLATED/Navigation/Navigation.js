/**
 * AriaMLNavigation - Orchestrateur de navigation SPA AriaML.
 * Version 1.4.3 - Réconciliation récursive profonde (Deep Restoration).
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
            const cacheKeys = window.NodeCache ? window.NodeCache.getValidKeys() : [];

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
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const text = await response.text();
            const doc = new DOMParser().parseFromString(text, 'text/html');

            await this.applyDOMUpdate(doc, response.url || url, pushState);

        } catch (error) {
            console.warn('AriaML Navigation Fallback:', error.message);
            if (pushState && (!customOptions.method || customOptions.method === 'GET')) {
                window.location.href = url;
            }
        } finally {
            document.documentElement.removeAttribute('aria-busy');
            document.documentElement.removeAttribute('inert');
        }
    }

    /**
     * RECONCILIATION RÉCURSIVE : Restaure le vivant depuis le cache.
     * Note : On ne "return" pas après un match pour permettre de restaurer 
     * des éléments mis en cache à l'intérieur d'autres éléments mis en cache.
     */
    reconcile(el) {
        if (el.nodeType !== 1) return;

        if (el.hasAttribute('nav-cache')) {
            const key = el.getAttribute('nav-cache');
            const fragment = window.NodeCache?.registry?.get(key);
            
            if (fragment && fragment.hasChildNodes()) {
                el.innerHTML = '';
                el.appendChild(fragment);
                // On continue l'exploration des enfants du fragment qu'on vient d'injecter
            }
        }

        Array.from(el.children).forEach(child => this.reconcile(child));
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

        // Capture du vivant actuel avant modification (Deep-to-Shallow via NodeCache.captureAll)
        if (window.NodeCache) window.NodeCache.captureAll(currentRoot);

        const isFullReplacement = incomingRoot.tagName.toLowerCase() === 'aria-ml';
        const targetSlots = [];

        if (isFullReplacement) {
            targetSlots.push(currentRoot);
        } else {
            doc.querySelectorAll('[nav-slot]').forEach(newSlot => {
                const target = currentRoot.querySelector(`[nav-slot="${newSlot.getAttribute('nav-slot')}"]`);
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
                const targetEl = isFullReplacement ? currentRoot : currentRoot.querySelector(`[nav-slot="${sourceEl.getAttribute('nav-slot')}"]`);

                if (targetEl) {
                    targetEl.innerHTML = '';
                    this.reconcile(sourceEl);

                    while (sourceEl.firstChild) {
                        const child = sourceEl.firstChild;
                        document.adoptNode(child);
                        targetEl.appendChild(child);
                    }

                    Array.from(sourceEl.attributes).forEach(a => targetEl.setAttribute(a.name, a.value));
                }
            });

            if (pushState) history.pushState(null, '', url);
        };

        if (useTransition) await document.startViewTransition(() => performUpdate()).finished;
        else performUpdate();

        targetSlots.forEach(el => {
            el.removeAttribute('aria-busy');
            el.removeAttribute('inert');
        });

		const manageFocus = (container) => {
            const auto = container.querySelector('[autofocus]');
            const target = auto || container;

            if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
            
            // On scroll d'abord pour le cadrage, puis on focus.
            // Le navigateur utilisera scroll-behavior défini en CSS.
            target.scrollIntoView({ block: 'start' });
            target.focus({ preventScroll: true }); 
        };

        if (targetSlots.length > 0) manageFocus(targetSlots[0]);
        
		// Dispatch de l'événement sémantique
        document.dispatchEvent(new CustomEvent('current-change', {
            detail: {
                type: 'page',
                value: url
            },
            bubbles: true,
            cancelable: true
        }));
    }
}

const navigationBaseUrl = document.querySelector('aria-ml')?.getAttribute('nav-base-url');
if(navigationBaseUrl) window.NavigationManager = new AriaMLNavigation({navigationBaseUrl});
