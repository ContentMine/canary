
// some good test articles
// http://journals.plos.org/plosone/article?id=10.1371/journal.pone.0137925	has species
// http://journals.plos.org/plosone/article?id=10.1371/journal.pone.0008887	has human genes
// http://journals.plos.org/plosone/article?id=10.1371/journal.pone.0121780 has dna rna sequences

// these are the main settings, which can be altered below for running locally
var userdir = '/home/cloo';
var regexesdir = userdir + '/dev/contentmine/src/ami-regexes/';
var scraperdir = userdir + '/dev/contentmine/src/journal-scrapers/scrapers/';
var setsdir = userdir + '/cm/sets/';
var articlesdir = userdir + '/cm/articles/';

var storeurl = 'http://store.contentmine.org/'; // the URLs for viewing these things
var factsurl = 'http://facts.contentmine.org/';

var factsindexurl = 'http://gateway:9200/contentmine/fact/'; // the URLs for POSTing these things
var metadataindexurl = 'http://gateway:9200/catalogue/record/';

// how and what to run
var runcron = true;
var runlocal = false;
var sendremote = true;
if ( runlocal ) {
    // the changes to settings required to run locally (these assume our VM setup, but can be customised)
    userdir = '/home/workshop/workshop';
    regexesdir = userdir + '/regexes/';
    scraperdir = userdir + '/journal-scrapers/scrapers/';
    setsdir = userdir + '/cm/sets/';
    articlesdir = userdir + '/cm/articles/';
    
    storeurl = 'file://' + userdir + '/cm/sets/';
    factsurl = 'http://localhost:3000/cmfacts.html';

    factsindexurl = 'http://localhost:9200/contentmine/fact/'; // NOTE: a local ES must be running
}
// TODO should these two remote ones also prefix the canarysetid with some sort of local machine or IP URL address?
// if running locally but also sending to remote, where are the remote endpoints to send to
var remotefactsindexurl = function(canarysetid) {
    return 'http://api.contentmine.org/sets/' + canarysetid + '/facts/receive';
};
var remotemetadataindexurl = function(canarysetid) {
    return 'http://api.contentmine.org/sets/' + canarysetid + '/metadata/receive';
};

// simple methods that return parts of on-disk locations for finding stuff, generated from the above settings
var regexdir = function(regex) {
	return regexesdir + regex + '.xml';
};
var uid = function(url) {
	return url.replace(/\/+/g, '_').replace(/:/g, '');
};
var articledir = function(url) {
	return articlesdir + uid(url) + '/';
};
var setdir = function(canarysetid) {
	return setsdir + canarysetid + '/';
};
var setarticledir = function(canarysetid,url) {
	return setdir(canarysetid) + uid(url) + '/';
};

// which AMI processes should be run when processing
var availableProcesses = ['species','gene','sequence']; // rrid identifier phylo others?

// simple method to generate a uuid
var uuid = function() {
    return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
    });
};

Sets = new Mongo.Collection("sets");

Router.map(function() {
	this.route('home', {
        path : '/',
		template: 'intro'
    });
    this.route('new', {
        path : '/new',
        action: function() {
            this.redirect('/' + uuid());
        }
    });
    this.route('set', {
        path : '/:_id',
        template : 'canary',
        waitOn : function() {
            return Meteor.subscribe('sets', this.params._id);
        },
        data : function() {
            return {
                canarysetid: this.params._id
            };
        }, 
        action : function() {
            if ( this.params._id.indexOf('-') !== -1 || this.params._id.indexOf(' ') !== -1 || this.params._id !== this.params._id.toLowerCase() ) {
                var tid = this.params._id.replace(/-/g,'').replace(/ /g,'').toLowerCase();
                console.log('Redirecting to tidied version of ' + this.params._id + ' - ' + tid);
                this.redirect('/' + tid);
            } else {
                if ( Sets.findOne(this.params._id) === undefined ) {
                    Meteor.call('createSet',{
                        _id: this.params._id,
                        urls: {}
                    });
                }
                Session.set('canarysetid', this.params._id);
                this.render();                
            }
        }
    });
});



