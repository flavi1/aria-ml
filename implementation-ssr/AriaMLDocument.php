<?php

class AriaMLDocument {

    protected $volatileClasses = [];
    protected $styles = [];
    protected $themeList = [];
    protected $callback = null;
    
    public $JSON_TOKENS = JSON_UNESCAPED_SLASHES;
    public $cleanCSSIds = true;
    public $browserColor = null;
    public $viewport = 'width=device-width, initial-scale=1';
    public $defaultTheme = null;
    
    function __construct() {
        $this->callback = AriaML::handle();
    }
    
    function extractInlineStyles($head_html) {
        if (empty($head_html)) return [];
        preg_match_all('/<style[^>]*?>.*?<\/style>/is', $head_html, $matches);
        return !empty($matches[0]) ? $matches[0] : [];
    }
    
    function extractScripts($head_html) {
        if (empty($head_html)) return [];
        preg_match_all('/<script[^>]*?>.*?<\/script>/is', $head_html, $matches);
        return !empty($matches[0]) ? $matches[0] : [];
    }
    
    function formatMeta($text) {
        if (is_null($text)) return '';
        $text = html_entity_decode($text, ENT_QUOTES, 'UTF-8');
        $text = preg_replace('@<(script|style)[^>]*?>.*?</\\1>@si', '', $text);
        $text = strip_tags($text);
        return trim($text);
    }

