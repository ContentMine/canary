
//import * as xml2js from 'xml2js';

/* var availableProcesses = ['species','gene','sequence']; // only needed if running AMI processes, as is regexdir below
var regexdir = function(regex) { // needed by ami
	return userdir + '/dev/contentmine/src/ami-regexes/' + regex + '.xml';
};
var setarticledir = function(dailyset,url) { // needed for AMI
	return setdir(dailyset) + uid(url) + '/';
};*/


// =====================================================================================
// THE FUNCTIONS BELOW HERE ARE OLD ONES THAT CAN RUN AMI AND TRAVERSE
// AMI CPROJECT OUTPUT DIRECTORIES FOR RESULTS FILES THAT IT THEN
// TRANSLATES AND FORMATS AS BIBJSON
var process = function(params) {
	console.log('beginning process ' + params.processor);
	for ( var u in params.urls ) {
		var url = params.urls[u];
		if ( url.processed.indexOf(params.processor) == -1 || params.rerun) {
			if ( url.processed.indexOf(params.processor) == -1 ) {
					url.processed.push(params.processor);
			}
			var sd = setarticledir(params.canarysetid,url);
			var proc = params.processor;
			var regex = false;
			if ( params.processor.startsWith('regex-') ) {
				var parts = proc.split('-');
				proc = parts[0];
				regex = parts[1];
			}
			if ( proc == 'rrid' ) {
				var cmd = '/usr/bin/ami2-identifier' + ' -q ' + sd + ' --input scholarly.html';
			} else {
				var cmd = '/usr/bin/ami2-' + proc + ' -q ' + sd + ' --input scholarly.html';
			}
			if ( regex ) {
				cmd += ' -r.r ' + regexdir(regex);
			}
			if ( proc == 'species' ) {
				cmd += ' --sp.species --context 100 100 --sp.type binomial genus genussp';
			}
			if ( proc == 'gene' ) {
				cmd += ' --g.gene --context 100 100 --g.type human';
			}
			if ( proc == 'identifier' ) {
				cmd += ' --id.identifier --context 100 100 --id.regex ' + regexdir('identifiers');
			}
			if ( proc == 'rrid' ) {
				cmd += ' --id.identifier --context 100 100 --id.regex ' + regexdir('identifiers') + ' --id.type rrid.ab';
			}
			if ( proc == 'sequence' ) {
				cmd += ' --sq.sequence --context 100 100 --sq.type dna';
			}
			var child = aexec(cmd);
			var sds = sd + 'results/' + params.processor.replace('-','/') + '/';
		}
	}
	console.log('process ' + params.processor + ' finished');
}

var readFacts = function(sd) {
	var facts = [];
	var files = walk(sd);
	console.log('retrieved filelist for ' + sd);
	//console.log(JSON.stringify(files,undefined,2));
	for ( var fl in files ) {
		if ( files[fl].endsWith('results.xml') ) {
			console.log('doing file ' + files[fl]);
			var fcts = atranslate(files[fl]);
			for ( var i in fcts ) {
				fcts[i].processor = files[fl].replace(sd + 'results/','').split('/')[0];
				facts.push(fcts[i]);
			}
		}
	}
	return facts;
};


var walk = function(dir, filelist) {
	if( dir[dir.length-1] != '/') dir=dir.concat('/');
	var files = fs.readdirSync(dir);
	filelist = filelist || [];
	files.forEach(function(file) {
		if (fs.statSync(dir + file).isDirectory()) {
			filelist = walk(dir + file + '/', filelist);
		} else {
			filelist.push(dir+file);
		}
	});
	return filelist;
};

var translate = function(fn, callback) {
	console.log('translating ' + fn);
	var parser = new xml2js.Parser();
	fs.readFile(fn, function(err, data) {
		parser.parseString(data, function (err, result) {
			console.log('parsing results file');
			//console.log(JSON.stringify(result,undefined,2));
			var res = [];
			var results = result.results.result;
			if ( results === undefined ) { results = []; }
			for ( var r in results ) {
				var rs = results[r]['$'];
				if ( rs !== undefined ) {
					if ( !('fact' in rs) ) {
						if ( 'match' in rs ) {
							rs.fact = rs.match;
						} else if ( 'exact' in rs ) {
							rs.fact = rs.exact;
						} else if ( 'value0' in rs ) {
							rs.fact = rs.value0;
						} else {
							rs.fact = '';
						}
					}
					res.push(rs);
				}
			}
			//console.log(JSON.stringify(res,undefined,2));
			return callback(null,res);
		});
	});
};
var atranslate = Async.wrap(translate);