if (Meteor.isClient) {
    Meteor.startup(function () {});

	Template.registerHelper('equals', function (a, b) {
        return a === b;
    });
	Template.registerHelper('processed', function (amount, proc) {
        var currentset = Sets.findOne(Session.get("canarysetid"));
		if ( !currentset.urls ) {
			return false;
		} else {
			var diff = 0;
			for ( var i in currentset.urls ) {
				if ( currentset.urls[i].processed.indexOf(proc) == -1 ) {
					diff += 1;
				}
			}
			if ( amount == 'all' && diff === 0 ) {
				return true;
			} else if ( amount == 'some' && diff !== 0 ) {
				return diff;
			} else {
				return false;
			}
		}
    });
	Template.registerHelper('articlescount', function () {
        var currentset = Sets.findOne(Session.get("canarysetid"));
        var articles = 0;
        for ( var i in currentset.urls ) {
            if ( currentset.urls[i].articled ) articles += 1;
        }
		return articles;
	});
	Template.registerHelper('currentset', function () {
        return Sets.findOne(Session.get("canarysetid"));
	});
	Template.registerHelper('processing', function () {
        return Session.get("processing");
	});
    Template.registerHelper("objectToPairs",function(object){
        return _.map(object, function(value, key) {
            return {
                key: key,
                value: value
            };
        });
    });
    
    Template.canary.helpers({
		uidlink: function(url) {
			return storeurl + Session.get("canarysetid") + '/' + encodeURIComponent(uid(url)) + '/';
		},
 		terms: function(set,collection,field) {
			return Meteor.call('terms',set,collection,field);
		},
		wasprocessed: function(url) {
            var currentset = Sets.findOne(Session.get("canarysetid"));
            var tid = uid(url).replace(/\./g,'_');
			return currentset.urls[tid].processed;
		},
        processedcount: function() {
            var currentset = Sets.findOne(Session.get("canarysetid"));
            var pc = 0;
            for ( var u in currentset.urls ) {
                if ( currentset.urls[u].processed.length !== 0 ) pc += 1;
            }
            return pc;            
        },
        urlscount: function() {
            var currentset = Sets.findOne(Session.get("canarysetid"));
            var count = 0;
            for (var k in currentset.urls) if (currentset.urls.hasOwnProperty(k)) count++;
            return count;
        },
        failedcount: function() {
            var currentset = Sets.findOne(Session.get("canarysetid"));
            var fc = 0;
            for ( var u in currentset.urls ) {
                if ( currentset.urls[u].failed ) fc += 1;
            }
            return fc;
        },
        nofactscount: function() {
            // for each article check if there are any facts for it, and return the count of articles with no facts
            var currentset = Sets.findOne(Session.get("canarysetid"));
            var nofacts = 0;
            for ( var u in currentset.urls ) {
                if ( currentset.urls[u].facts === 0 ) nofacts += 1;                
            }
            return nofacts;                
        },
        factcount: function () {
            var currentset = Sets.findOne(Session.get("canarysetid"));
            var fc = 0;
            for ( var u in currentset.urls ) {
                if ( currentset.urls[u].facts ) fc += currentset.urls[u].facts;
            }
            return fc;
        },
        factsurl: function() {
            return factsurl + '?q=set.exact:' + Session.get("canarysetid");
        }
	});

    Template.canary.events({
        "click .process": function (event) {
			Session.set("processing",event.target.id);
            var params = {
				processor: event.target.id,
				canarysetid: Session.get("canarysetid")
			};
			if ( event.target.id === 'regex-custom' ) { params.custom = $('#customregex').val(); }
			if ( $(event.target).hasClass('rerun') ) { params.rerun = true; }
            Meteor.call('process', params, function() { Session.set("processing",false); });
        },
        "click .doprocesses": function (event) {
    		Session.set("processing","all");
	    	var rerun = event.target.getAttribute('rerun');
            for ( var i in availableProcesses ) {
                (function(i) {
                    Meteor.call('process', {
                        processor: availableProcesses[i],
                        rerun: rerun,
                        canarysetid: Session.get("canarysetid")
                    });
                    if ( i == (availableProcesses.length - 1) ) {
                        Session.set("processing", false);
                        console.log("All processes run");
        				Meteor.call('loadFacts',Session.get("canarysetid"));
                    }
                })(i);
            }
        },
        "click .deleteurl": function(event) {
	    	var url = event.target.getAttribute('which');
	    	Meteor.call('removeUrlFromSet', url, Session.get("canarysetid"));
        },
        "click #deleteurls": function(event) {
	    	Meteor.call('removeUrlsFromSet', Session.get("canarysetid"));
        },
        "click #deletefailedurls": function(event) {
	    	Meteor.call('removeUrlsFromSet', Session.get("canarysetid"), 'failed');
        },
        "click #deletenofactsurls": function(event) {
	    	Meteor.call('removeUrlsFromSet', Session.get("canarysetid"), 'nofacts');
        },
        "click #addurls": function (event) {
			var curls = $('#urls').val().split('\n');
			$('#urls').val("");
			for ( var c in curls ) {
				if ( curls[c].length > 1 ) {
					// add in the names of query formats we will accept once they have actually been enabled
					if ( curls[c].toLowerCase().startsWith('eupmc') ) {
						Meteor.call('getPapers', curls[c], Session.get("canarysetid"));
					} else {
						Meteor.call('addUrlToSet', curls[c], Session.get("canarysetid"));
					}
				}
			}
        }
    });
}

