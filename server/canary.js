
import * as fs from 'fs';
import exec from 'child_process';
import {XMLHttpRequest as xmhtrq} from 'xmlhttprequest';


// ========================================================================================
// CONFIGURE THE MAIN SETTINGS HERE
var runcron = true;
var normalise = false;
var indexurl = 'http://gateway:9200';
var userdir = '/home/cloo';
var storedir = userdir + '/store';
var dictsdir = userdir + '/dev/contentmine/src/dictionaries';
var scraperdir = userdir + '/dev/contentmine/src/journal-scrapers/scrapers/'; // needed by thresher / quickscrape





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
		// if we do this, then the items content should be saved into a folder in the store named with some uuid, then can be extracted into an 
		// index with that uuid too, then facts could be retrieved from it
	}
});
API.addRoute('extract', {
	get: function() {
		return {}; // TODO extract the content of a given source - accept a dicts param to list which dicts to run, and a query param to identify the catalogue items to run it against
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
		// this could probably also just be served by nginx configuration
	}
});



