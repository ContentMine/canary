
var userdir = '/home/cloo';
var regexesdir = userdir + '/dev/contentmine/src/ami-regexes/';
var scraperdir = userdir + '/dev/contentmine/src/journal-scrapers/scrapers/';
var setsdir = userdir + '/cm/sets/';
var articlesdir = userdir + '/cm/articles/';

var storeurl = 'http://store.contentmine.org/';
var factsurl = 'http://facts.contentmine.org/';

var factsindexurl = 'http://gateway:9200/contentmine/fact/';

var catindexurl = function() {
	// TODO if running locally should return a canary api url that will handle uploads from local installs
	return 'http://gateway:9200/catalogue/record/';
};

var runlocal = false;
var sendremote = true;
if ( runlocal ) {
    userdir = '/home/workshop/workshop';
    regexesdir = userdir + '/regexes/';
    scraperdir = userdir + '/journal-scrapers/scrapers/';
    setsdir = userdir + '/cm/sets/';
    articlesdir = userdir + '/cm/articles/';
    
    storeurl = 'file://' + userdir + '/cm/sets/';
    factsurl = 'http://facts.contentmine.org/';
}
var remotefactsindexurl = function(canarysetid) {
    return 'http://canary.contentmine.org/api/sets/' + canarysetid + '/facts/receive';
};

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


var uuid = function() {
    return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
    });
};

