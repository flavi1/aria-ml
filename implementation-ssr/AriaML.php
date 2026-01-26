<?php

/**
 * AriaML.php - Moteur de rendu SSR et Négociation de contenu pour AriaML Engine v1.4.
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
			// Conversion propre en entités numériques (alternative moderne à HTML-ENTITIES)
			$content = mb_encode_numericentity($htmlContent, [0x80, 0x10FFFF, 0, 0x1FFFFF], 'UTF-8');
			$this->dom->loadHTML($content, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
		}
		
		libxml_clear_errors();

		$this->ariaNode = $this->dom->getElementsByTagName('aria-ml')->item(0) 
					   ?? $this->dom->getElementsByTagName('aria-ml-fragment')->item(0);

		$this->parseAriaNode();
	}

    /**
     * Orchestrateur principal : gère le buffer PHP et la réponse au client.
     */
    public static function handle($testClient = false) {
        $acceptHeader = $_SERVER['HTTP_ACCEPT'] ?? '';
        $cacheHeader = $_SERVER['HTTP_LIVE_CACHE'] ?? '[]';
        
        // Négociation de contenu
        $wantsFragment = (strpos($acceptHeader, 'aria-ml-fragment') !== false);
        $wantsAriaML = ($testClient || $wantsFragment || strpos($acceptHeader, 'text/aria-ml') !== false);
        
        $knownKeys = json_decode($cacheHeader, true) ?? [];

        ob_start();
        return function() use ($wantsAriaML, $wantsFragment, $testClient, $knownKeys) {
            $buffer = trim(ob_get_clean());
            $script = '<script src="[https://flavi1.github.io/aria-ml/src/standalone.js](https://flavi1.github.io/aria-ml/src/standalone.js)"></script>';
            
            if ($wantsAriaML) {
                $worker = new DOMDocument();
                libxml_use_internal_errors(true);
                $worker->loadHTML('<?xml encoding="utf-8" ?>' . $buffer, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
                
                // Reconstruction du wrapper si nécessaire
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

                // Optimisation NodeCache (Vider les éléments connus du client)
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

				// Nettoyage radical des résidus de déclaration XML
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

        // Récupération des attributs de racine (ex: csp, lang...)
        foreach ($this->ariaNode->attributes as $attr) {
            $this->attributes[$attr->nodeName] = $attr->nodeValue;
        }

        // Extraction des configurations JSON embarquées
        $scripts = $this->ariaNode->getElementsByTagName('script');
        foreach ($scripts as $script) {
            $type = $script->getAttribute('type');
            $content = trim($script->nodeValue);

            if ($type === 'application/ld+json' || $type === 'application/json') {
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

        // 2. CSRF & Canonical
        if (isset($this->config['csrf-token'])) {
            $tags[] = '<meta name="csrf-token" content="'.htmlspecialchars($this->config['csrf-token']).'">';
        }
        if (isset($this->config['canonical'])) {
            $tags[] = '<link rel="canonical" href="'.htmlspecialchars($this->config['canonical']).'">';
        }

        // 3. Metadatas
        if (isset($this->config['metadatas']) && is_array($this->config['metadatas'])) {
            foreach ($this->config['metadatas'] as $key => $meta) {
                $content = htmlspecialchars($meta['content'] ?? '');
                $names = isset($meta['name']) ? (array)$meta['name'] : [$key];
                $props = isset($meta['property']) ? (array)$meta['property'] : [];

                foreach ($names as $n) {
                    if ($n === 'title') {
                        $tags[] = "<title>$content</title>";
                    } else {
                        $tags[] = "<meta name=\"".htmlspecialchars($n)."\" content=\"$content\">";
                    }
                }
                foreach ($props as $p) {
                    $tags[] = "<meta property=\"".htmlspecialchars($p)."\" content=\"$content\">";
                }
            }
        }

        // 4. Viewport & Theme Color
        $viewport = $themeList[$currentThemeName]['viewport'] ?? ($appearance['defaultViewport'] ?? null);
        if ($viewport) $tags[] = '<meta name="viewport" content="'.htmlspecialchars($viewport).'">';

        $color = $themeList[$currentThemeName]['browserColor'] ?? ($appearance['defaultBrowserColor'] ?? null);
        if ($color) $tags[] = '<meta name="theme-color" content="'.htmlspecialchars($color).'">';

        // 5. Assets (Persistants & Thèmes)
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
