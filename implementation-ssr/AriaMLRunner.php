<?php

class AriaMLRunner {
	
	static public $autoUpdate = false;
	static protected $isLoaded = false;	
	static protected $files = [
		'https://flavi1.github.io/aria-ml/implementation-ssr/AriaML.php' => __DIR__ . '/AriaML.php',
		'https://flavi1.github.io/aria-ml/implementation-ssr/AriaMLDocument.php' => __DIR__ . '/AriaMLDocument.php'
	];
	
	static function update() {

		foreach(self::$files as $remote_url => $local_path) {
			$ctx = stream_context_create(['http' => ['timeout' => 10]]);
			$remote_content = @file_get_contents($remote_url, false, $ctx);
			
			if ($remote_content !== false && !empty($remote_content)) {
				file_put_contents($local_path, $remote_content);
			}
		}

	}
	
	static function load() {
		if(self::$isLoaded) return;
		if(self::$autoUpdate) self::update();
		
		foreach(self::$files as $local_path) {
			require_once $local_path;
		}
		self::$isLoaded = true;
	}
	
}
