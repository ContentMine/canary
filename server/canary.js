
import * as fs from 'fs';
import exec from 'child_process';
import {XMLHttpRequest as xmhtrq} from 'xmlhttprequest';


// ========================================================================================
// CONFIGURE THE MAIN SETTINGS HERE
var runcron = true;
var indexurl = 'http://gateway:9200';
var userdir = '/home/cloo';
var dictsdir = userdir + '/dev/contentmine/src/dictionaries';
var scraperdir = userdir + '/dev/contentmine/src/journal-scrapers/scrapers/'; // needed by thresher / quickscrape

var setdir = function(canarysetid) { // needed by getpapers
	return userdir + '/cm/sets/' + canarysetid + '/';
};

/*var normalise = false;
var articledir = function(url) { // needed for norma
	return userdir + '/cm/articles/' + uid(url) + '/';
};*/

/* var availableProcesses = ['species','gene','sequence']; // only needed if running AMI processes, as is regexdir below
var regexdir = function(regex) { // needed by ami
	return userdir + '/dev/contentmine/src/ami-regexes/' + regex + '.xml';
};
var setarticledir = function(canarysetid,url) { // needed for AMI
	return setdir(canarysetid) + uid(url) + '/';
};*/




// ========================================================================================
// SOME SIMPLE CONVENIENCE FUNCTIONS
var uid = function(url) {
	return url.replace(/\/+/g, '_').replace(/:/g, '');
};

var uuid = function() {
	return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
		var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
		return v.toString(16);
	});
};

if (typeof String.prototype.endsWith !== 'function') {
	String.prototype.endsWith = function(suffix) {
		return this.indexOf(suffix, this.length - suffix.length) !== -1;
	};
}
if (typeof String.prototype.startsWith !== 'function') {
	String.prototype.startsWith = function(prefix) {
		return this.indexOf(prefix, 0, this.length - prefix.length) !== -1;
	};
}

var dated = function( delim, less ) {
	if ( delim === undefined ) delim = '';
	if ( less === undefined ) less = 5;
	var date = new Date();
	if ( less ) date.setDate(date.getDate() - less);
	var dd = date.getDate();
	var mm = date.getMonth()+1;
	var yyyy = date.getFullYear();
	if ( dd<10 ) dd = '0'+dd;
	if ( mm<10 ) mm = '0'+mm;
	return yyyy + delim + mm + delim + dd;
};
var todayset = function() {
	return 'daily' + dated();
};

var eexec = function(cmd, callback) {
	console.log('async exec ' + cmd);
	var child = exec(cmd, function(err, out, code) { 
		console.log(err);
		console.log(out);
		console.log(code);
		callback(null, out); 
	});
};
var aexec = Async.wrap(eexec);




// ========================================================================================
// THE DAILY FUNCTIONS TO RETRIEVE AND PROCESS ARTICLES EACH DAY
var etl = function(dailyset) {
	var ts, dts;
	if (dailyset !== undefined ) {
		ts = dailyset;
		dts = dailyset.replace('daily','');
		dts = dts.slice(0,4) + '-' + dts.slice(4,6) + '-' + dts.slice(6,8);
	} else {
		ts = todayset();
		dts = dated(delim='-');            
	}
	var qry = 'FIRST_PDATE:' + dts + ' AND (JOURNAL:plos* OR JOURNAL:bmc*)'; // TODO update to indexed date query for crossref and eupmc
	var urls = getPapers(qry, ts);
	for ( var i in urls ) {
		var meta = retrieve(urls[i], ts); // if cannot retrieve qith qs etc, retrieve directly
		// then flatten the text with a text extractor
		var ft;
		// run norma if normalisation option is set, and if the source is OA, save it to public disk
		var sft;
		indexMetadata(dailyset,meta,ft,sft); // TODO should this be done per URL or in bulk?
	}
	// now run the extraction on all the new urls
};

var extract = function(dailyset) {
	// TODO start with a git pull on the dictionaries folder
	var dicts = []; // TODO build a list of dict filenames
	var facts = []; // will storing all the facts whilst processing get too big? should they be offloaded at interval?
	for ( var d in dicts ) {
		var dictname = dicts[d];
		var dict = JSON.parse(fs.readFileSync(dictdir + dictname)); // assumes dict is json. If xml, do an xml2js transform first
		for (var r in dict) {
			var dictrow = dict[r];
			// TODO build a query based on the search term provided in the dict row
			// issue that query to the fulltext processing index
			var resp = []; // this should be a query result
			for ( var rr in resp.hits.hits ) {
				var res = resp.hits.hits[rr]._source; // or could be _fields if we specify the return fields we expect
				var fact = [];
				for ( var k in dictrow ) {
					fact[k] = dictrow[k];
				}
				fact.set = dailyset;
				try {
					// TODO check where these values are actually put in the processing index records
					// NOTE we don't want the entire record bc it would contain the fulltext and perhaps other things we don't want permanently related to the fact
					fact.url = res.url;
					fact.title = res.title;
					fact.author = res.author;
					fact.journal = res.journal;
				} catch(err) {}
				facts.push(fact);
			}
		}
	}
	// if AMI options are to be run too, run them now. If Norma was successfully run, there should also be a structured fulltext index to check against
	indexFacts(facts);
	// once this process is complete the processing index could be dumped (keep the metadata-only index)
}