    function outputAppearence() {
        $appearance = [];
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
            if(!isset($this->themeList[$theme])) $this->themeList[$theme] = ['assets' => []];
            $this->themeList[$theme]['assets'][] = $asset;
        } else {
            $this->styles[] = $asset;
        }
    }

    function addTheme($name, $config = []) {
        if (!isset($this->themeList[$name])) $this->themeList[$name] = ["assets" => []];
        if (isset($config['media'])) $this->themeList[$name]['media'] = $config['media'];
        if (isset($config['browserColor'])) $this->themeList[$name]['browserColor'] = $config['browserColor'];
        if (isset($config['viewport'])) $this->themeList[$name]['viewport'] = $config['viewport'];

        if (isset($config['volatileClasses'])) {
            foreach ($config['volatileClasses'] as $selector => $classes) {
                $this->addVolatileClasses($selector, $classes, $name);
            }
        }
        if (isset($config['assets'])) {
            foreach ((array)$config['assets'] as $asset) {
                $this->addCSS($asset, $name);
            }
        }
    }
    
    function hydrateAssets($head_html) {
        if (empty($head_html)) return;
        preg_match_all('/<link\s+([^>]+)>/i', $head_html, $matches);

        foreach ($matches[1] as $attributes) {
            $asset = [];
            $targets = ['rel', 'href', 'sizes', 'type', 'media', 'title'];
            if(!$this->cleanCSSIds) $targets[] = 'id';
            
            foreach ($targets as $attr) {
                if (preg_match('/' . $attr . '=["\']([^"\']+)["\']/i', $attributes, $v)) $asset[$attr] = $v[1];
            }

            if (isset($asset['href']) && isset($asset['rel'])) {
                $rel = strtolower($asset['rel']);
                $isStyle = (strpos($rel, 'stylesheet') !== false);
                $isIcon = (strpos($rel, 'icon') !== false);
                if (!$isStyle && !$isIcon) continue;

                $targetTheme = isset($asset['title']) ? $asset['title'] : null;
                $isAlternate = (strpos($rel, 'alternate') !== false);
                $hasSpecificMedia = (isset($asset['media']) && $asset['media'] !== 'all' && $asset['media'] !== 'screen');
                $hasExtraData = (isset($asset['id']) || isset($asset['type']) || isset($asset['sizes']));

                if ($isStyle && !$isAlternate && !$hasSpecificMedia && !$hasExtraData && !$targetTheme) {
                    $this->addCSS($asset['href']);
                } else {
                    $this->addCSS($asset, $targetTheme);
                }
            }
        }
    }
    
    function outputPageProperties($data = [], $head_html = null) {
        $props = [
            "@context"   => "https://ariaml.com/ns/PageProperties/",
            "@type"      => ["PageProperties", "WebPage"],
            "metadatas"  => []
        ];
        
        // --- 1. Bridge SEO ---
        if(isset($data['title'])) $props['name'] = $this->formatMeta($data['title']);
        if(isset($data['description'])) $props['description'] = $this->formatMeta($data['description']);
        if(isset($data['url'])) $props['url'] = $data['url'];
        if(isset($data['csrf-token'])) $props['csrf-token'] = $data['csrf-token'];
        if(isset($data['last-modified'])) $props['last-modified'] = $data['last-modified'];
        if(isset($data['lang'])) $props['lang'] = $data['lang'];
        if(isset($data['dir'])) $props['dir'] = $data['dir'];

        // Hydratation (metas, links, alternates, translations)
        if($head_html) $this->hydrateProperties($props, $head_html);
        
        // --- 2. Post-Traitement Canonical & ID ---
        // Si url n'est pas fourni dans $data mais trouvé dans le head via hydrateProperties
        if(!isset($props['url']) && isset($data['canonical'])) $props['url'] = $data['canonical'];
        
        // Attribution de l'ID pour le graphe Google
        if(isset($props['url'])) $props['id'] = $props['url'] . "#webpage";

        // Nettoyage final
        foreach (['metadatas', 'alternates', 'links', 'translations'] as $key) {
			if(!empty($data[$key])) $props[$key] = array_merge($props[$key], $data[$key]);
            if (empty($props[$key])) unset($props[$key]);
        }
        
        return json_encode([$props], $this->JSON_TOKENS);
    }
    
    function hydrateProperties(&$props, $head_html) {
        // --- PARTIE 1 : META TAGS ---
        $rawValues = [];
        $rawTypes = [];
        preg_match_all('/<meta\s+([^>]+)>/i', $head_html, $matches);

        foreach ($matches[1] as $attributes) {
            $has_name     = preg_match('/name=["\']([^"\']+)["\']/i', $attributes, $n);
            $has_property = preg_match('/property=["\']([^"\']+)["\']/i', $attributes, $p);
            $has_content  = preg_match('/content=["\']([^"\']+)["\']/i', $attributes, $c);
            if (!$has_content) continue;
            
            $val = $c[1];
            if ($has_name) { 
                if ($n[1] === 'description' && !isset($props['description'])) $props['description'] = $val;
                if ($n[1] === 'last-modified' && !isset($props['last-modified'])) $props['last-modified'] = $val;
                $rawValues[$n[1]] = $val; $rawTypes[$n[1]] = 'name'; 
            }
            if ($has_property) { $rawValues[$p[1]] = $val; $rawTypes[$p[1]] = 'property'; }
        }

        foreach ($rawValues as $key => $content) {
            if ($key === 'title' || $key === 'description') continue;
            $parts = explode(':', $key);
            $root  = end($parts); 
            $type  = $rawTypes[$key];

            if (isset($props['metadatas'][$root])) {
                if (is_string($props['metadatas'][$root])) {
                    $props['metadatas'][$root] = ['content' => $props['metadatas'][$root], 'name' => [], 'property' => []];
                }
                $props['metadatas'][$root]['content'] = $content;
                if (!in_array($key, $props['metadatas'][$root][$type])) $props['metadatas'][$root][$type][] = $key;
            } else {
                $props['metadatas'][$root] = ['content' => $content, 'name' => ($type === 'name' ? [$key] : []), 'property' => ($type === 'property' ? [$key] : [])];
            }
        }

        // --- PARTIE 2 : LINK TAGS ---
        preg_match_all('/<link\s+([^>]+)>/i', $head_html, $linkMatches);
        
        $singletons = ['me', 'shortlink', 'manifest', 'author', 'license'];
        $appearanceRels = ['stylesheet', 'icon', 'apple-touch-icon', 'shortcut icon'];

        foreach ($linkMatches[1] as $attributes) {
            $asset = [];
            $targets = ['rel', 'href', 'type', 'title', 'hreflang'];
            foreach ($targets as $attr) {
                if (preg_match('/' . $attr . '=["\']([^"\']+)["\']/i', $attributes, $v)) $asset[$attr] = $v[1];
            }

            if (!isset($asset['rel']) || !isset($asset['href'])) continue;
            $rel = strtolower($asset['rel']);

            // Extraction du canonical si absent des propriétés racines
            if ($rel === 'canonical' && !isset($props['url'])) {
                $props['url'] = $asset['href'];
                continue; 
            }

            if (in_array($rel, $appearanceRels)) continue;

            if (isset($asset['hreflang'])) {
                $props['translations'][] = $asset;
            }
            else if (strpos($rel, 'alternate') !== false) {
                $cleanRel = trim(str_replace('alternate', '', $rel));
                if (empty($cleanRel)) unset($asset['rel']); else $asset['rel'] = $cleanRel;
                $props['alternates'][] = $asset;
            } 
            else if (!in_array($rel, $singletons) && $rel !== 'canonical') {
                $props['links'][] = $asset;
            }
        }

        // --- PARTIE 3 : NETTOYAGE METADATAS ---
        foreach ($props['metadatas'] as $key => $data) {
            if (is_string($data)) { $props['metadatas'][$key] = $this->formatMeta($data); continue; }
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