Sets = new Mongo.Collection("sets");
Facts = new Mongo.Collection("facts");

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
                        urls: [],
                        articles: [],
                        failed: [],
                        processed: [],
                        processes: []
                    });
                }
                Session.set('canarysetid', this.params._id);
                Meteor.subscribe('facts', this.params._id);
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
		if ( !currentset.processed[proc] ) {
			return false;
		} else {
			var diff = 0;
			for ( var i in currentset.articles ) {
				if ( currentset.processed[proc].indexOf(currentset.articles[i]) == -1 ) {
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
		return Sets.findOne(Session.get("canarysetid")).articles.length;
	});
	Template.registerHelper('currentset', function () {
        return Sets.findOne(Session.get("canarysetid"));
	});
	Template.registerHelper('processing', function () {
        return Session.get("processing");
	});

    Template.canary.helpers({
		uidlink: function(url) {
			return storeurl + Session.get("canarysetid") + '/' + encodeURIComponent(uid(url)) + '/';
		},
		facturl: function(fid) {
			return factsurl + fid;
		},
 		terms: function(set,collection,field) {
			return Meteor.call('terms',set,collection,field);
		},
		hasfacts: function(url) {
			return Facts.find({url: url}).count();
		},
		wasprocessed: function(url) {
            var currentset = Sets.findOne(Session.get("canarysetid"));
			var ret = false;
			for ( var k in currentset.processed ) {
				for ( var i in currentset.processed[k] ) {
					if ( currentset.processed[k][i] === url ) { ret = true; }
				}
			}
			return ret;
		},
		allarticledorfailed: function() {
            var currentset = Sets.findOne(Session.get("canarysetid"));
			if ( currentset.urls.length === 0 ) { return false; }
			return currentset.articles.length + currentset.failed.length === currentset.urls.length;
		},
        urlscount: function() {
            return Sets.findOne(Session.get("canarysetid")).urls.length;
        },
        failedcount: function() {
            return Sets.findOne(Session.get("canarysetid")).failed.length;
        },
        nofactscount: function() {
            // for each article check if there are any facts for it, and return the count of articles with no facts
            var s = Sets.findOne(Session.get("canarysetid"));
            nofacts = 0;
            for ( var u in s.articles ) {
                if ( Facts.find({url: s.articles[u]}).count() === 0 ) nofacts += 1;
            }
            return nofacts;
        },
        factcount: function () {
            return Facts.find({}).count();
        },
        factlist: function() {
            return Facts.find({}, {sort: {createdAt: -1}});
        },
		retrieved: function(url) {
            var s = Sets.findOne(Session.get("canarysetid"));
			if ( s.articles.indexOf(url) == -1 ) {
				return false;
			} else {
				return true;
			}
		},
		failed: function(url) {
            var s = Sets.findOne(Session.get("canarysetid"));
			if ( s.failed.indexOf(url) == -1 ) {
				return false;
			} else {
				return true;
			}
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
        "click #visfacts": function (event) {
            //Meteor.call('visfacts',{canarysetid: Session.get("canarysetid")});
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
    Meteor.publish("facts", function (canarysetid) {
        return Facts.find({set: canarysetid});
    });

	Restivus.configure({
		useAuth: true,
		prettyJson: true
	});
	Restivus.addCollection(Facts);
	Restivus.addCollection(Sets);
    Restivus.addRoute('remove/:coll', {
        delete: function() {
            if ( this.urlParams.coll === 'facts' ) {
                Facts.remove({});
            } else if ( this.urlParams.coll === 'sets' ) {
                Sets.remove({});
            }
            return '';
        }
    });
	Restivus.addRoute('sets/:canarysetid/facts', {
		get: function() {
			return {status: 'success', data: Facts.find({set: this.urlParams.canarysetid}, {sort: {createdAt: -1}}).fetch() };
		}
	});
	Restivus.addRoute('sets/:canarysetid/facts/receive', {
		get: function() {
			return "yes, you could POST your facts here";
		},
		post: function() {
            var bulk = this.request.body;
            console.log(bulk);
			Meteor.call('indexFacts',this.urlParams.canarysetid, bulk);
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
		
    var dated = function( delim, less ) {
        if ( delim === undefined ) delim = '';
        if ( less === undefined ) less = 3;
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
	SyncedCron.add({
		name: 'Create daily set',
		schedule: function(parser) {
			return parser.text('at 2:30 am');
		},
		job: function() {
            if ( Sets.findOne( todayset() ) === undefined ) {
                Meteor.call('createSet',{
                    _id: todayset(),
                    urls: [],
                    articles: [],
                    failed: [],
                    processed: [],
                    processes: []
                });
            }
            var qry = 'FIRST_PDATE:' + dated(delim='-') + ' JOURNAL:"plos one"';
			Meteor.call('getPapers', qry, todayset() );
		}
	});
	SyncedCron.add({
		name: 'Process daily set',
		schedule: function(parser) {
			return parser.text('at 6:00 am');
		},
		job: function() {
            var availableProcesses = ['species','identifier','gene','sequence','phylo'];
            for ( var i in availableProcesses ) {
                Meteor.call('process', {
                    processor: availableProcesses[i],
                    canarysetid: todayset()
                });
            }
		}
	});
	SyncedCron.start();
	
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
    sets: function() {
        return {
            sets: Sets.find({}).fetch(), 
            count: Sets.find({}).count()
        };
    },
	terms: function(collection,field,match,simple) {
        if ( !collection ) { collection = 'facts'; }
        if ( !field ) { field = 'fact'; } // TODO: check if field has commas, if so split and do terms across multiple fields
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
		if ( collection.toLowerCase() === 'facts' ) { // TODO: should be a dynamic call to the collection
			vals = Facts.aggregate(qry);
        } else if ( collection.toLowerCase() === 'sets' ) {
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
		if ( !currentset.processed ) { currentset.processed = {}; }
		if ( !currentset.processed[params.processor] ) { currentset.processed[params.processor] = []; }
		if ( params.rerun ) {
			currentset.processed[params.processor] = [];
			Meteor.call('removeFacts', undefined, params.processor);
		}
		var size = currentset.articles.length - currentset.processed[params.processor].length;
		for ( var i in currentset.articles ) {
			var url = currentset.articles[i];
			if ( currentset.processed[params.processor].indexOf(url) == -1 ) {
				var sd = setarticledir(params.canarysetid,url);
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
						cmd += ' -r.r ' + setarticledir(params.canarysetid, url) + 'customregex.xml';
					} else {
						cmd += ' -r.r ' + regexdir(regex);
					}
				}
				if ( proc == 'species' ) {
					cmd += ' --sp.species --context 100 100 --sp.type binomial genus genussp';
				}
				var child = aexec(cmd);
				currentset.processed[params.processor].push(url);
				var sds = sd + 'results/' + params.processor.replace('-','/') + '/';
				Meteor.call('loadFacts',sd,params.canarysetid,params.processor,url);
			}
		}
		currentset.inprocess = false;
		Sets.update(params.canarysetid, {$set: {
			processed: currentset.processed
		}});
		console.log('process ' + params.processor + ' finished for ' + params.canarysetid);
	},
	normalise: function(url, canarysetid) {
		console.log('about to normalise ' + url);
		var sd = articledir(url);
		var input = 'fulltext.xml';
		// if there is no fulltext.xml in the directory, look for a fulltext.html and make that the input instead
		var xsl = 'nlm2html';
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
			var meta = athresh(sd, url);
			console.log(meta);
			console.log('thresher finished');
			// if fulltext.html not retrieved, try to get the url directly
			if ( !fs.existsSync(sd + 'fulltext.html') ) {
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
			} else {
				// try to normalise the retrieved content
				Meteor.call('normalise', url, canarysetid);
			}
			//Meteor.call('indexMetadata',meta);
		} else {
			// we already have this url, if a canarysetid was provided then copy it over
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
		var cmd = "getpapers --query '" + searchstr + "' --outdir " + sd + ' --all';
		var child = aexec(cmd);
		console.log('getpapers finished - now processing fulltext urls file');
		// now read the list of URLs that came out of the search
		var urls = fs.readFileSync(sd + 'fulltext_html_urls.txt').toString().split("\n");
		for ( var i in urls ) {
			Meteor.call('addUrlToSet', urls[i], canarysetid);
		}
	},
	
	createFact: function(obj) {
		var d = new Date();
		obj.createdAt = d;
		obj.updatedAt = d;
		Facts.insert(obj);
		console.log('fact created');
	},
	loadFacts: function(sd,canarysetid,proc,url) {
		console.log('loading facts for ' + canarysetid + ' ' + proc + ' ' + url);
		var facts = readFacts(sd);
		console.log('facts retrieved');
		//console.log(JSON.stringify(facts,undefined,2));
		for ( var c in facts ) {
			var fct = facts[c];
			fct.set = canarysetid;
			fct.processor = proc;
			fct.url = url;
			Meteor.call('createFact', fct);
		}
		Meteor.call('indexFacts',canarysetid);
	},
	indexFacts: function(canarysetid, bulk) {
		console.log('uploading facts to catalogue for ' + canarysetid);
        var frl = factsindexurl + '_bulk';
        if ( !runlocal ) {
            var frld = frl.replace('_bulk','_query') + '?q=set:' + canarysetid;
            // TODO: this should do a scroll query then bulk delete - delete by query is deprecated and not performant
            Meteor.http.call('DELETE', frld, { data: bulk });            
        }
        if ( bulk === undefined ) {
    		var facts = Facts.find({set: canarysetid}).fetch();
            bulk = '';
            for ( var i in facts ) {
                facts[i].id = facts[i]._id;
                bulk +=  '{index:{_id:"' + facts[i]._id + '"}}\n';
                bulk += JSON.stringify( facts[i] ) + '\n';
            }
        } else {
            console.log('a remote bulk set has been received');
        }
        if ( runlocal ) { frl = remotefactsindexurl(canarysetid); }
        if ( !runlocal || ( runlocal && sendremote ) ) {
            var xhr = new xmhtrq();
            xhr.open('POST', frl, true);
            xhr.onreadystatechange = function() {
                if ( xhr.readyState==4 ){
                    //console.log(xhr.responseText);
                }
            };
            xhr.send(bulk);
            console.log('facts sent to index at ' + frl);            
        }
    },
	indexMetadata: function(meta) {
		console.log('uploading metadata to catalogue');
		// TODO should check for the article url / doi / other ID in the catalogue first, 
		// and just add the url to it if not already known, and record which one links to the file dump
		Meteor.http.call('POST', catindexurl(), { data: meta });
	},
	removeFacts: function(url, processor) {
		var obj = {};
		if ( url !== undefined ) { obj.url = url; }
		if ( processor !== undefined ) { obj.processor = processor; }
		Facts.remove(obj);
		console.log('facts for ' + url + ' removed');
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
		if ( currentset.failed.indexOf(url) == -1 ) {
			currentset.failed.push(url);
			Sets.update(canarysetid, {$set: {failed: currentset.failed}});
		}
		console.log('failed article ' + url + 'added to set ' + canarysetid);
	},
	addArticleToSet: function(url, canarysetid) {
		var currentset = Sets.findOne(canarysetid);
		if ( currentset.articles.indexOf(url) == -1 ) {
			// copy the article dir into the set
			var sd = articledir(url);
			var sdr = setarticledir(canarysetid,url);
			fs.mkdirSync(sdr);
			var cmd = 'ln -s ' + sd + '* ' + sdr;
			var child = aexec(cmd);
			currentset.articles.push(url);
			Sets.update(canarysetid, {$set: {articles: currentset.articles}});
			console.log('article ' + url + ' added to set ' + canarysetid);
		}
	},
	addUrlToSet: function(url, canarysetid) {
        if ( url.indexOf('10') === 0 ) {
            url = 'http://dx.doi.org/' + url;
        }
        if ( url.indexOf('dx.doi.org') !== -1 ) {
            console.log('Attempting to resolve the redirect of ' + url);
            url = aresolve(url);
            console.log('URL is now ' + url);
        }
		var currentset = Sets.findOne(canarysetid);
		if ( currentset.urls.indexOf(url) == -1 ) {
			currentset.urls.push(url);
			Sets.update(canarysetid, {$set: {urls: currentset.urls}});
		}
		console.log('url ' + url + ' added to set ' + canarysetid);
		Meteor.call('retrieve', url, canarysetid);
	},
	removeUrlFromSet: function(url, canarysetid) {
		var currentset = Sets.findOne(canarysetid);
		var uidx = currentset.urls.indexOf(url);
		if ( uidx > -1 ) { currentset.urls.splice(uidx, 1); }
		var aidx = currentset.articles.indexOf(url);
		if ( aidx > -1 ) { currentset.articles.splice(aidx, 1); }
		var fidx = currentset.failed.indexOf(url);
		if ( fidx > -1 ) { currentset.failed.splice(fidx, 1); }
		for ( var key in currentset.processed ) {
			if ( currentset.processed.hasOwnProperty(key) ) {
				var pidx = currentset.processed[key].indexOf(url);
				if ( pidx > -1 ) { currentset.processed[key].splice(pidx, 1); }
			}
		}
		Sets.update(canarysetid, {$set: {
			urls: currentset.urls,
			articles: currentset.articles,
			failed: currentset.failed,
			processed: currentset.processed
		}});
		deleteFolderRecursive(setarticledir(canarysetid,url));
		Meteor.call('removeFacts', url);
		console.log('url ' + url + ' removed from set ' +  canarysetid);
	},
	removeUrlsFromSet: function(canarysetid, typ) {
		var currentset = Sets.findOne(canarysetid);
		if ( !typ ) { typ = 'articles'; }
        if ( typ === 'nofacts' ) {
            for ( var u in currentset.articles ) {
                if ( Facts.find({url: s.articles[u]}).count() === 0 ) {
                    Meteor.call('removeUrlFromSet', s.articles[u], canarysetid);
                }
            }
            return nofacts;
            
        } else {
            for ( var i in currentset[typ] ) {
                if ( typ === 'processed' ) {
                    Meteor.call('removeUrlFromSet', i, canarysetid);
                } else {
                    Meteor.call('removeUrlFromSet', currentset[typ][i], canarysetid);            
                }
            }            
        }
	}	
});



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


var resolve= function(url, callback) {
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

var forprocess = function(fl,proc) {
	var ret = false;
	if ( fl.endsWith('results.xml') ) {
		ret = true;
		if ( proc !== undefined ) {
			var parts = proc.split('-');
			for ( var i in parts ) {
				if ( fl.indexOf(parts[i]) == -1 ) {
					ret = false;
				}
			}			
		}
	}
	return ret;
};
var readFacts = function(sd,proc) {
	var facts = [];
	var files = walk(sd);
	console.log('retrieved filelist for ' + sd);
	console.log(JSON.stringify(files,undefined,2));
	for ( var fl in files ) {
		if ( forprocess(files[fl],proc) ) {
			console.log('doing file ' + files[fl]);
			var fcts = atranslate(files[fl]);
			for ( var i in fcts ) {
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

