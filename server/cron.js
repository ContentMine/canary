import * as fs from 'fs'
var retrieve = require('./retrieve.js')
var index = require('./index.js')
var recursive=require('recursive-readdir')


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
  index.indexMetadata(dailyset);
  emptyFulltext()
  index.loadEuPMCFullTexts(Meteor.settings.storedir + '/' + dailyset)
  extractNew(dailyset)
};

var emptyFulltext = function(dailyset) {
  client = index.ESClient()
  client.delete({
    index: 'fulltext'
  })
}

//updated extraction functino being written by tom
var extractNew = function(dailyset) {
  readDictionaries(dailyset)
}

var readDictionaries = function(dailyset) {
  var dictionaries = []
  var folder = Meteor.settings.dictsdir + '/json/'
  var client = index.ESClient()
  recursive(folder, function(err, files) {
    files.forEach(function (file) {
      fs.readFile(file, 'utf8', function (err, data) {
          dictionaryQuery(JSON.parse(data), dailyset, client)
      })
    })
  })
}

// Pass it the full dictionary first time. On the last successful upload of data
// run again with the first entry removed and repeate until empty
var dictionaryQuery = function (dictionary, dailyset, client) {
  var id = dictionary.id
  setTimeout(function() {
    if (dictionary.entries.length) {
    entry = dictionary.entries.shift()
    console.log(entry)
    dictionarySingleQuery(dailyset, entry, id, dictionary, client)
    }
  }, 0)
}

var dictionarySingleQuery = function(dailyset, entry, id, dictionary, client) {
  //console.log(id)
  client.search({
    index: "fulltext",
    type: "unstructured",
    body: {
      _source: false,
      fields: ['cprojectID'],
      query: {
        match_phrase: {
          fulltext: "water"
        }
      },
      highlight: {
        encoder: "html",
        fields: {
          fulltext: {}
        }
      }
    }
  }, function (error, response) {
    if (error) {
      console.log(error)
    }
    if (!error) {
      //console.log(response)
      finalDoc = false

      if(response.hits.hits.length == 0) dictionaryQuery(dictionary, 'foo', client)
      for(var j=0; j<response.hits.hits.length; j++){
        if (j==response.hits.hits.length-1) finalDoc = true
        uploadOneDocFacts(response.hits.hits[j]._id, response.hits.hits[j].highlight.fulltext, id, dictionary, finalDoc, client, response.hits.hits[j].fields.cprojectID)
      }
    }
  })
}

//insert all the fact from one document as returned by ES
var uploadOneDocFacts = function(docId, snippetArray, dictid, dictionary, finalDoc, client, cprojectID) {
  //console.log('snippet array is: ' + snippetArray)
  finalFact = false
  for(var i=0; i<snippetArray.length; i++) {
    if (finalDoc && i==snippetArray.length-1) {finalFact=true}
    var match = snippetArray[i]
    var fact = {}
    if (match.indexOf('<em>') !== -1) {
      fact.prefix = match.split('<em>')[0];
      fact.term = match.split('<em>')[1].split('</em>')[0];
      fact.postfix = match.split('</em>')[1];
    } else {
      fact.prefix = '';
      fact.term = match;
      fact.postfix = '';
    }
    fact.prefix = unescape(fact.prefix)
    fact.term = unescape(fact.term)
    fact.postfix = unescape(fact.postfix)
    uploadOneFact(fact, docId, dictid, dictionary, finalFact, client, cprojectID)
  }
}

var uploadOneFact = function(fact, docId, dictid, dictionary, finalFact, client, cprojectID) {
  //console.log("uploading one fact")
  var client = index.ESClient()
  client.create({
    index: 'facts',
    type: 'snippet',
    body: {
      "prefix": fact.prefix,
      "post": fact.postfix,
      "term": fact.term,
      "documentID": docId,
      "dictionaryID": dictid,
      "cprojectID": cprojectID
    }
  }, function() {
    if (finalFact) dictionaryQuery(dictionary, 'foo', client)
  })
}

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

SyncedCron.add({
	name: 'ETL',
	schedule: function(parser) { return parser.text('at 1:00 am'); },
	job: function() { etl(); }
});
if (Meteor.settings.runcron) SyncedCron.start();

module.exports.etl = etl
module.exports.extract = extractNew
