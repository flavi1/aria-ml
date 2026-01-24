/**
 * AriaMLForm - Préparation universelle des données de formulaire.
 */
class AriaMLForm {
    static async prepare(form, submitter = null) {
        // Résolution des attributs (Bouton > Formulaire)
        const method = (submitter?.getAttribute('formmethod') || form.getAttribute('method') || 'POST').toUpperCase();
        const action = submitter?.getAttribute('formaction') || form.getAttribute('action') || window.location.href;
        const target = (submitter?.getAttribute('formtarget') || form.getAttribute('target') || '_slots').toLowerCase();
        let enctype = (submitter?.getAttribute('formenctype') || form.getAttribute('enctype') || 'multipart/form-data').toLowerCase();

        if (enctype === 'json') enctype = 'application/json';

		const formData = new FormData(form);
        const headers = { 'Accept': 'text/aria-ml, text/html, application/xhtml+xml' };
        
        const csrf = window.PageProperties?.['csrf-token'];
        if (csrf) {
            headers['X-CSRF-TOKEN'] = csrf;
        }

        let body;
        if (enctype === 'application/json' && method !== 'GET') {
            headers['Content-Type'] = 'application/json';
            const jsonObject = {};
            for (const [key, value] of formData.entries()) {
                if (value instanceof File && value.name) {
                    jsonObject[key] = await this.fileToBase64(value);
                } else {
                    jsonObject[key] = value;
                }
            }
            body = JSON.stringify(jsonObject);
        } else {
            body = formData;
        }

        return { action, method, target, headers, body, enctype };
    }

    /**
     * Convertit un fichier en objet pour le flux JSON.
     */
    static fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve({
                name: file.name,
                type: file.type,
                content: reader.result
            });
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
}
