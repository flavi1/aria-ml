<?php


class AriaMLDocument {

	static protected $autoUpdate = true;
	static protected $isLoaded = false;	

	protected $volatileClasses = [];
	protected $styles = [];
	protected $themeList = [];
	protected $browserColor = null;
	protected $viewport = 'width=device-width, initial-scale=1';
	protected $defaultTheme = null;
	protected $callback = null;

	
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
		
		$appearance = [
			"assets" => $this->styles,
			"volatileClasses" => $this->volatileClasses,
			"themeList" => $this->themeList
		];
		
		if($this->browserColor)
			$appearance['browserColor'] = $this->browserColor;
		if($this->viewport)
			$appearance['viewport'] = $this->viewport;
		if($this->defaultTheme)
			$appearance['defaultTheme'] = $this->defaultTheme;
				
		return json_encode($appearance, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
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
			$this->themeList[$theme]['assets'][] = $asset;
		} else {
			$this->styles[] = $asset;
		}
	}
	
	/**
	 * Extrait les liens (CSS, Icons) d'un bloc HTML pour remplir les assets AriaML
	 * @param string $head_html Le HTML brut du head (ex: résultat de wp_head())
	 */
	function hydrateAssets($head_html) {
		if (empty($head_html)) return;

		// On cherche toutes les balises <link>
		preg_match_all('/<link\s+([^>]+)>/i', $head_html, $matches);

		foreach ($matches[1] as $attributes) {
			$asset = [];
			
			// Liste des attributs que l'on souhaite capturer pour AriaML
			$targets = ['id', 'rel', 'href', 'sizes', 'type', 'media'];
			
			foreach ($targets as $attr) {
				if (preg_match('/' . $attr . '=["\']([^"\']+)["\']/i', $attributes, $v)) {
					$asset[$attr] = $v[1];
				}
			}

			// On ne garde que si href et rel sont présents
			if (isset($asset['href']) && isset($asset['rel'])) {
				$this->addCSS($asset);
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
					"property" => ["og:title"],
					"name"     => ["title"]
				];
		if(isset($data['description']))
			$props['metadatas']['description'] = [
					"content"  => $this->formatMeta( $data['description'] ),
					"property" => ["og:description"],
					"name"     => ["description"]
				];
		
		if($head_html)
			$this->hydrateProperties($props, $head_html);
		
		return json_encode([$props], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
	}
	
	
	function hydrateProperties(&$props, $head_html) {
		$rawValues = [];
		$rawTypes  = [];
		preg_match_all('/<meta\s+([^>]+)>/i', $head_html, $matches);

		foreach ($matches[1] as $attributes) {
			$has_name     = preg_match('/name=["\']([^"\']+)["\']/i', $attributes, $n);
			$has_property = preg_match('/property=["\']([^"\']+)["\']/i', $attributes, $p);
			$has_content  = preg_match('/content=["\']([^"\']+)["\']/i', $attributes, $c);

			if (!$has_content) continue;
			
			if ($has_name) {
				$rawValues[$n[1]] = $c[1];
				$rawTypes[$n[1]]  = 'name';
			}
			if ($has_property) {
				$rawValues[$p[1]] = $c[1];
				$rawTypes[$p[1]]  = 'property';
			}
		}

		// 3. Résolution Agnostique des Suffixes
		foreach ($rawValues as $key => $content) {
			$parts = explode(':', $key);
			$root  = end($parts); 
			$type  = $rawTypes[$key];

			// Cas A : La racine existe déjà (ex: title ou description initialisés)
			if (isset($props['metadatas'][$root])) {
				// Si le contenu est identique, on ajoute juste le sélecteur technique s'il manque
				if ($props['metadatas'][$root]['content'] === $content) {
					if (!in_array($key, $props['metadatas'][$root][$type])) {
						$props['metadatas'][$root][$type][] = $key;
					}
				} 
				// Si le contenu est différent (ex: Yoast a écrasé le title), on met à jour la racine
				else {
					$props['metadatas'][$root]['content'] = $content;
					if (!in_array($key, $props['metadatas'][$root][$type])) {
						$props['metadatas'][$root][$type][] = $key;
					}
				}
			} 
			// Cas B : Nouvelle racine découverte (ex: image, keywords, robots)
			else {
				$props['metadatas'][$root] = [
					'content'  => $content,
					'name'     => ($type === 'name') ? [$key] : [],
					'property' => ($type === 'property') ? [$key] : []
				];
			}
		}

		// 4. Nettoyage final (suppression des tableaux de sélecteurs vides)
		foreach ($props['metadatas'] as $key => $data) {
			$props['metadatas'][$key] = array_filter($data, function($v) {
				return !is_array($v) || !empty($v);
			});
			$props['metadatas'][$key]['content'] = $this->formatMeta( $props['metadatas'][$key]['content'] );
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
