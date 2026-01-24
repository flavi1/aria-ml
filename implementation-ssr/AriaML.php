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
    public static function handle($testClient = false) {
        $acceptHeader = $_SERVER['HTTP_ACCEPT'] ?? '';
        $wantsAriaML = ($testClient or (strpos($acceptHeader, 'text/aria-ml') !== false));
        
        ob_start();
        return function() use ($wantsAriaML, $testClient) {
            $document = ob_get_clean();
			
			$script = '<script src="https://flavi1.github.io/aria-ml/src/standalone.js"></script>';
			
            if ($wantsAriaML) {
                header('Content-Type: ' . ($testClient ? 'text/html' : 'text/aria-ml') . '; charset=utf-8');
                echo ($testClient ? "<!-- TEST CLIENT ARIAML IMPLEMENTATION -->\n" : '') . $document . ($testClient ? $script : '');
                exit;
            }

            $aria = new self($document);
?>
<!DOCTYPE html>
<html <?php echo $aria->getHtmlAttributes(); ?>>
<head data-ssr><meta charset="UTF-8">
    <?php echo "\n	".$aria->renderHead(); ?>
</head>
<body>
    <?php echo $document; ?>
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

        // 1. CSP (depuis l'attribut de aria-ml)
        if (isset($this->attributes['csp'])) {
            $tags[] = '<meta http-equiv="Content-Security-Policy" content="'.htmlspecialchars($this->attributes['csp']).'">';
        }

        // 2. CSRF Token
        if (isset($this->config['csrf-token'])) {
            $tags[] = '<meta name="csrf-token" content="'.htmlspecialchars($this->config['csrf-token']).'">';
        }

        // 3. Canonical
        if (isset($this->config['canonical'])) {
            $tags[] = '<link rel="canonical" href="'.htmlspecialchars($this->config['canonical']).'">';
        }

        // 4. Metadatas (Dictionnaire associatif)
        if (isset($this->config['metadatas']) && is_array($this->config['metadatas'])) {
            foreach ($this->config['metadatas'] as $key => $meta) {
                $content = htmlspecialchars($meta['content'] ?? '');
                
                // Détermination des noms (Inférence de la clé si absent)
                $names = isset($meta['name']) ? (array)$meta['name'] : [$key];
                $props = isset($meta['property']) ? (array)$meta['property'] : [];

                // Gestion du Titre
                if (in_array('title', $names)) {
                    $tags[] = "<title>$content</title>";
                }

                // Balises Meta Name
                foreach ($names as $n) {
                    if ($n !== 'title') { // Le titre est déjà géré par <title>
                        $tags[] = "<meta name=\"".htmlspecialchars($n)."\" content=\"$content\">";
                    }
                }

                // Balises Meta Property
                foreach ($props as $p) {
                    $tags[] = "<meta property=\"".htmlspecialchars($p)."\" content=\"$content\">";
                }
            }
        }

        // 5. Viewport & Theme Color (Arbirage SSR)
        $viewport = $themeList[$currentThemeName]['viewport'] ?? ($appearance['defaultViewport'] ?? null);
        if ($viewport) $tags[] = '<meta name="viewport" content="'.htmlspecialchars($viewport).'">';

        $color = $themeList[$currentThemeName]['browserColor'] ?? ($appearance['defaultBrowserColor'] ?? null);
        if ($color) $tags[] = '<meta name="theme-color" content="'.htmlspecialchars($color).'">';

        // 6. Assets Persistants
        if (isset($appearance['assets'])) {
            foreach ($appearance['assets'] as $asset) $tags[] = $this->buildLinkTag($asset);
        }

        // 7. Assets de Thèmes (Actifs et Alternatifs)
        foreach ($themeList as $name => $data) {
            $isActive = ($name === $currentThemeName);
            foreach ($data['assets'] ?? [] as $asset) {
                $assetCopy = $asset;
                if (($assetCopy['rel'] ?? '') === 'stylesheet') {
                    $assetCopy['title'] = $name;
                    if (!$isActive) {
                        $assetCopy['rel'] = 'alternate stylesheet';
                    }
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
            if (!in_array($k, ['rel', 'href'])) {
                $attrs .= ' ' . htmlspecialchars($k) . '="' . htmlspecialchars($v) . '"';
            }
        }
        
        // Ajout de l'attribut disabled pour les thèmes inactifs (SSR conforme au standard HTML)
        $disabled = (!$isActive && strpos($rel, 'alternate') !== false) ? ' disabled' : '';
        
        return "<link rel=\"$rel\" href=\"$href\"$attrs$disabled>";
    }

    public function getHtmlAttributes() {
        $out = "";
        foreach ($this->attributes as $k => $v) if ($k !== 'csp') $out .= " $k=\"".htmlspecialchars($v)."\"";
        return trim($out);
    }
}
