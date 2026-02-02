<?php


class AriaMLDocument {

	static protected $isLoaded = false;	

	protected $volatileClasses = [];
	protected $styles = [];
	protected $themeList = [];
	protected $callback = null;

	public static $autoUpdate = true;
	
	public $JSON_TOKENS = JSON_UNESCAPED_SLASHES;
	public $cleanCSSIds = true;
	public $browserColor = null;
	public $viewport = 'width=device-width, initial-scale=1';
	public $defaultTheme = null;

	
	static function load() {
		if(self::$isLoaded)
			return;
		
		$local_path = __DIR__ . '/AriaML.php';
		
		if(self::$autoUpdate) {
			$remote_url = 'https://flavi1.github.io/aria-ml/implementation-ssr/AriaML.php';

			// Téléchargement synchrone immédiat
			$ctx = stream_context_create(['http' => ['timeout' => 10]]);
			$remote_content = @file_get_contents($remote_url, false, $ctx);
			
			if ($remote_content !== false && !empty($remote_content)) {
				file_put_contents($local_path, $remote_content);
			}
		}
		require_once $local_path;
		self::$isLoaded = true;
	}
	
	function __construct() {
		if(!self::$isLoaded)
			self::load();
		$this->callback = AriaML::handle();
	}
	
    function extractInlineStyles($head_html) {
        if (empty($head_html)) return [];
        $styles = [];

        preg_match_all('/<style[^>]*?>.*?<\/style>/is', $head_html, $matches);
        if (!empty($matches[0])) {
            foreach ($matches[0] as $style_block) {
                $styles[] = $style_block;
            }
        }
        return $styles;
    }
    
    function extractScripts($head_html) {
        if (empty($head_html)) return [];
        $scripts = [];

        preg_match_all('/<script[^>]*?>.*?<\/script>/is', $head_html, $matches);
        if (!empty($matches[0])) {
            foreach ($matches[0] as $script_block) {
                $scripts[] = $script_block;
            }
        }
        return $scripts;
    }
	
	function formatMeta($text) {
		if ( is_null( $text ) )
			return '';
		$text = html_entity_decode($text, ENT_QUOTES, 'UTF-8');
		$text = preg_replace( '@<(script|style)[^>]*?>.*?</\\1>@si', '', $text );
		$text = strip_tags( $text );
		return trim( $text );
	}

	function outputAppearence() {
		$appearance = [];

		// On n'ajoute que si non vide
		if (!empty($this->styles)) $appearance['assets'] = $this->styles;
		if (!empty($this->volatileClasses)) $appearance['volatileClasses'] = $this->volatileClasses;
		if (!empty($this->themeList)) $appearance['themeList'] = $this->themeList;
		if (!empty($this->browserColor)) $appearance['browserColor'] = $this->browserColor;
		if (!empty($this->viewport)) $appearance['viewport'] = $this->viewport;
		if (!empty($this->defaultTheme)) $appearance['defaultTheme'] = $this->defaultTheme;
		
		return json_encode($appearance, $this->JSON_TOKENS);
	}
	
	function addVolatileClasses($selector, $classes, $theme = null) {
		if ($theme) {
			$this->themeList[$theme]['volatileClasses'][$selector] = $classes;
		} else {
			$this->volatileClasses[$selector] = $classes;
		}
	}
	
	function addCSS($asset, $theme = null) {
		if ($theme) {
			if(!isset($this->themeList[$theme]))
				$this->themeList[$theme] = ['assets' => []];
			$this->themeList[$theme]['assets'][] = $asset;
		} else {
			$this->styles[] = $asset;
		}
	}
	
/**
	 * Ajoute ou met à jour un thème complet dans la liste des thèmes.
	 * * @param string $name Nom du thème (ex: "ThemeSombre")
	 * @param array $config Configuration (media, browserColor, viewport, volatileClasses, assets)
	 */
	function addTheme($name, $config = []) {
		if (!isset($this->themeList[$name])) {
			$this->themeList[$name] = [
				"assets" => []
			];
		}

		// 1. Propriétés directes
		if (isset($config['media'])) $this->themeList[$name]['media'] = $config['media'];
		if (isset($config['browserColor'])) $this->themeList[$name]['browserColor'] = $config['browserColor'];
		if (isset($config['viewport'])) $this->themeList[$name]['viewport'] = $config['viewport'];

		// 2. Gestion des Volatile Classes spécifiques au thème
		if (isset($config['volatileClasses'])) {
			if (!isset($this->themeList[$name]['volatileClasses'])) {
				$this->themeList[$name]['volatileClasses'] = [];
			}
			foreach ($config['volatileClasses'] as $selector => $classes) {
				$this->addVolatileClasses($selector, $classes, $name);
			}
		}

		// 3. Gestion des Assets (CSS / Icons)
		if (isset($config['assets'])) {
			foreach ((array)$config['assets'] as $asset) {
				$this->addCSS($asset, $name);
			}
		}
	}
	