SyncedCron.add({
	name: 'ETL',
	schedule: function(parser) { return parser.text('at 1:00 am'); },
	job: function() { etl(); }
});
if (runcron) SyncedCron.start();




// ========================================================================================
// THE API ENDPOINTS, THAT CALL THE OTHER FUNCTIONS
API = new Restivus({
	prettyJson: true
});
API.addRoute('', {
	get: function() {
		return { status: 'success', data: 'ContentMine API. Link to docs once they exist' };
	}
});
API.addRoute('etl/:dailyset', {
	post: function() {
		etl(this.urlParams.dailyset);
		return '';
	}
});
// facts - actually use nginx to configure a direct ES search route safely
API.addRoute('facts/daily/:date', {
	get: function() {
		return {}; // TODO query the facts index for all facts on date
	}
});
API.addRoute('facts/:ident', {
	get: function() {
		return {}; // TODO query the facts index for all facts from a given ident, like an article URL or DOI, perhaps
	}
});
// catalogue - again use ES to configure a safe direct ES search onto catalogue METADATA (so store fulltext in separate index)
API.addRoute('catalogue/daily/:date', {
	get: function() {
		return {}; // TODO query the catalogue for everything indexed on given date
	}
});
API.addRoute('catalogue/:ident', {
	get: function() {
		return {}; // TODO query the catalogue for everything for a given ident, like perhaps a journal ID or something...
	}
});
API.addRoute('retrieve', {
	get: function() {
		return {}; // TODO given a URL as query param, retrieve the content of the URL into the system somehow... could also accept data on POST
	}
});
API.addRoute('extract', {
	get: function() {
		return {}; // TODO extract the content of a given source - accept a dicts param to list which dicts to run on it
	}
});
API.addRoute('dictionary', {
	get: function() {
		return {}; // TODO return a list of the filenames in the dictionary directory
	}
});
API.addRoute('dictionary/:dict', {
	get: function() {
		return {}; // TODO read named dictionary from disk and return it as json
	},
	post: function() {
		return {}; // TODO if given a URL param or POST content, read it into the dictionary directory
	},
	delete: function() {
		return {}; // TODO delete the named dict (although if it is in our repo the next git pull would pull it back in)
	}
});
API.addRoute('store', {
	get: function() {
		return {}; // TODO provide access to normalised OA items stored on disk
		// could also serve fulltexts of non-OA items if queried from inside cambridge. and if this would be useful for any reason
	}
});







// =====================================================================================
// FUNCTIONS TO GET CONTENT INTO THE INDEX
var indexFacts = function(dailyset, facts) {
	console.log('uploading facts to catalogue for ' + dailyset);
	// TODO add a check to see if the index for today exists. If it does, delete it
	// if it does not, create it with standard mapping
	var bulk = '';
	for ( var i in facts ) {
		if ( facts[i]._id === undefined ) facts[i]._id = uuid();
		facts[i].id = facts[i]._id;
		// TODO check can this just be a create now, and not needing to pre-createthe uuid at all...
		bulk +=  '{index:{_id:"' + facts[i]._id + '"}}\n';
		bulk += JSON.stringify( facts[i] ) + '\n';
	}
	var frl = indexurl + '/facts/' + dailyset + '/_bulk';
	var xhr = new xmhtrq();
	xhr.open('POST', frl, true);
	xhr.send(bulk);
	console.log('facts sent to index at ' + frl);
}

var indexMetadata = function(dailyset,meta,ft,sft) {
	console.log('uploading metadata to catalogue');
	// TODO should check for the article url / doi / other ID in the catalogue first, and if found just use that record
	// TODO add a check to see if relevant index exists, and delete/create as appropriate with standard mapping
	Meteor.http.call('POST', indexurl + '/catalogue/record', { data: meta, headers:{"content-type":"application/json"} }, 
		function(error,response) {
			error ? console.log(error) : console.log(response.statusCode);
		}
	);
	if (ft) {
		Meteor.http.call('POST', indexurl + '/flat/' + dailyset, { data: meta, headers:{"content-type":"application/json"} });
	}
	if (sft) {
		Meteor.http.call('POST', indexurl + '/structured/' + dailyset, { data: meta, headers:{"content-type":"application/json"} });
	}
}




