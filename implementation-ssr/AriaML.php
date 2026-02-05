<?php
/**
 * AriaML.php - v1.5
 * Moteur SSR / Négociation de contenu / Volatile Classes / NodeCache
 */


class AriaML {
    public $dom;
    public $ariaNode;
    public $config = null;
    public $appearance = null;
    public $attributes = [];

    public function __construct($htmlContent) {
        $this->dom = new DOMDocument();
        libxml_use_internal_errors(true);
        
        if (!empty($htmlContent)) {
            // Force l'encodage pour éviter les problèmes de caractères spéciaux
            $content = mb_encode_numericentity($htmlContent, [0x80, 0x10FFFF, 0, 0x1FFFFF], 'UTF-8');
            $this->dom->loadHTML('<?xml encoding="utf-8" ?>' . $content, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
        }
        
        libxml_clear_errors();

        // Récupération de la racine
        $this->ariaNode = $this->dom->getElementsByTagName('aria-ml')->item(0) 
                       ?? $this->dom->getElementsByTagName('aria-ml-fragment')->item(0);

        if ($this->ariaNode) {
            $this->parseAriaNode();
            $this->applyVolatileClasses();
        }
    }

    /**
     * Parse les attributs et les scripts de configuration
     */
    private function parseAriaNode() {
        foreach ($this->ariaNode->attributes as $attr) {
            $this->attributes[$attr->nodeName] = $attr->nodeValue;
        }

        $scripts = $this->ariaNode->getElementsByTagName('script');
        foreach ($scripts as $script) {
            $type = $script->getAttribute('type');
            $content = trim($script->nodeValue);

            if ($type === 'ld+json' || $type === 'application/ld+json') {
                $this->config = json_decode($content, true);
                if (isset($this->config[0])) $this->config = $this->config[0];
            }
            
            if ($type === 'style+json' || $type === 'application/style+json') {
                $this->appearance = json_decode($content, true);
            }
        }
    }

    /**
     * Applique physiquement les classes volatiles dans le DOM
     */
    private function applyVolatileClasses() {
        if (!$this->appearance) return;

        $classesMap = $this->appearance['volatileClasses'] ?? [];
        $theme = $this->appearance['defaultTheme'] ?? null;

        // Fusion avec les classes du thème par défaut
        if ($theme && isset($this->appearance['themeList'][$theme]['volatileClasses'])) {
            foreach ($this->appearance['themeList'][$theme]['volatileClasses'] as $sel => $cls) {
                $existing = (array)($classesMap[$sel] ?? []);
                $classesMap[$sel] = array_unique(array_merge($existing, (array)$cls));
            }
        }

        $xpath = new DOMXPath($this->dom);
        foreach ($classesMap as $selector => $classes) {
            $list = is_array($classes) ? $classes : explode(' ', $classes);
            
            // XPath simple pour tags, classes et IDs
            $query = ".//" . $selector; 
            if (strpos($selector, '.') === 0) $query = ".//*[contains(concat(' ', normalize-space(@class), ' '), ' " . substr($selector, 1) . " ')]";
            if (strpos($selector, '#') === 0) $query = ".//*[@id='" . substr($selector, 1) . "']";

            $nodes = $xpath->query($query, $this->ariaNode);
            foreach ($nodes as $node) {
                $curr = $node->getAttribute('class');
                $newClasses = array_unique(array_filter(array_merge(explode(' ', $curr), $list)));
                $node->setAttribute('class', implode(' ', $newClasses));
            }
        }
    }

	/**
     * Nettoie les nœuds présents dans le cache client
     */
    public function cleanNodeCache($keys) {
        if (empty($keys) || !$this->ariaNode) return;
        
        $xpath = new DOMXPath($this->dom);
        foreach ($keys as $key) {
            // On cherche l'attribut nav-cache sur le noeud lui-même OU ses descendants
            // self::* cible le noeud actuel s'il correspond, .//* cible les descendants
            $query = "self::*[@nav-cache='{K}'] | .//*[@nav-cache='{K}']";
            $query = str_replace('{K}', htmlspecialchars($key, ENT_QUOTES), $query);
            
            $nodes = $xpath->query($query, $this->ariaNode);
            
            foreach ($nodes as $node) {
                // Vider le contenu
                while ($node->hasChildNodes()) {
                    $node->removeChild($node->firstChild);
                }
                // Marquer pour le debug client et forcer la présence de l'attribut
                $node->setAttribute('data-node-cache', 'hit');
            }
        }
    }

	/**
     * Gère la sortie finale (Orchestrateur)
     */
    public static function handle($testClient = false) {
        $accept = $_SERVER['HTTP_ACCEPT'] ?? '';
        $cache = $_SERVER['HTTP_NAV_CACHE'] ?? '[]';
        
        $wantsFragment = (strpos($accept, 'aria-ml-fragment') !== false);
        $wantsAriaML = ($testClient || $wantsFragment || strpos($accept, 'text/aria-ml') !== false);
        $knownKeys = json_decode($cache, true) ?? [];

        ob_start();

        return function() use ($wantsAriaML, $wantsFragment, $testClient, $knownKeys) {
            $buffer = trim(ob_get_clean());
            if (empty($buffer)) return;

            // Une seule instanciation (Parse + Volatile classes via le constructeur)
            $aria = new AriaML($buffer);
            
            // Nettoyage du cache si nécessaire
            if ($wantsAriaML) {
                $aria->cleanNodeCache($knownKeys);
            }

            $scriptTag = '<script src="https://flavi1.github.io/aria-ml/src/standalone.js"></script>';
            
            // Mutation du tag racine en cas de fragment
            if ($wantsFragment && !$testClient && $aria->ariaNode && $aria->ariaNode->tagName === 'aria-ml') {
                $fragment = $aria->dom->createElement('aria-ml-fragment');
                
                // Transfert des attributs (nav-base-url, lang, etc.)
                foreach ($aria->ariaNode->attributes as $attr) {
                    $fragment->setAttribute($attr->nodeName, $attr->nodeValue);
                }
                
                // Transfert des nœuds enfants
                while ($aria->ariaNode->firstChild) {
                    $fragment->appendChild($aria->ariaNode->firstChild);
                }
                
                // Remplacement de la référence pour l'extraction
                $aria->ariaNode = $fragment;
            }

            // Extraction du HTML final
            $output = $testClient ? $buffer : $aria->dom->saveHTML($aria->ariaNode);
            
            // Nettoyage propre
            $output = preg_replace('/^<\?xml[^?]*\?>/i', '', trim($output));

            if ($wantsAriaML) {
                if ($wantsFragment) {
                    header('Content-Type: text/aria-ml-fragment; charset=utf-8');
                    echo $output;
                } else {
                    header('Content-Type: ' . ($testClient ? 'text/html' : 'text/aria-ml') . '; charset=utf-8');
                    echo ($testClient ? "\n" : "") . $output . ($testClient ? $scriptTag : "");
                }
                exit;
            }

            // FALLBACK SSR STANDARD
            ?>
<!DOCTYPE html>
<html <?php echo $aria->getHtmlAttributes(); ?>>
<head data-ssr>
    <meta charset="UTF-8">
    <?php echo $aria->renderHead(); ?>
</head>
<body>
    <?php echo $output; ?>
    <?php echo "\n" . $scriptTag; ?>
</body>
</html>
            <?php
            exit;
        };
    }

    public function renderHead() {
		$tags = [];
        $app = $this->appearance ?? [];
        $themeName = $app['defaultTheme'] ?? null;
        $themes = $app['themeList'] ?? [];

        // 1. CSP & CSRF
        if (isset($this->attributes['csp'])) {
            $tags[] = '<meta http-equiv="Content-Security-Policy" content="'.htmlspecialchars($this->attributes['csp']).'">';
        }
        if (isset($this->config['csrf-token'])) {
            $tags[] = '<meta name="csrf-token" content="'.htmlspecialchars($this->config['csrf-token']).'">';
        }

        // 2. Singletons (Canonical, Me, etc.)
        $singletons = ['canonical', 'me', 'shortlink', 'manifest', 'author', 'license'];
        foreach($singletons as $rel) {
            if (isset($this->config[$rel])) {
                $tags[] = '<link rel="'.$rel.'" href="'.htmlspecialchars($this->config[$rel]).'">';
            }
        }

        // 3. Metadatas (Title, OG, Twitter...)
        if (isset($this->config['metadatas'])) {
            foreach ($this->config['metadatas'] as $k => $m) {
                $isString = is_string($m);
                $val = htmlspecialchars($isString ? $m : ($m['content'] ?? ''));
                $names = (!$isString && isset($m['name'])) ? (array)$m['name'] : [$k];
                $props = (!$isString && isset($m['property'])) ? (array)$m['property'] : [];

                foreach ($names as $n) {
                    if ($n === 'title') $tags[] = "<title>$val</title>";
                    else $tags[] = "<meta name=\"$n\" content=\"$val\">";
                }
                foreach ($props as $p) $tags[] = "<meta property=\"$p\" content=\"$val\">";
            }
        }

        // 4. Alternates (RSS, Translations...)
        if (isset($this->config['alternates'])) {
            foreach ($this->config['alternates'] as $alt) {
                $alt['rel'] = isset($alt['rel']) ? "alternate " . $alt['rel'] : "alternate";
                $tags[] = $this->buildLink($alt);
            }
        }

        // 5. Links (API, Pingback...)
        if (isset($this->config['links'])) {
            foreach ($this->config['links'] as $l) $tags[] = $this->buildLink($l);
        }

        // 6. Viewport & Appearance Assets
        $vp = $themes[$themeName]['viewport'] ?? ($app['viewport'] ?? null);
        if ($vp) $tags[] = '<meta name="viewport" content="'.htmlspecialchars($vp).'">';
        
        $clr = $themes[$themeName]['browserColor'] ?? ($app['browserColor'] ?? null);
        if ($clr) $tags[] = '<meta name="theme-color" content="'.htmlspecialchars($clr).'">';
        
        if (isset($app['assets'])) {
            foreach ($app['assets'] as $a) $tags[] = $this->buildLink(is_string($a) ? ['href' => $a, 'rel' => 'stylesheet'] : $a);
        }
        // 7. Themes
        foreach ($themes as $name => $data) {
            $active = ($name === $themeName);
            foreach ($data['assets'] ?? [] as $a) {
                if (($a['rel'] ?? '') === 'stylesheet') {
                    $a['title'] = $name;
                    if (!$active) $a['rel'] = 'alternate stylesheet';
                }
                $tags[] = $this->buildLink($a, $active);
            }
        }
        return implode("\n\t", $tags);
    }

    private function buildLink($a, $active = true) {
        $rel = htmlspecialchars($a['rel'] ?? 'stylesheet');
        $href = htmlspecialchars($a['href'] ?? '');
        $at = "";
        foreach ($a as $k => $v) {
            if (!in_array($k, ['rel', 'href'])) $at .= ' '.htmlspecialchars($k).'="'.htmlspecialchars($v).'"';
        }
        $dis = (!$active && strpos($rel, 'alternate') !== false) ? ' disabled' : '';
        return "<link rel=\"$rel\" href=\"$href\"$at$dis>";
    }

    public function getHtmlAttributes() {
        $out = "";
        foreach ($this->attributes as $k => $v) {
            if ($k !== 'csp') $out .= " $k=\"".htmlspecialchars($v)."\"";
        }
        return trim($out);
    }
}