	/**
	 * Extrait les liens (CSS, Icons) d'un bloc HTML pour remplir les assets AriaML
	 * @param string $head_html Le HTML brut du head (ex: résultat de wp_head())
	 */
	function hydrateAssets($head_html) {
		if (empty($head_html)) return;

		preg_match_all('/<link\s+([^>]+)>/i', $head_html, $matches);

		foreach ($matches[1] as $attributes) {
			$asset = [];
			$targets = ['rel', 'href', 'sizes', 'type', 'media', 'title'];
			
			if(!$this->cleanCSSIds)
				$targets[] = 'id';
			
			foreach ($targets as $attr) {
				if (preg_match('/' . $attr . '=["\']([^"\']+)["\']/i', $attributes, $v)) {
					$asset[$attr] = $v[1];
				}
			}

			if (isset($asset['href']) && isset($asset['rel'])) {
				$rel = strtolower($asset['rel']);
				
				// 1. Filtrage : On ne garde que l'Apparence
				$isStyle = (strpos($rel, 'stylesheet') !== false);
				$isIcon = (strpos($rel, 'icon') !== false);
				if (!$isStyle && !$isIcon) continue;

				// 2. Détermination du destinataire (Global ou Thème spécifique)
				// Si un 'title' est présent, c'est un asset lié à un thème nommé
				$targetTheme = isset($asset['title']) ? $asset['title'] : null;

				// 3. Logique de Simplification (Uniquement pour styles persistants sans titre)
				$isAlternate = (strpos($rel, 'alternate') !== false);
				$hasSpecificMedia = (isset($asset['media']) && $asset['media'] !== 'all' && $asset['media'] !== 'screen');
				$hasExtraData = (isset($asset['id']) || isset($asset['type']) || isset($asset['sizes']));

				// On ne simplifie en string que si c'est un style persistant, standard, et sans thème
				if ($isStyle && !$isAlternate && !$hasSpecificMedia && !$hasExtraData && !$targetTheme) {
					$this->addCSS($asset['href']);
				} else {
					// On garde l'objet complet pour les icônes, les alternates ou les styles à media queries
					$this->addCSS($asset, $targetTheme);
				}
			}
		}
	}
	
	function outputPageProperties($data = [], $head_html = null) {
		
		// 1. Initialisation de base (Fallbacks de référence)
		$props = [
			"@context"   => "https://ariaml.com/ns#",
			"@type"      => "PageProperties",
			"metadatas"  => []
		];
		
		if(isset($data['canonical']))
			$props['canonical'] = $data['canonical'];
		if(isset($data['csrf-token']))
			$props['csrf-token'] = $data['csrf-token'];
		if(isset($data['title']))
			$props['metadatas']['title'] = [
					"content"  => $this->formatMeta( $data['title'] ),
					"name"     => ["title"]
				];
		if(isset($data['description']))
			$props['metadatas']['description'] = [
					"content"  => $this->formatMeta( $data['description'] ),
					"name"     => ["description"]
				];
		
		if($head_html)
			$this->hydrateProperties($props, $head_html);
		
		// Nettoyage final avant encodage
		foreach (['metadatas', 'alternates', 'links'] as $key) {
			if (empty($props[$key])) unset($props[$key]);
		}
		
		return json_encode([$props], $this->JSON_TOKENS);
	}
	
