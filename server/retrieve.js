
import * as request from 'request';
import * as thresher from 'thresher';
import * as moment from 'moment';
import * as child_process from 'child_process';
import fs from 'fs'
var mark = require('./markscommon.js')

// =====================================================================================
// FUNCTIONS TO CHECK AND RETRIEVE URLS AND READ FROM GETPAPERS / QUICKSCRAPE / THRESHER OUTPUT
var retrieve = function(url, dailyset) {
	var sd = Meteor.settings.storedir + '/' + dailyset + '/' + mark.uid(url);
	if(!fs.existsSync(sd)) {
		fs.mkdirSync(sd);
	}
	console.log('preparing to retrieve ' + url + ' to ' + sd);
	var urlexists = acheck200(url);
	if ( urlexists  && Meteor.settings.downloadPapers ) {
		athresh(sd, url); // if quickscrape/thresher is throwing lots of errors, wrap this in a try/catch
		// if fulltext.html not retrieved, try to get the url directly
		if ( !fs.existsSync(sd + '/fulltext.html')) {
			console.log('no fulltext.html present so retrieving directly');
			// TODO add code here that would look in the source URL for links that may go to the fulltext
			// because often the source URL is a splash page. Also grab any cookies presented by the source URL
			// Code in CL API to do this - just copy it over.
			Meteor.http.call('GET', url, function(sth,res) {
				// save the file to the url folder
				var nm = url.split('/')[-1];
				var fnm = sd + '/' + 'fulltext.html';
				fs.writeFileSync(fnm, res);
				console.log('file ' + nm + ' retrieved directly and saved to set');
				// TODO if there is no fulltext.html but there is some other html, copy it to fulltext.html
				// TODO if there is now a fulltext.html, extract the text of it out into a file called fulltext.txt
				// TODO if there is no html but there is a pdf or an xml, keep originals but also convert it to text into a file called fulltext.txt
			});
		} else {
			// TODO extract fulltext.html out to fulltext.txt
		}
		return true;
	} else {
		return true;
	}
}

var getPapers = function(searchstr, dailyset) {
	// TODO update this to call the latest version of getpapers, and to call it with the query
	// for whichever sources we want URLs for. IF POSSIBLE, have getpapers return the result URLs
	// directly instead of having to read them from disk
	var sd = Meteor.settings.storedir + '/' + dailyset;
	console.log('running getpapers for query ' + searchstr);
	var api = 'eupmc'; // should be crossref, and maybe also eupmc if desirable
	var cmd = "getpapers --query '" + searchstr + "' -x --outdir '" + sd + "'"; // + ' --all';
	var child = mark.aexec(cmd);
	var urls = geturls(sd, api);
	return urls;
}

var geturls = function(sd, api) {
	var fln = sd + '/' + api + '_results.json';
	console.log('Reading urls from ' + fln);
	var urls = [];
	var jsn = JSON.parse(fs.readFileSync(fln, 'utf8'));
	for ( var i in jsn ) {
		var ob = jsn[i];
		var url = false;
		// look for full text urls, prefer non-subscription, then fall back to DOI or PMCID
		for ( var u in ob.fullTextUrlList ) {
			var first = true;
			for ( var n in ob.fullTextUrlList[u].fullTextUrl ) {
				if ( ob.fullTextUrlList[u].fullTextUrl[n].availability !== 'Subscription required' && url === false ) {
					url = ob.fullTextUrlList[u].fullTextUrl[n].url[0];
				} else if (first === true) {
					first = ob.fullTextUrlList[u].fullTextUrl[n].url[0];
				}
			}
			if ( url === false && first !== true ) {
				url = first;
			}
		}
		if ( url === false && ob.DOI ) {
			url = 'https://doi.org/' + ob.DOI[0];
		}
		if ( url === false && ob.pmcid ) {
			url = 'http://europepmc.org/articles/PMC' + ob.pmcid[0].replace('PMC','');
		}
		if (url !== false) urls.push(url);
	}
	console.log('Retrieved ' + urls.length + ' urls');
	return urls;
};


// an async method to find the end URL in a redirect chain (e.g. dereferencing DOIs)
var resolve = function(url, callback) {
	request.head(url, function (err, res, body) {
		if ( res === undefined ) {
			callback(null, url);
		} else {
			callback(null, res.request.uri.href);
		}
	});
};
var aresolve = Async.wrap(resolve);


// check for 200 - to be done before thresher because it hangs on pages that don't return
var check200 = function(url, callback) {
	request.head(url, function (err, res, body) {
		console.log(res.statusCode);
		if ( res.statusCode === 200 ) {
			callback(null, true);
		} else {
			callback(null, false);
		}
	});
};
var acheck200 = Async.wrap(check200);

