console.log('Hello ISOLATED JS')
alert('Hello ISOLATED JS')

if (document.documentElement && document.documentElement.tagName === "ARIA-ML") {
	console.info("AriaML supporté nativement.");
	document._convertedFromAriaML = false;
} else {
	const rawContent = document.body ? document.body.innerText : document.documentElement.textContent;
	
console.warn(rawContent)
	
	const isAria = (raw) => {
		for(begin of ['<!DOCTYPE aria-ml>', '<aria-ml>', '<aria-ml ', "<aria-ml\n" ])
			if(raw.indexOf(begin) === 0)
				return true;
	}

	if(isAria(rawContent.trim())) {

		const htmlContent = `
			<!DOCTYPE html>
			<html lang="fr">
			<head>
				<meta charset="UTF-8">
			</head>
			<body>
				${rawContent}
			</body>
			</html>
		`;

		document.open("text/html", "replace");
		document.write(htmlContent);
		document.close();
		document._convertedFromAriaML = true;
		console.info('Document converti du AriaML vers HTML par la web extension.')
	}
}