	function hydrateProperties(&$props, $head_html) {
		// --- PARTIE 1 : META TAGS (Logique existante conservée) ---
		$rawValues = [];
		$rawTypes = [];
		preg_match_all('/<meta\s+([^>]+)>/i', $head_html, $matches);

		foreach ($matches[1] as $attributes) {
			$has_name     = preg_match('/name=["\']([^"\']+)["\']/i', $attributes, $n);
			$has_property = preg_match('/property=["\']([^"\']+)["\']/i', $attributes, $p);
			$has_content  = preg_match('/content=["\']([^"\']+)["\']/i', $attributes, $c);
			if (!$has_content) continue;
			if ($has_name) { $rawValues[$n[1]] = $c[1]; $rawTypes[$n[1]] = 'name'; }
			if ($has_property) { $rawValues[$p[1]] = $c[1]; $rawTypes[$p[1]] = 'property'; }
		}

		foreach ($rawValues as $key => $content) {
			$parts = explode(':', $key);
			$root  = end($parts); 
			$type  = $rawTypes[$key];

			if (isset($props['metadatas'][$root])) {
				if (is_string($props['metadatas'][$root])) {
					$props['metadatas'][$root] = ['content' => $props['metadatas'][$root], 'name' => [], 'property' => []];
				}
				if ($props['metadatas'][$root]['content'] === $content) {
					if (!in_array($key, $props['metadatas'][$root][$type])) $props['metadatas'][$root][$type][] = $key;
				} else {
					$props['metadatas'][$root]['content'] = $content;
					if (!in_array($key, $props['metadatas'][$root][$type])) $props['metadatas'][$root][$type][] = $key;
				}
			} else {
				$props['metadatas'][$root] = ['content' => $content, 'name' => ($type === 'name' ? [$key] : []), 'property' => ($type === 'property' ? [$key] : [])];
			}
		}

		// --- PARTIE 2 : LINK TAGS (Alternates & Links) ---
		preg_match_all('/<link\s+([^>]+)>/i', $head_html, $linkMatches);
		
		$singletons = ['canonical', 'me', 'shortlink', 'manifest', 'author', 'license'];
		$appearanceRels = ['stylesheet', 'icon', 'apple-touch-icon', 'shortcut icon'];

		foreach ($linkMatches[1] as $attributes) {
			$asset = [];
			$targets = ['rel', 'href', 'type', 'title', 'hreflang'];
			foreach ($targets as $attr) {
				if (preg_match('/' . $attr . '=["\']([^"\']+)["\']/i', $attributes, $v)) $asset[$attr] = $v[1];
			}

			if (!isset($asset['rel']) || !isset($asset['href'])) continue;

			$rel = strtolower($asset['rel']);

			// Exclusion de l'apparence
			if (in_array($rel, $appearanceRels)) continue;

			// Cas A : Les Alternates
			if (strpos($rel, 'alternate') !== false) {
				// On nettoie le rel pour ne garder que ce qui n'est pas "alternate"
				$cleanRel = trim(str_replace('alternate', '', $rel));
				
				if (empty($cleanRel)) {
					unset($asset['rel']); // Suppression totale si c'était juste "alternate"
				} else {
					$asset['rel'] = $cleanRel; // On garde le reste (ex: "author" pour "alternate author")
				}
				$props['alternates'][] = $asset;
			} 
			// Cas B : Les autres liens (hors singletons)
			else if (!in_array($rel, $singletons)) {
				$props['links'][] = $asset;
			}
		}

		// --- PARTIE 3 : NETTOYAGE ET SIMPLIFICATION ---
		foreach ($props['metadatas'] as $key => $data) {
			if (is_string($data)) {
				$props['metadatas'][$key] = $this->formatMeta($data);
				continue;
			}
			$data = array_filter($data, function($v) { return !is_array($v) || !empty($v); });
			$data['content'] = $this->formatMeta($data['content']);
			$hasName = isset($data['name']);
			$hasProp = isset($data['property']);
			$isRedundantName = ($hasName && count($data['name']) === 1 && $data['name'][0] === $key);
			
			$props['metadatas'][$key] = (!$hasProp && (!$hasName || $isRedundantName)) ? $data['content'] : $data;
		}
	}
	
    function renderAttributes($attrs) {
        if (empty($attrs) || !is_array($attrs)) return '';
        
        $html = '';
        foreach ($attrs as $key => $value) {
            // Sécurité : on ignore les clés bizarres et on échappe les valeurs
            $clean_key = preg_replace('/[^a-zA-Z0-9-]/', '', $key);
            $clean_val = htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
            $html .= " {$clean_key}=\"{$clean_val}\"";
        }
        echo $html;
    }
	
	function end() {
		$cb = $this->callback;
		$cb();
	}
	
}
