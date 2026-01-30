<?php

/**
 * AriaML.php - Moteur de rendu SSR et Négociation de contenu v1.4.9
 * Incorpore : NodeCache, Content Negotiation, Appearance & VolatileClasses SSR.
 */
class AriaML {
    private $dom;
    private $ariaNode;
    private $config = null;      // PageProperties (JSON-LD)
    private $appearance = null;  // Appearance Config
    private $attributes = [];

    public function __construct($htmlContent) {
        $this->dom = new DOMDocument();
        libxml_use_internal_errors(true);
        
        if (!empty($htmlContent)) {
            // Conversion propre en entités numériques pour préserver l'UTF-8
            $content = mb_encode_numericentity($htmlContent, [0x80, 0x10FFFF, 0, 0x1FFFFF], 'UTF-8');
            $this->dom->loadHTML($content, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
        }
        
        libxml_clear_errors();

        $this->ariaNode = $this->dom->getElementsByTagName('aria-ml')->item(0) 
                       ?? $this->dom->getElementsByTagName('aria-ml-fragment')->item(0);

        $this->parseAriaNode();
        
        // Nouveauté 1.4.9 : Injection des classes volatiles pour le rendu initial
        $this->applyVolatileClassesSSR();
    }

    /**
     * Orchestrateur principal : gère le buffer PHP et la réponse au client.
     */
    public static function handle($testClient = false) {
        $acceptHeader = $_SERVER['HTTP_ACCEPT'] ?? '';
        $cacheHeader = $_SERVER['HTTP_LIVE_CACHE'] ?? '[]';
        
        $wantsFragment = (strpos($acceptHeader, 'aria-ml-fragment') !== false);
        $wantsAriaML = ($testClient || $wantsFragment || strpos($acceptHeader, 'text/aria-ml') !== false);
        
        $knownKeys = json_decode($cacheHeader, true) ?? [];

        ob_start();
        return function() use ($wantsAriaML, $wantsFragment, $testClient, $knownKeys) {
            $buffer = trim(ob_get_clean());
            $script = '<script src="https://flavi1.github.io/aria-ml/src/standalone.js"></script>';
            
            if ($wantsAriaML) {
                $worker = new DOMDocument();
                libxml_use_internal_errors(true);
                $worker->loadHTML('<?xml encoding="utf-8" ?>' . $buffer, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
                
                $rootTagName = $wantsFragment ? 'aria-ml-fragment' : 'aria-ml';
                $existingRoot = $worker->getElementsByTagName($rootTagName)->item(0);

                if (!$existingRoot) {
                    $newRoot = $worker->createElement($rootTagName);
                    $nodesToMove = [];
                    foreach ($worker->childNodes as $node) $nodesToMove[] = $node;
                    foreach ($nodesToMove as $node) $newRoot->appendChild($node);
                    $worker->appendChild($newRoot);
                }

                $aria = new self($worker->saveHTML());

                // Optimisation NodeCache
                if (!empty($knownKeys)) {
                    $xpath = new DOMXPath($aria->dom);
                    foreach ($knownKeys as $key) {
                        $nodes = $xpath->query("//*[@live-cache='" . htmlspecialchars($key) . "']");
                        foreach ($nodes as $node) {
                            while ($node->hasChildNodes()) {
                                $node->removeChild($node->firstChild);
                            }
                        }
                    }
                }

                $finalOutput = $aria->dom->saveHTML();
                $finalOutput = preg_replace('/^<\?xml[^?]*\?>/i', '', trim($finalOutput));

                if ($wantsFragment) {
                    header('Content-Type: text/aria-ml-fragment; charset=utf-8');
                    echo $finalOutput;
                    exit;
                }

                header('Content-Type: ' . ($testClient ? 'text/html' : 'text/aria-ml') . '; charset=utf-8');
                echo ($testClient ? "\n" : '') . $finalOutput . ($testClient ? $script : '');
                exit;
            }

            // Fallback SSR : Rendu HTML5 Standard
            $aria = new self($buffer);
?>
<!DOCTYPE html>
<html <?php echo $aria->getHtmlAttributes(); ?>>
<head data-ssr><meta charset="UTF-8">
    <?php echo "\n	".$aria->renderHead(); ?>
</head>
<body>
    <?php echo $buffer; ?>
    <?php echo "\n".$script; ?>
</body>
</html>
<?php
        };
    }

    private function parseAriaNode() {
        if (!$this->ariaNode) return;

        foreach ($this->ariaNode->attributes as $attr) {
            $this->attributes[$attr->nodeName] = $attr->nodeValue;
        }

        $scripts = $this->ariaNode->getElementsByTagName('script');
        foreach ($scripts as $script) {
            $type = $script->getAttribute('type');
            $content = trim($script->nodeValue);

            if ($type === 'ld+json' || $type === 'application/ld+json') {
                $decoded = json_decode($content, true);
                $this->config = isset($decoded[0]) ? $decoded[0] : $decoded;
            }
            
            if ($type === 'style+json' || $type === 'application/style+json') {
                $this->appearance = json_decode($content, true);
            }
        }
    }

    /**
     * Applique les volatileClasses sur le DOM avant l'envoi pour éviter le flash visuel.
     */
    private function applyVolatileClassesSSR() {
        if (!$this->appearance) return;

        $classesToApply = $this->appearance['volatileClasses'] ?? [];
        $defaultTheme = $this->appearance['defaultTheme'] ?? null;

        if ($defaultTheme && isset($this->appearance['themeList'][$defaultTheme]['volatileClasses'])) {
            $themeVolatiles = $this->appearance['themeList'][$defaultTheme]['volatileClasses'];
            foreach ($themeVolatiles as $selector => $classes) {
                $existing = (array)($classesToApply[$selector] ?? []);
                $new = (array)$classes;
                $classesToApply[$selector] = array_unique(array_merge($existing, $new));
            }
        }

        $xpath = new DOMXPath($this->dom);
        foreach ($classesToApply as $selector => $classes) {
            $classList = is_array($classes) ? $classes : explode(' ', $classes);
            
            // Sélecteur CSS vers XPath simplifié
            $query = "//" . $selector; // Défaut (tag)
            if (strpos($selector, '.') === 0) $query = "//*[contains(concat(' ', normalize-space(@class), ' '), ' " . substr($selector, 1) . " ')]";
            if (strpos($selector, '#') === 0) $query = "//*[@id='" . substr($selector, 1) . "']";

            $nodes = $xpath->query($query);
            foreach ($nodes as $node) {
                if ($node instanceof DOMElement) {
                    $current = $node->getAttribute('class');
                    $merged = array_unique(array_filter(array_merge(explode(' ', $current), $classList)));
                    $node->setAttribute('class', implode(' ', $merged));
                }
            }
        }
    }

    public function renderHead() {
        $tags = [];
        $appearance = $this->appearance ?? [];
        $currentThemeName = $appearance['defaultTheme'] ?? null;
        $themeList = $appearance['themeList'] ?? [];

        if (isset($this->attributes['csp'])) {
            $tags[] = '<meta http-equiv="Content-Security-Policy" content="'.htmlspecialchars($this->attributes['csp']).'">';
        }

        if (isset($this->config['csrf-token'])) {
            $tags[] = '<meta name="csrf-token" content="'.htmlspecialchars($this->config['csrf-token']).'">';
        }
        if (isset($this->config['canonical'])) {
            $tags[] = '<link rel="canonical" href="'.htmlspecialchars($this->config['canonical']).'">';
        }

        if (isset($this->config['metadatas']) && is_array($this->config['metadatas'])) {
            foreach ($this->config['metadatas'] as $key => $meta) {
                $content = htmlspecialchars($meta['content'] ?? '');
                $names = isset($meta['name']) ? (array)$meta['name'] : [$key];
                $props = isset($meta['property']) ? (array)$meta['property'] : [];

                foreach ($names as $n) {
                    if ($n === 'title') $tags[] = "<title>$content</title>";
                    else $tags[] = "<meta name=\"".htmlspecialchars($n)."\" content=\"$content\">";
                }
                foreach ($props as $p) $tags[] = "<meta property=\"".htmlspecialchars($p)."\" content=\"$content\">";
            }
        }

        $viewport = $themeList[$currentThemeName]['viewport'] ?? ($appearance['viewport'] ?? null);
        if ($viewport) $tags[] = '<meta name="viewport" content="'.htmlspecialchars($viewport).'">';

        $color = $themeList[$currentThemeName]['browserColor'] ?? ($appearance['browserColor'] ?? null);
        if ($color) $tags[] = '<meta name="theme-color" content="'.htmlspecialchars($color).'">';

        if (isset($appearance['assets'])) {
            foreach ($appearance['assets'] as $asset) $tags[] = $this->buildLinkTag($asset);
        }
        foreach ($themeList as $name => $data) {
            $isActive = ($name === $currentThemeName);
            foreach ($data['assets'] ?? [] as $asset) {
                $assetCopy = $asset;
                if (($assetCopy['rel'] ?? '') === 'stylesheet') {
                    $assetCopy['title'] = $name;
                    if (!$isActive) $assetCopy['rel'] = 'alternate stylesheet';
                }
                $tags[] = $this->buildLinkTag($assetCopy, $isActive);
            }
        }

        return implode("\n\t", $tags);
    }

    private function buildLinkTag($asset, $isActive = true) {
        $rel = htmlspecialchars($asset['rel'] ?? 'stylesheet');
        $href = htmlspecialchars($asset['href'] ?? '');
        $attrs = "";
        foreach ($asset as $k => $v) {
            if (!in_array($k, ['rel', 'href'])) $attrs .= ' ' . htmlspecialchars($k) . '="' . htmlspecialchars($v) . '"';
        }
        $disabled = (!$isActive && strpos($rel, 'alternate') !== false) ? ' disabled' : '';
        return "<link rel=\"$rel\" href=\"$href\"$attrs$disabled>";
    }

    public function getHtmlAttributes() {
        $out = "";
        foreach ($this->attributes as $k => $v) {
            if ($k !== 'csp') $out .= " $k=\"".htmlspecialchars($v)."\"";
        }
        return trim($out);
    }
}
