
// =====================================================================================
// THE OLD FUNCTION TO RUN NORMA TO NORMALISE RETRIEVED CONTENT
var normalise = function(folder) {
	console.log('about to normalise ' + folder);
	var sd = folder; // TODO once normalise is called again, need to decide how actually to point it at a folder
	var input = 'fulltext.xml';
	// TODO: if there is no fulltext.xml in the directory, look for a fulltext.html or fulltext.pdf
	// if there is a pdf set the xsl as pdf2html and set the input to the pdf filename
	// if there is an html file don't use the xsl, but set --html jsoup and the filename is the html filename
	// eventually the html output of jsoup - which is actually giving xhtml - should be passed through a stylesheet to shtml
	// if no html or pdf, but there is an xml that is not called fulltext.xml, set the input as that instead
	var xsl = 'nlm2html';
	if ( url.indexOf('biomedcentral') !== -1 ) xsl = 'bmc2html';  
	// or xsl could also be bmc2html or hind2xml
	// defined in /home/cloo/dev/contentmine/src/norma/src/main/resources/org/xmlcml/norma/pubstyle
	var cmd = 'norma --xsl ' + xsl + ' -q ' + sd;
	cmd += ' --input ' + input + ' --output scholarly.html';
	var child = aexec(cmd);
	console.log('norma finished');
	if ( !fs.existsSync(sd + 'scholarly.html') ) {
		console.log('norma did not succeed');
		return false;
	} else {
		return true;
	}
}