if (Meteor.isServer) {
    Meteor.startup(function () {});
    
    Meteor.publish("sets", function (canarysetid) {
        return Sets.find(canarysetid);
    });

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
    var d = new Date();
    console.log(d);
    var todayset = function() {
        return 'daily' + dated();
    };

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
        if ( Sets.findOne( ts ) === undefined ) {
            Meteor.call('createSet',{
                _id: todayset(),
                urls: {}
            });
        }
        // TODO: add other oa journals that can be queried from epmc and we have a journal-scraper and they publish nlm xml
        // check if elife, the acta ones, peerj publish nlm xml
        // trialsjournal which is in europepmc as trials should work same as bmc
        // check the mdpi list of journals and see if any are in epmc http://www.mdpi.com/about/journals
        var qry = 'FIRST_PDATE:' + dts + ' AND (JOURNAL:plos* OR JOURNAL:bmc*)';
        Meteor.call('getPapers', qry, ts);
        console.log('Created daily set and populated with getpapers results');
        for ( var i in availableProcesses ) {
            Meteor.call('process', {
                processor: availableProcesses[i],
                canarysetid: ts
            });
        }
        console.log('Processed daily set with available processes');
        Meteor.call('loadFacts', ts );
        console.log('Facts loaded for daily set');
    };
    
	SyncedCron.add({
		name: 'ETL',
		schedule: function(parser) { return parser.text('at 2:00 am'); },
		job: function() { etl(); }
	});
	if (runcron) SyncedCron.start();

    
	Restivus.configure({
		useAuth: true,
		prettyJson: true
	});
	Restivus.addCollection(Sets);
	Restivus.addRoute('', {
        get: function() {
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'text/html'
                },
                body: '\
<b>CONTENTMINE API DOCUMENTATION</b> <br><br> \
Returns JSON unless otherwise stated<br> \
There is no auth yet, but it will be coming soon and will be documented here once necessary.<br> \
Cross-domain and JSONP should be possible, no problem.<br><br> \
/sets<br> \
GET a list of all canary working set objects (could be big)<br><br> \
/sets/&lt;canarysetid&gt;<br> \
GET a particular canary working set object identified by the canarysetid parameter<br><br> \
/query/facts<br> \
GET or POST elasticsearch queries to browse the facts.<br> \
This is equivalent to an elasticsearch _search endpoint, and returns elasticsearch result sets.<br> \
Our mapping stores exact string terms for term matching in field keys suffixed with .exact.<br> \
The simplest way to find keys to search or aggregate on is to just look at the objects in the result sets.<br> \
Straightforward parameters are q=searchstring&size=10&from=0. q can handle wildcards and logic and key specifications, such as q=fact.exact:"fact" AND set:*setnam~<br> \
Here is an example query URL: <a href="http://api.contentmine.org/query/facts?q=*&size=5&from=0">http://api.contentmine.org/query/facts?q=*&size=5&from=0</a><br> \
See elasticsearch docs at <a href="https://www.elastic.co/guide/en/elasticsearch/reference/current/search-search.html">https://www.elastic.co/guide/en/elasticsearch/reference/current/search-search.html</a> for more information on how to query the API <br><br> \
                '
            };
        }
    });
    Restivus.addRoute('remove/:coll', {
        delete: function() {
            // TODO should be a dynamic call to the collection type, and should be restricted to admin. Or got rid of altogether
            if ( this.urlParams.coll === 'sets' ) {
                Sets.remove({});
            }
            return '';
        }
    });
	Restivus.addRoute('sets/:canarysetid/etl', {
        post: function() {
            etl(this.urlParams.canarysetid);
            return '';
        }
    });
	Restivus.addRoute('sets/:canarysetid/facts/receive', {
		get: function() {
			return "yes, you could POST your facts here";
		},
		post: function() {
            var facts = this.request.body;
            //console.log(bulk);
            console.log('Processing receipt of bulk facts for ' + this.urlParams.canarysetid);
			Meteor.call('indexFacts',this.urlParams.canarysetid, facts);
		}
	});
	Restivus.addRoute('sets/:canarysetid/terms', {
        // query params as terms route below, except set is predefined in the route
        // mongo matches: http://docs.mongodb.org/manual/tutorial/query-documents/#read-operations-query-argument
        // exact on { fieldname: "value" } - for AND on other fields, just specify them in the obj
        // match subfields with dot notation eg fieldname.subfield
        // exact or on one field { type: { $in: [ 'food', 'snacks' ] } }
        // exact or multi field { $or: [ { qty: { $gt: 100 } }, { price: { $lt: 9.95 } } ] }
        // and combinations of the above for AND and OR together also works
        // partial matches may be possible with regexes in place of the search term
        // otherwise using regex bson: {'fieldname': {'$regex': 'sometext'}}
		get: function() {
			var match = { set: this.urlParams.canarysetid };
            // TODO check for any q values
			return Meteor.call('terms', this.queryParams.collection, this.queryParams.field, match, this.queryParams.simple);
		}
	});
	Restivus.addRoute('terms', {
        // query params can be 
        // set="workspace set name"
        // collection="collection name"
        // field="comma-separated list of fields"
        // q="match string exact or with *"
        // simple="true/false"
		get: function() {
			var match = {};
			if ( this.queryParams.set ) { match.set = this.queryParams.set; }
			if ( this.queryParams.q ) {
                
            }
			return Meteor.call('terms', this.queryParams.collection, this.queryParams.field, match, this.queryParams.simple);
		}
	});
	Restivus.addRoute('query/facts', {
        // this could actually be handled directly by an nginx route to the index
		get: function() {
            var frl = factsindexurl + '_search?';
            for ( var k in this.queryParams ) { frl += k + '=' + this.queryParams[k] + '&'; }
            return Meteor.http.call('GET', frl).data;
		},
        post: function() {
            console.log(this.request.body);
            var frl = factsindexurl + '_search';
            return Meteor.http.call('POST', frl, { data: this.request.body }).data;
        }
	});
	
	Meteor.methods({});
}

