/**
 * AriaMLModel.js
 * Gère le volet "Données" d'AriaML : Modèles XML/JSON, Shadow REST et XPath.
 */
(function() {
    const AriaMLModel = {
        models: new Map(),
        isInternalSync: false,

        init: function() {
            // 1. Interception des formulaires vers le REST interne (#id)
            document.addEventListener('submit', e => {
                const action = e.target.getAttribute('action');
                if (action && action.startsWith('#')) {
                    e.preventDefault();
                    this.handleRequest(e.target);
                }
            });

            // 2. Synchronisation en temps réel (Liaison bidirectionnelle via 'ref')
            document.addEventListener('input', e => {
                if (e.target.hasAttribute('ref')) {
                    this.syncInputToModel(e.target);
                }
            });

            // 3. Chargement initial
            this.loadModels();
        },

        loadModels: function() {
            document.querySelectorAll('aria-ml-model').forEach(modelEl => {
                const id = modelEl.id;
                const xmlScript = modelEl.querySelector('script[type="xml"]');
                // Support DX friendly pour script[type="json"]
                const jsonScript = modelEl.querySelector('script[type="application/json"], script[type="json"]');
                
                let xmlDoc;
                const parser = new DOMParser();

                if (xmlScript && xmlScript.textContent.trim()) {
                    xmlDoc = parser.parseFromString(xmlScript.textContent, "text/xml");
                } else if (jsonScript && jsonScript.textContent.trim()) {
                    const data = JSON.parse(jsonScript.textContent);
                    xmlDoc = this.jsonToXml(data);
                }

                if (xmlDoc && !this.models.has(id)) {
                    this.models.set(id, {
                        dom: modelEl,
                        xml: xmlDoc,
                        xmlScript: xmlScript || this.createScript(modelEl, 'xml'),
                        jsonScript: jsonScript || this.createScript(modelEl, 'json')
                    });
                    
                    // Initialisation et première synchronisation des scripts miroirs
                    this.saveAndNotify(this.models.get(id));
                    
                    // Observation des modifications manuelles sur le JSON (innerHTML/innerText)
                    if (jsonScript) this.observeJsonScript(id, jsonScript);
                }
            });
        },

        // --- Moteur de Conversion Lossless XML <-> JSON ---

        jsonToXml: function(obj, rootName = "root") {
            const doc = document.implementation.createDocument("", rootName, null);
            const build = (parent, data) => {
                if (typeof data !== 'object' || data === null) {
                    parent.textContent = data;
                    return;
                }
                Object.entries(data).forEach(([key, val]) => {
                    if (key.startsWith('@')) {
                        parent.setAttribute(key.slice(1), val);
                    } else if (key === '$text') {
                        parent.textContent = val;
                    } else {
                        const child = doc.createElement(key);
                        parent.appendChild(child);
                        build(child, val);
                    }
                });
            };
            build(doc.documentElement, obj);
            return doc;
        },

        xmlToJson: function(node) {
            const obj = {};
            if (node.attributes) {
                Array.from(node.attributes).forEach(attr => obj["@" + attr.name] = attr.value);
            }
            const children = Array.from(node.childNodes);
            if (children.length === 1 && children[0].nodeType === 3) {
                if (Object.keys(obj).length === 0) return children[0].textContent;
                obj["$text"] = children[0].textContent;
            } else {
                children.forEach(child => {
                    if (child.nodeType === 1) obj[child.nodeName] = this.xmlToJson(child);
                });
            }
            return obj;
        },

        // --- Shadow REST Engine ---

        handleRequest: function(form) {
            const actionAttr = form.getAttribute('action');
            const [modelId, ...pathParts] = actionAttr.slice(1).split('/');
            const model = this.models.get(modelId);
            if (!model) return;

            const method = (form.getAttribute('method') || 'GET').toUpperCase();
            const xpath = pathParts.length ? '/' + pathParts.join('/') : null;
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());

            switch(method) {
                case 'PATCH':
                    this.applyPatch(model, form);
                    break;
                case 'POST':
                    this.applyPost(model, xpath, data);
                    break;
                case 'DELETE':
                    this.applyDelete(model, xpath);
                    break;
            }
            this.saveAndNotify(model);
        },

        applyPatch: function(model, form) {
            form.querySelectorAll('[ref]').forEach(field => {
                const xpath = field.getAttribute('ref');
                const value = field.type === 'checkbox' ? field.checked : field.value;
                if (field.checkValidity()) {
                    this.updateXmlValue(model.xml, xpath, value);
                }
            });
        },

        applyPost: function(model, parentXpath, data) {
            const parent = this.evaluateXPath(model.xml, parentXpath || '/*');
            if (parent) {
                const newNode = model.xml.createElement('item');
                Object.entries(data).forEach(([key, val]) => {
                    const child = model.xml.createElement(key);
                    child.textContent = val;
                    newNode.appendChild(child);
                });
                parent.appendChild(newNode);
            }
        },

        applyDelete: function(model, xpath) {
            const node = this.evaluateXPath(model.xml, xpath);
            if (node && node.parentNode) node.parentNode.removeChild(node);
        },

        // --- Helpers & Sync ---

        updateXmlValue: function(xmlDoc, xpath, value) {
            const node = this.evaluateXPath(xmlDoc, xpath);
            if (node) {
                if (node.nodeType === 2) node.value = value;
                else node.textContent = value;
            }
        },

        evaluateXPath: function(xmlDoc, xpath) {
            try {
                const result = xmlDoc.evaluate(xpath, xmlDoc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                return result.singleNodeValue;
            } catch (e) { return null; }
        },

        saveAndNotify: function(model, skipJson = false) {
            this.isInternalSync = true;
            
            // Sync XML Script
            const serializer = new XMLSerializer();
            let xmlString = serializer.serializeToString(model.xml).replace(/\sxmlns="[^"]*"/g, "");
            model.xmlScript.textContent = xmlString;

            // Sync JSON Script (Miroir automatique)
            if (!skipJson && model.jsonScript) {
                const jsonData = this.xmlToJson(model.xml.documentElement);
                model.jsonScript.textContent = JSON.stringify(jsonData, null, 2);
            }

            // Event & UI Update
            model.dom.dispatchEvent(new CustomEvent('ariaml:updated', { 
                bubbles: true, 
                detail: { modelId: model.dom.id } 
            }));
            this.syncAllFields(model);
            this.isInternalSync = false;
        },

        syncAllFields: function(model) {
            document.querySelectorAll(`[ref]`).forEach(field => {
                const action = field.closest('form')?.getAttribute('action') || "";
                if (action.startsWith('#' + model.dom.id)) {
                    const node = this.evaluateXPath(model.xml, field.getAttribute('ref'));
                    if (node) {
                        const val = node.nodeType === 2 ? node.value : node.textContent;
                        if (field.type === 'checkbox') field.checked = (val === 'true' || val === true);
                        else if (field.value !== val) field.value = val;
                    }
                }
            });
        },

        syncInputToModel: function(input) {
            const action = input.closest('form')?.getAttribute('action');
            if (!action || !action.startsWith('#')) return;

            const modelId = action.slice(1).split('/')[0];
            const model = this.models.get(modelId);
            if (model && !this.isInternalSync) {
                const val = input.type === 'checkbox' ? input.checked : input.value;
                this.updateXmlValue(model.xml, input.getAttribute('ref'), val);
                this.saveAndNotify(model);
            }
        },

        observeJsonScript: function(modelId, script) {
            const observer = new MutationObserver(() => {
                if (this.isInternalSync) return;
                try {
                    const data = JSON.parse(script.textContent);
                    const model = this.models.get(modelId);
                    if (model) {
                        model.xml = this.jsonToXml(data);
                        this.saveAndNotify(model, true); 
                    }
                } catch(e) {}
            });
            observer.observe(script, { characterData: true, childList: true, subtree: true });
        },

        createScript: function(parent, type) {
            const s = document.createElement('script');
            s.type = type === 'json' ? 'json' : 'xml';
            parent.appendChild(s);
            return s;
        }
    };

    window.AriaMLModel = AriaMLModel;
    document.addEventListener('DOMContentLoaded', () => AriaMLModel.init());
})();
