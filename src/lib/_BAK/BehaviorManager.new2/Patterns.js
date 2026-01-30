// tap pattern : stable
behaviorCore.definePattern('tab', {
    'rel-tablist': '(closest: [role=tablist])',
    'rel-tabpanel': '(root) #{aria-controls}',
    'on-click': `set(tablist@aria-selected, "false")
        set(tablist/tabpanel@hidden)
        set(self@aria-selected, "true")
        rm(tabpanel@hidden)`,
    'kb-arrowright': 'focus(next)',
    'kb-arrowleft': 'focus(prev)'
});


// accordion : KO
behaviorCore.definePattern('accordion-trigger', {
    // Chaque relation est une règle de sélection isolée
    'rel-group': '(closest: [role=accordion])',
    
    // Pour trouver les frères, on part de soi-même, on va au parent, et on filtre
    'rel-siblings': '(siblings: [role=button])',
    
    // Le panneau est lié dynamiquement par l'ID dans l'attribut aria-controls
    'rel-panel': '(root) #{aria-controls}',

    // L'action, elle, utilise le chaînage "/" pour orchestrer les relations
    'on-click': `
        cancel()
        set(siblings@aria-expanded, "false")
        set(siblings/panel@hidden, "")
        set(self@aria-expanded, "true")
        rm(panel@hidden)
    `,

    'kb-arrowdown': 'focus(next)',
    'kb-arrowup': 'focus(prev)',
    'kb-home': 'focus(group/first)',
    'kb-end': 'focus(group/last)'

});
