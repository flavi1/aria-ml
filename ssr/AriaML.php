<?php

class AriaML {
    private $dom;
    private $ariaNode;
    private $config = null;      // PageProperties (JSON-LD)
    private $appearance = null;  // Appearance Config
    private $attributes = [];
    private $debugErrors = [];

    public function __construct($htmlContent) {
        $this->dom = new DOMDocument();
        libxml_use_internal_errors(true);
        $this->dom->loadHTML('<?xml encoding="utf-8" ?>' . $htmlContent, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
        libxml_clear_errors();

        $this->ariaNode = $this->dom->getElementsByTagName('aria-ml')->item(0);
        $this->parseAriaNode();
    }

    /**
     * Méthode statique pour gérer le buffer et la négociation de contenu
     */
    public static function handle($testClient = true) {
        $acceptHeader = $_SERVER['HTTP_ACCEPT'] ?? '';
        $wantsAriaML = ($testClient or (strpos($acceptHeader, 'text/aria-ml') !== false));
        
        ob_start();
        return function() use ($wantsAriaML, $testClient) {
            $document = ob_get_clean();
            $styles = '
<style>
:not(aria-ml) > [slot] { display: none !important; }
html, body { margin: 0; padding: 0; height: 100%; }
aria-ml { display: block; min-height: 100%; padding: 8px; box-sizing: border-box; }
</style>';
			$jsBase = 'https://flavi1.github.io/aria-ml/js/aria-ml/';
            $scripts = '
<script src="'.$jsBase.'/RootNode.js"></script>
<script src="'.$jsBase.'/PageProperties.js"></script>
<script src="'.$jsBase.'/ThemeManager.js"></script>
<script src="'.$jsBase.'/AppearanceManager.js"></script>
<script src="'.$jsBase.'/Navigation.js"></script>
<script src="'.$jsBase.'/Model.js"></script>
<script src="'.$jsBase.'/Form.js"></script>';

            if ($wantsAriaML) {
                header('Content-Type: ' . ($testClient ? 'text/html' : 'text/aria-ml') . '; charset=utf-8');
                echo ($testClient ? "<!-- TEST CLIENT ARIAML IMPLEMENTATION -->\n".$styles : "") . $document . ($testClient ? $scripts : "");
                exit;
            }

            $aria = new self($document);
?>
<!DOCTYPE html>
<html <?php echo $aria->getHtmlAttributes(); ?>>
<head data-ssr>
    <meta charset="UTF-8">
    <?php echo $styles; ?>
    <?php echo $aria->renderHead(); ?>
</head>
<body>
    <?php echo $document; ?>
	<?php echo $scripts; ?>
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

            if ($type === 'application/ld+json') {
                $decoded = json_decode($content, true);
                $this->config = isset($decoded[0]) ? $decoded[0] : $decoded;
            }
            
            if ($type === 'application/appearance+json') {
                $this->appearance = json_decode($content, true);
            }
        }
    }

    public function renderHead() {
        $tags = [];
        $appearance = $this->appearance ?? [];
        $currentThemeName = $appearance['defaultTheme'] ?? null;
        $themeList = $appearance['themeList'] ?? [];

        // 1. CSP
        if (isset($this->attributes['csp'])) {
            $tags[] = '<meta http-equiv="Content-Security-Policy" content="'.htmlspecialchars($this->attributes['csp']).'">';
        }

        // 2. Metadatas
        if (isset($this->config['metadatas'])) {
            foreach ($this->config['metadatas'] as $meta) {
                $content = htmlspecialchars($meta['content'] ?? '');
                if (($meta['name'] ?? '') === 'title') $tags[] = "<title>$content</title>";
                foreach ((array)($meta['name'] ?? []) as $n) if($n !== 'title') $tags[] = "<meta name=\"$n\" content=\"$content\">";
                foreach ((array)($meta['property'] ?? []) as $p) $tags[] = "<meta property=\"$p\" content=\"$content\">";
            }
        }

        // 3. Viewport & Theme Color
        $viewport = $themeList[$currentThemeName]['viewport'] ?? ($appearance['defaultViewport'] ?? null);
        if ($viewport) $tags[] = '<meta name="viewport" content="'.htmlspecialchars($viewport).'">';

        $color = $themeList[$currentThemeName]['browserColor'] ?? ($appearance['defaultBrowserColor'] ?? null);
        if ($color) $tags[] = '<meta name="theme-color" content="'.htmlspecialchars($color).'">';

        // 4. Assets Persistants
        if (isset($appearance['assets'])) {
            foreach ($appearance['assets'] as $asset) $tags[] = $this->buildLinkTag($asset);
        }

        // 5. Assets de Thèmes (Actifs et Alternatifs)
        foreach ($themeList as $name => $data) {
            $isActive = ($name === $currentThemeName);
            foreach ($data['assets'] ?? [] as $asset) {
                $assetCopy = $asset;
                
                if (($assetCopy['rel'] ?? '') === 'stylesheet') {
                    // Crucial : ajouter le titre pour permettre le switch via AppearanceManager
                    $assetCopy['title'] = $name;
                    if (!$isActive) {
                        $assetCopy['rel'] = 'alternate stylesheet';
                    }
                }
                $tags[] = $this->buildLinkTag($assetCopy);
            }
        }

        return implode("\n    ", $tags);
    }

    private function buildLinkTag($asset) {
        $rel = htmlspecialchars($asset['rel'] ?? 'stylesheet');
        $href = htmlspecialchars($asset['href'] ?? '');
        $attrs = "";
        foreach ($asset as $k => $v) {
            if (!in_array($k, ['rel', 'href'])) {
                $attrs .= ' ' . htmlspecialchars($k) . '="' . htmlspecialchars($v) . '"';
            }
        }
        // Si c'est un alternate stylesheet, on s'assure qu'il soit désactivé nativement par le navigateur au chargement
        $disabled = (strpos($rel, 'alternate') !== false) ? ' disabled="disabled"' : '';
        
        return "<link rel=\"$rel\" href=\"$href\"$attrs$disabled>";
    }

    public function getHtmlAttributes() {
        $out = "";
        foreach ($this->attributes as $k => $v) if ($k !== 'csp') $out .= " $k=\"".htmlspecialchars($v)."\"";
        return trim($out);
    }
}