var fs = Meteor.npmRequire('fs');
var exec = Meteor.npmRequire('child_process').exec;
var path = Meteor.npmRequire('path');
var xml2js = Meteor.npmRequire('xml2js');
var moment = Meteor.npmRequire('moment');

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

var xmhtrq = Meteor.npmRequire('xmlhttprequest').XMLHttpRequest;

Meteor.methods({
	terms: function(collection,field,match,simple) {
        // TODO is terms useful on sets data? or should this just pass through to ES facts?
        if ( !collection ) { collection = 'sets'; }
        if ( !field ) { field = 'url'; } // TODO: check if field has commas, if so split and do terms across multiple fields
        if ( !match ) { match = {}; }
        // TODO: try different sorts of match if no exact found? Or always do a startswith regex? Then if no answer anywhere regex?
        var grp = {};
        grp[field] = "$" + field;
        var qry = [
            {$match: match}, 
            {$group: {_id: grp, count: {$sum: 1}}},
            { "$sort": { "count": -1 } } // TODO: if fields is multi, no point sorting here. But consider sort order on single?
        ];
        var vals = [];
		if ( collection.toLowerCase() === 'sets' ) { // TODO should be a dynamic call to collection
			vals = Sets.aggregate(qry);        
        }
        // if field was multple, result set will require sorting - should consider sort order?
        /*vals.sort(function(a,b){ 
            return a.count < b.count? -1:1;
        }); */
        for ( var i in vals ) {
            if ( simple ) {
                vals[i] = vals[i]._id[field];
            } else {
                vals[i].term = vals[i]._id[field];
                delete vals[i]._id;                
            }
        }
        return vals;
	},
    
	process: function(params) {
		var currentset = Sets.findOne(params.canarysetid);
		console.log('beginning process ' + params.processor + ' for ' + params.canarysetid);
		for ( var url in currentset.urls ) {
			if ( currentset.urls[url].processed.indexOf(params.processor) == -1 || params.rerun) {
                if ( currentset.urls[url].processed.indexOf(params.processor) == -1 ) {
                    currentset.urls[url].processed.push(params.processor);
                }
				var sd = setarticledir(params.canarysetid,currentset.urls[url].url);
				var proc = params.processor;
				var regex = false;
				if ( params.processor.startsWith('regex-') ) {
					var parts = proc.split('-');
					proc = parts[0];
					regex = parts[1];
				}
				var cmd = '/usr/bin/ami2-' + proc + ' -q ' + sd + ' --input scholarly.html';
				if ( regex ) {
					if ( regex === 'custom' ) {
						var cr = saveregex(params.canarysetid,url,params.custom);
						cmd += ' -r.r ' + setarticledir(params.canarysetid, currentset.urls[url].url) + 'customregex.xml';
					} else {
						cmd += ' -r.r ' + regexdir(regex);
					}
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
		Sets.update(params.canarysetid, {$set: { urls: currentset.urls }});
		console.log('process ' + params.processor + ' finished for ' + params.canarysetid);
	},
	normalise: function(url, canarysetid) {
		console.log('about to normalise ' + url);
		var sd = articledir(url);
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
			// try to make a simple version out of an html file if available
			// by put body content into <html><body><div><p>.... and probably log that we are cludging
			console.log('norma did not succeed');
			Meteor.call('addFailToSet', url, canarysetid);
		} else {
			Meteor.call('addArticleToSet', url, canarysetid);
		}
	},
	retrieve: function(url, canarysetid) {
		var sd = articledir(url);
		console.log('preparing to retrieve ' + url + ' to ' + sd);
		if ( !fs.existsSync(sd) ) {
            var urlexists = acheck200(url);
            if ( urlexists ) {
    			var meta = athresh(sd, url);
	    		console.log('thresher finished');        
            } else {
	    		console.log('url does not seem to exist - removing from set');                
				Meteor.call('addFailToSet', url, canarysetid);
            }
			// if fulltext.html not retrieved, try to get the url directly
			if ( !fs.existsSync(sd + 'fulltext.html') && urlexists ) {
				console.log('no fulltext.html present so retrieving directly');
				Meteor.http.call('GET', url, function(sth,res) {
					// save the file to the url folder
					var nm = url.split('/')[-1];
					var fnm = sd + nm;
					fs.writeFileSync(fnm, res);
					console.log('file ' + nm + ' retrieved directly and saved to set');
					// if there is no fulltext.html but there is some other html, copy it to fulltext.html
					// if there is no html but there is a pdf, convert it to text, 
					// then convert that to scholarly.html and skip norma - and probably log that we are cludging...
					// try to normalise the retrieved content
					Meteor.call('normalise', url, canarysetid);
				});
			} else if ( urlexists ) {
				// try to normalise the retrieved content
				Meteor.call('normalise', url, canarysetid);
			}
            try {
                if (meta.date.published) meta.published_date = meta.date.published.split('T')[0] + ' 0100';
                delete meta.sections;
                delete meta.date;
                delete meta.log;
                Meteor.call('indexMetadata',meta);                
            } catch(err) {}
		} else {
			// we already have this url, if a canarysetid was provided then copy it over
            console.log("article at URL " + url + " is already in store");
			if ( canarysetid ) {
				Meteor.call('addArticleToSet', url, canarysetid);
			}
		}
	},
	getPapers: function(searchstr, canarysetid) {
		//getpapers --query 'FIRST_PDATE:[2015-05-20 TO 2015-05-22] JOURNAL:"plos one"' --outdir dateplos --xml <- this will get xml for that date range. OK
		//getpapers --query 'FIRST_PDATE:[2015-06-02] JOURNAL:"plos one"' --outdir dateplos --all <- this will output a list of fulltext HTML urls for the specified date (because it's too recent to have xml on EUPMC) OK
		var sd = setdir(canarysetid);
		console.log('about to getpapers ' + searchstr);
		// add any query formats that we end up accepting in here
		// TODO at the moment API is ignored, because the installed getpapers does not accept it
		// also the --all flag could be used to get URLs for all rather than just OA papers, but it does not work yet
		var api = 'eupmc';
		if ( searchstr.toLowerCase().startsWith('eupmc') ) {
			searchstr = searchstr.replace('eupmc ','').replace('EUPMC ','');
			api = 'eupmc';
		} else if ( searchstr.toLowerCase().startsWith('arxiv') ) {
			searchstr = searchstr.replace('arxiv ','').replace('ARXIV ','');
			api = 'arxiv';
		} else if ( searchstr.toLowerCase().startsWith('ieee') ) {
			searchstr = searchstr.replace('ieee ','').replace('IEEE ','');
			api = 'ieee';
		}
		var cmd = "getpapers --query '" + searchstr + "' --outdir " + sd; // + ' --all';
		var child = aexec(cmd);
		console.log('getpapers finished - now processing fulltext urls file');
		// now read the list of URLs that came out of the search
		//var urls = fs.readFileSync(sd + 'fulltext_html_urls.txt').toString().split("\n");
        // getpapers fulltext html urls is unreliable, so read the <API>_results.json file instead
        var urls = geturls(sd, api);
		for ( var i in urls ) {
			Meteor.call('addUrlToSet', urls[i], canarysetid);
		}
	},
	
	loadFacts: function(canarysetid) {
		console.log('loading facts for ' + canarysetid);
		var currentset = Sets.findOne(canarysetid);
        var allfacts = [];
        for ( var u in currentset.urls ) {
            var url = currentset.urls[u].url;
            var sd = setarticledir(canarysetid,url);
            var facts = [];
            try {
                facts = readFacts(sd);
                console.log('facts retrieved from ' + sd);
            } catch(err) {
                console.log(err);
            }
            for ( var c in facts ) {
                facts[c].set = canarysetid;
                facts[c].url = url;
                try {
                    facts[c].title = currentset.urls[u].meta.title;
                    facts[c].author = currentset.urls[u].meta.author;
                    facts[c].journal = currentset.urls[u].meta.journal.title;
                } catch(err) {}
                allfacts.push(facts[c]);
            }
            currentset.urls[u].facts = facts.length;
        }
		Sets.update(canarysetid, {$set: { urls: currentset.urls }});
		Meteor.call('indexFacts', canarysetid, allfacts);
	},
	indexFacts: function(canarysetid, facts) {
		console.log('uploading facts to catalogue for ' + canarysetid);
        var frld = factsindexurl + '_query?q=set.exact:' + canarysetid;
        // TODO: this should do a scroll query then bulk delete - delete by query is deprecated and not performant
        Meteor.http.call('DELETE', frld);
        bulk = '';
        for ( var i in facts ) {
            if ( facts[i]._id === undefined ) facts[i]._id = uuid();
            facts[i].id = facts[i]._id;
            bulk +=  '{index:{_id:"' + facts[i]._id + '"}}\n';
            bulk += JSON.stringify( facts[i] ) + '\n';
        }
        var frl = factsindexurl + '_bulk';
        var xhr = new xmhtrq();
        xhr.open('POST', frl, true);
        xhr.onreadystatechange = function() {
            if ( xhr.readyState==4 ){
                //console.log(xhr.responseText);
            }
        };
        xhr.send(bulk);
        console.log('facts sent to index at ' + frl);
        if ( runlocal && sendremote ) {
            console.log("Running local but also sending facts to remote");
    		Meteor.http.call('POST', remotefactsindexurl(canarysetid), { data: facts, headers:{"content-type":"application/json"} });
        }
    },
	indexMetadata: function(meta) {
		console.log('uploading metadata to catalogue');
		// TODO should check for the article url / doi / other ID in the catalogue first, 
		// and just add the url to it if not already known, and record which one links to the file dump
		Meteor.http.call('POST', metadataindexurl, { data: meta, headers:{"content-type":"application/json"} }, 
            function(error,response) {
                error ? console.log(error) : console.log(response.statusCode);
            }
        );
        if ( runlocal && sendremote ) {
            console.log("Running local but also sending metadata to remote");
    		Meteor.http.call('POST', remotemetadataindexurl(canarysetid), { data: meta, headers:{"content-type":"application/json"} });
        }
	},
	createSet: function (obj) {
		var d = new Date();
		obj.createdAt = d;
		obj.updatedAt = d;
		Sets.insert(obj);
		var sd = setdir(obj._id);
		if ( !fs.existsSync(sd) ) { fs.mkdirSync(sd); }
		console.log('set ' + obj._id + ' created');
	},
	addFailToSet: function(url, canarysetid) {
		var currentset = Sets.findOne(canarysetid);
        var tid = uid(url).replace(/\./g,'_');
		if ( !currentset.urls[tid].failed ) {
            currentset.urls[tid].failed = true;
			Sets.update(canarysetid, {$set: {urls: currentset.urls}});
		}
		console.log('failed article ' + url + 'added to set ' + canarysetid);
	},
	addArticleToSet: function(url, canarysetid) {
		var currentset = Sets.findOne(canarysetid);
        var tid = uid(url).replace(/\./g,'_');
		if ( !currentset.urls[tid].articled ) {
			// copy the article dir into the set
			var sd = articledir(url);
			var sdr = setarticledir(canarysetid,url);
			fs.mkdirSync(sdr);
			var cmd = 'ln -s ' + sd + '* ' + sdr;
			var child = aexec(cmd);
			currentset.urls[tid].articled = true;
            try {
        		meta = JSON.parse(fs.readFileSync(sd + 'bib.json'));
                currentset.urls[tid].meta = {
                    title: meta.title,
                    author: meta.author,
                    journal: meta.journal.title
                };                    
            } catch(err) {}
			Sets.update(canarysetid, {$set: {urls: currentset.urls}});
			console.log('article ' + url + ' added to set ' + canarysetid);
		}
	},
	addUrlToSet: function(url, canarysetid) {
        if ( url.indexOf('europepmc') !== -1 ) {
            console.log('Attempting to get a DOI for a europepmc link from ncbi API ' + url);
            url = aeupmcresolve(url);
            console.log('URL is now ' + url);
        }
        if ( url.indexOf('10') === 0 ) {
            url = 'http://dx.doi.org/' + url;
        }
        if ( url.indexOf('dx.doi.org') !== -1 ) {
            console.log('Attempting to resolve the redirect of ' + url);
            url = aresolve(url);
            console.log('URL is now ' + url);
        }
		var currentset = Sets.findOne(canarysetid);
        var tid = uid(url).replace(/\./g,'_');
		if ( !currentset.urls.hasOwnProperty(tid) ) {
			currentset.urls[tid] = {
                "url": url,
                "articled": false,
                "failed": false,
                "facts": 0,
                "processed":[]
            };
			Sets.update(canarysetid, {$set: {urls: currentset.urls}});
		}
		console.log('url ' + url + ' added to set ' + canarysetid);
		Meteor.call('retrieve', url, canarysetid);
	},
	removeUrlFromSet: function(url, canarysetid) {
		var currentset = Sets.findOne(canarysetid);
        var tid = uid(url).replace(/\./g,'_');
        if ( currentset.urls.hasOwnProperty(tid) ) {
            delete currentset.urls[tid];
        }
		Sets.update(canarysetid, {$set: { urls: currentset.urls }});
		deleteFolderRecursive(setarticledir(canarysetid,url));
		console.log('url ' + url + ' removed from set ' +  canarysetid);
	},
	removeUrlsFromSet: function(canarysetid, typ) {
		var currentset = Sets.findOne(canarysetid);
        if ( typ === undefined ) {
            for ( var un in currentset.urls ) {
                Meteor.call('removeUrlFromSet', currentset.urls[un].url, canarysetid);
            }            
        } else if ( typ === 'nofacts' ) {
            for ( var u in currentset.urls ) {
                if ( currentset.urls[u].facts === 0 ) {
                    Meteor.call('removeUrlFromSet', currentset.urls[u].url, canarysetid);
                }
            }            
        } else {
            for ( var un in currentset.urls ) {
                if ( currentset.urls[un][typ] ) {
                    Meteor.call('removeUrlFromSet', currentset.urls[un].url, canarysetid);
                }
            }            
        }
	}	
});


// simple methods to provide startswith and endswith info about strings
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


// get urls from getpapers results file
var geturls = function(sd, api) {
    var fln = sd + api + '_results.json';
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
            url = 'http://dx.doi.org/' + ob.DOI[0];
        }
        if ( url === false && ob.pmcid ) {
            url = 'http://europepmc.org/articles/PMC' + ob.pmcid[0].replace('PMC','');
        }
        // TODO: if no pmcid look for pmid and put together an nih pmid that could be resolved
        if (url !== false) urls.push(url);
    }
    console.log('Retrieved ' + urls.length + ' urls');
    return urls;
};