// various processing functions called by the meteor methods during processing
var thresh = function(sd, url, callback) {
	process.chdir(sd);
	// try to quickscrape / thresher the urls
	var scrapers = new thresher.ScraperBox(Meteor.settings.scraperdir);
	var t = new thresher.Thresher(scrapers);
	t.once('result', function(result, structured) {
		// no longer need to read the metadata from thresher output, we will already have it from the API
		/*var boutfile = 'bib.json';
		var bib = format(structured);
		var pretty = JSON.stringify(bib, undefined, 2);
		fs.writeFileSync(boutfile, pretty);
		var routfile = 'results.json';
		fs.writeFileSync(routfile, JSON.stringify(structured,undefined,2));*/
		t.removeAllListeners();
		t = null;
		callback(null,true);
  });
	// TODO what and how to return on failure of getting a result? Should return false
	t.scrape(url, true);
};
var athresh = Async.wrap(thresh);


// the bibjson formatting function
var format = function(t) {
  var x = {};

  // single value metadata
  ['title'].forEach(function(key) {
    if (t[key] && t[key].value && t[key].value.length > 0) {
      x[key] = t[key].value[0];
    }
  });

  // links
  x.link = [];
  ['fulltext_html',
   'fulltext_pdf',
   'fulltext_xml',
   'supplementary_file'].forEach(function(type) {
    if (t[type] && t[type].value && t[type].value.length > 0) {
      t[type].value.forEach(function(url) {
        x.link.push({ type: type, url: url });
      });
    }
  });

  // people
  ['author', 'editor', 'reviewer'].forEach(function(key) {
    var people = [];
    ['name', 'givenName',
     'familyName', 'institution'].forEach(function(type) {
      var endkey = key + '_' + type;
      if (t[endkey] && t[endkey].value) {
        var i = 0;
        t[endkey].value.forEach(function(y) {
          if (people.length < i + 1) {
            people.push({});
          }
          people[i][type] = y;
          i += 1;
        });
      }
    });
    if (people.length > 0) {
      x[key] = people;
    }
  });

  // publisher
  if (t.publisher && t.publisher.value && t.publisher.value.length > 0) {
    x.publisher = { name: t.publisher.value[0] };
  }

  // journal
  x.journal = {};
  ['volume', 'issue', 'firstpage',
   'lastpage', 'pages'].forEach(function(key) {
    if (t[key] && t[key].value && t[key].value.length > 0) {
      x.journal[key] = t[key].value[0];
    }
  });
  if (t.journal_name &&
      t.journal_name.value &&
      t.journal_name.value.length > 0) {
    x.journal.name = t.journal_name.value[0];
  }
  if (t.journal_issn &&
      t.journal_issn.value &&
      t.journal_issn.value.length > 0) {
    x.journal.issn = t.journal_issn.value[0];
  }

  // sections
  x.sections = {};
  // single-entry fields
  ['abstract', 'description', 'introduction', 'methods', 'results',
   'discussion', 'conclusion', 'case_report', 'acknowledgement',
   'author_contrib', 'competing_interest'].forEach(function(key) {
    var record = {};
    var htmlkey = key + '_html';
    var textkey = key + '_text';
    [key, textkey].forEach(function(endkey) {
      if (t[endkey] && t[endkey].value && t[endkey].value.length > 0) {
        record.text = t[endkey].value[0];
      }
    });
    if (t[htmlkey] && t[htmlkey].value && t[htmlkey].value.length > 0) {
      record.html = t[htmlkey].value[0];
    }
    if (Object.keys(record).length > 0) {
      x.sections[key] = record;
    }
  });
  // multiple-entry fields
  ['references_html', 'tables_html', 'figures_html'].forEach(function(key) {
    if (t[key] && t[key].value && t[key].value.length > 0) {
      var outkey = key.replace(/_html$/, '');
      x.sections[outkey] = t[key].value.map(function(y) {
        return {
          html: y
        };
      });
    }
  });

  // date
  x.date = {};
  ['date_published', 'date_submitted',
   'date_accepted'].forEach(function(key) {
    if (t[key] && t[key].value && t[key].value.length > 0) {
      var date = t[key].value[0];
      if (date.constructor === Array) {
        date = date[0];
      }
      key = key.replace(/^date_/, '');
      x.date[key] = moment(new Date(date.trim())).format();
    }
  });

  // identifier
  x.identifier = [];
  ['doi', 'pmid'].forEach(function(key) {
    if (t[key] && t[key].value && t[key].value.length > 0) {
      x.identifier.push({
        type: key,
        id: t[key].value[0]
      });
    }
  });

  // license
  if (t.license && t.license.value && t.license.value.length > 0) {
    x.license = t.license.value.map(function(y) {
      return { raw: y };
    });
  }

  // copyright
  if (t.copyright && t.copyright.value) {
    x.copyright = t.copyright.value;
  }

  x.log = [
    {
      date: moment().format(),
      'event': 'retrieved by canary'
    }
  ];

  return x;
};

module.exports.getpapers = getPapers
module.exports.retrieve = retrieve
