(function() {
    // 1. Vérification du support natif
    // Si la racine est déjà ARIAML, le navigateur gère le format.
    if (document.documentElement && document.documentElement.tagName === "ARIAML") {
        console.info("AriaML supporté nativement.");
        return;
    }

    // 2. Interception du contenu brut
    // Lorsque le navigateur reçoit un type inconnu, il place souvent le texte dans un <pre>
    const rawContent = document.body ? document.body.innerText : document.documentElement.textContent;

    // 3. Transformation AriaML -> HTML Structure
    // On enveloppe le contenu AriaML dans une structure HTML standard
    const parser = new DOMParser();
    const ariaDoc = parser.parseFromString(rawContent, "text/xml"); 
    
    // On crée le nouveau document HTML
    const htmlContent = `
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <title>AriaML Render</title>
            <style>
                /* Styles par défaut pour les balises AriaML */
                aria-ml { display: block; }
            </style>
        </head>
        <body>
            ${rawContent}
        </body>
        </html>
    `;

    // 4. Réécriture du document
    // document.open() efface le contenu "text/plain" et permet d'écrire du "text/html"
    document.open("text/html", "replace");
    document.write(htmlContent);
    document.close();
})();