// an async method to find the end URL in a redirect chain (e.g. dereferencing DOIs)
var resolve = function(url, callback) {
	var request = Meteor.npmRequire('request');
    request.head(url, function (err, res, body) {
        if ( res === undefined ) {
            callback(null, url);
        } else {
            callback(null, res.request.uri.href);        
        }
    });
};
var aresolve = Async.wrap(resolve);


// an async method to find the DOI URL of a europepmc url
var eupmcresolve = function(url, callback) {
    var pmcid = url.split('?')[0].split('/').pop();
    var ncbi = 'http://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/?format=json&ids=' + pmcid;
	var request = Meteor.npmRequire('request');
    request.get(ncbi, function (err, res, body) {
        if ( res === undefined ) {
            console.log(err);
            callback(null, url);
        } else {
            callback(null, 'http://dx.doi.org/' + JSON.parse(res.body).records[0].doi);
        }
    });
};
var aeupmcresolve = Async.wrap(eupmcresolve);


// check for 200 - to be done before thresher because it hangs on pages that don't return
var check200 = function(url, callback) {
	var request = Meteor.npmRequire('request');
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
	fs.mkdirSync(sd);
	process.chdir(sd);
	// try to quickscrape / thresher the urls
	var thresher = Meteor.npmRequire('thresher');
	var scrapers = new thresher.ScraperBox(scraperdir);
	var t = new thresher.Thresher(scrapers);
	t.once('result', function(result, structured) {
		var boutfile = 'bib.json';
		var bib = format(structured);
		var pretty = JSON.stringify(bib, undefined, 2);
		fs.writeFileSync(boutfile, pretty);
		var routfile = 'results.json';
		fs.writeFileSync(routfile, JSON.stringify(structured,undefined,2));
        t.removeAllListeners();
        t = null;
		callback(null,bib);
    });
	t.scrape(url, true);
};
var athresh = Async.wrap(thresh);

var deleteFolderRecursive = function(path) {
	if( fs.existsSync(path) ) {
		fs.readdirSync(path).forEach(function(file,index){
			var curPath = path + "/" + file;
			if(fs.lstatSync(curPath).isDirectory()) { // recurse
				deleteFolderRecursive(curPath);
			} else { // delete file
				fs.unlinkSync(curPath);
			}
		});
		fs.rmdirSync(path);
	}
};

var saveregex = function(canarysetid,url,regex) {
	var fl = setarticledir(canarysetid,url) + 'customregex.xml';
	var content = '<compoundRegex title="custom">';
	for ( var ln in regex.split('\n') ) {
		content += '<regex>' + regex.split('\n')[ln] + '</regex>';
	}
	content += '</compoundRegex>';
	fs.writeFileSync(fl,content);
};

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
		}
		else {
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

