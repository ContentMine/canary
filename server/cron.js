import * as fs from 'graceful-fs'
var retrieve = require('./retrieve.js')
var index = require('./index.js')
var recursive=require('recursive-readdir')
var Entities = require('html-entities').XmlEntities;
var extract = require('./extract.js')

entities = new Entities();


// ========================================================================================
// THE DAILY FUNCTIONS TO RETRIEVE AND PROCESS ARTICLES EACH DAY
var etl = function(dailyset) {
  var dts = dailyset ? dailyset : dated(delim='-');
  if(!fs.existsSync(Meteor.settings.storedir + '/' + dts)) {
    fs.mkdirSync(Meteor.settings.storedir + '/' + dts);
  }
  // TODO update to indexed (NOT published date) date query for crossref and eupmc (this is possible, but need to know how getpapers expects that)
	var qry = 'FIRST_PDATE:' + dts;
	var urls = retrieve.getpapers(qry, dts); // TODO we somehow need the metadata returned by getpapers for each URL too
  /*
	for ( var i in urls ) {
		var retrieved = retrieve.retrieve(urls[i], dts); // this creates a dir inside dts dir, named after the uid of the url
    if (retrieved) {
      if (Meteor.settings.normalise) {
        // TODO here we would call norma, to normalise the fulltext.html file if there is one in the
      }
    }
	}
  */
 loadEuPMCMDAndFT(dailyset)
};

var loadEuPMCMDAndFT = function (dailyset) {
  index.indexEuPMCMetadata(Meteor.settings.storedir + '/' + dailyset)
  emptyFulltext(function () {
    index.loadEuPMCFullTexts(Meteor.settings.storedir + '/' + dailyset, function() {extractNew(dailyset)})
  }) // chained to ensure index creation happens in the right order
}

var loadCRMDAndFT = function (setname, type) {
  index.indexCRMetadata(Meteor.settings.storedir + '/' + setname)
  emptyFulltext(function () {
    index.loadCRFullTexts(Meteor.settings.storedir + '/' + setname, 'fulltext.'+type, function() {extractNew(setname)})
  })
}

var createUnstructuredIndex = function (callback) {
  var client = index.ESClient()
  client.indices.create({
    index: 'fulltext',
    type: 'unstructured',
    body: {"mappings":{
      "unstructured":{
        "properties":{
          "cprojectID":{"type":"string"},
          "fulltext":{"type":"string","term_vector": "with_positions_offsets_payloads"}}}}
    }
  }, function (err) { console.log(err)
    callback()
  })
}

var emptyFulltext = function(callback) {
  var client = index.ESClient()
  fs.stat(Meteor.settings.storedir + '/elasticsearch.lock', (err, stats) => {
    if (!err) {
      throw 'File lock inplace, extraction in progress or delete elasticsearch.lock'
    }
    else if(err.code == 'ENOENT') {
  fs.writeFile(Meteor.settings.storedir + '/elasticsearch.lock', '', (err) => {
    client.indices.delete({
      index: 'fulltext'
    }, function (err) {
      if (err) console.log(err)
      console.log('fulltext index emptied')
      createUnstructuredIndex(callback) })
  })
}
  else throw err
  });
  // Test if lockfile in place; if so reject attempt with error
  // Else place lockfile
}

//updated extraction function being written by tom
var extractNew = function(dailyset) {
  extract.readDictionaries(dailyset)
}

/*
var extract = function(dailyset,dicts) {
	// TODO start with execing a git pull inside the dictionaries folder (can use process.chdir(<DIRNAME>) to get into the dir)
	if (dicts === undefined) dicts = []; // TODO build a list of dict filenames using the node.js fs function to list files in dicts dir - careful to strip out .git or other unwanted cruft
	var facts = []; // will storing all the facts whilst processing get too big? should they be offloaded at interval? This should be fine for now
	for ( var d in dicts ) {
		var dictname = dicts[d];
    // assumes dict is json. If we want to allow .xml, do an xml2js transform first. Or if allowing .txt for simple string lists, read and convert to JSON objects
		var dict = JSON.parse(fs.readFileSync(dictdir + dictname));
		for (var r in dict) {
			var dictrow = dict[r];
			// issue a query to the flat fulltext processing index
      // later we could also issue special queries to the structured fulltext index, but we don't do that yet
      var from = 0;
      var size = 10000;
      // assume regex query starts with /, string is just a string, and full query is an object
      // regex and string will be executed against the "text" field, which should be populated by the indexMetadata function
      var resp = query(dictrow.query,size,from,dailyset,'flat');
      var total = resp && resp.hits && resp.hits.total ? resp.hits.total : 0;
      while (from < total) {
        if (from !== 0) resp = query(dictrow.query,size,from,dailyset,'flat');
        from += size;
        for ( var rr in resp.hits.hits ) {
          var res = resp.hits.hits[rr]._source ? resp.hits.hits[rr]._source : resp.hits.hits[rr]._fields;
          var matches = res.highlight ? res.highlight.text : [''];
          for ( var m in matches ) {
            var match = matches[m];
            var fact = [];
            fact.query = dictrow.query;
            if (match.length > 0) {
              if (match.indexOf('<em>') !== -1) {
                fact.pre = match.split('<em>')[0];
                fact.match = match.split('<em>')[1].split('</em>')[0];
                fact.post = match.split('</em>')[1];
              } else {
                fact.pre = '';
                fact.match = match;
                fact.post = '';
              }
            } else {
              fact.match = match; // TODO on custom queries this may need to be better represented
            }
            for ( var k in dictrow ) fact[k] = dictrow[k];
            fact.set = dailyset;
						fact.dictionary = dictname;
            // TODO check where these values are actually put in the processing index records
            // NOTE we don't want the entire record bc it would contain the fulltext and perhaps other things we don't want permanently related to the fact
            fact.url = res.url;
            fact.title = res.title;
            fact.author = res.author;
            fact.journal = res.journal;
            facts.push(fact);
          }
        }
      }
		}
	}
	bulkload(facts,'/facts/'+dailyset,true);
	// once this process is complete the flat and structured fulltext indexes for the day could be dumped (but keep the catalogue metadata-only index)
}
*/

SyncedCron.add({
	name: 'ETL',
	schedule: function(parser) { return parser.text('at 1:00 am'); },
	job: function() { etl(); }
});
if (Meteor.settings.runcron) SyncedCron.start();

module.exports.etl = etl
module.exports.extract = extractNew
module.exports.loadCRMDAndFT = loadCRMDAndFT
module.exports.loadEuPMCMDAndFT = loadEuPMCMDAndFT
