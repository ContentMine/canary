var fs = require('fs')
var index = require('./index.js')
var recursive=require('recursive-readdir')
var Entities = require('html-entities').XmlEntities;
var entities = new Entities();
var _ = require('lodash')

var numberOfFiles
var finished

var readDictionaries = function(dailyset) {
  var dictionaries = []
  var folder = Meteor.settings.dictsdir + '/json/'
  var client = index.ESClient()
  console.log("starting extraction")
  recursive(folder, function(err, files) {
    numberOfFiles = files.length
    finished = _.after(numberOfFiles, () => {
      fs.unlink(Meteor.settings.storedir + '/elasticsearch.lock', (err) => {
        if (err) throw err
        console.log('all extractions finished')
      })
    })
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
    var entry = dictionary.entries.shift()
    //console.log(entry)
    dictionarySingleQuery(dailyset, entry, dictionary, client)
    } else {
      console.log("finished extraction")
      finished()
      //call finished function
      return
    }
  }, 0)
}

var dictionarySingleQuery = function(dailyset, entry, dictionary, client) {
  //console.log(id)
  client.search({
    index: "fulltext",
    type: "unstructured",
    body: {
      _source: false,
      fields: ['cprojectID'],
      query: {
        match_phrase: {
          fulltext: entry.term
        }
      },
      highlight: {
        encoder: "html",
        fields: {
          fulltext: { boundary_chars: '.,!?\t\n'}
        }
      }
    }
  }, function (error, response) {
    if (error) {
      console.log(error)
    }
    if (!error) {
      //console.log(response)

      if(response.hits.hits.length == 0) {
        dictionaryQuery(dictionary, 'foo', client)
      } else {
      for(var j=0; j<response.hits.hits.length; j++){
        uploadOneDocFacts(response.hits.hits[j], dictionary, entry, client)
      }
    dictionaryQuery(dictionary, 'foo', client)
  }
  }
  })
}

//insert all the facts from one document as returned by ES
var uploadOneDocFacts = function(oneDocFacts, dictionary, entry, client) {
  //console.log('snippet array is: ' + snippetArray)
  var snippetArray = oneDocFacts.highlight.fulltext
  for(var i=0; i<snippetArray.length; i++) {
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
    fact.prefix = entities.decode(fact.prefix)
    fact.term = entities.decode(fact.term)
    fact.postfix = entities.decode(fact.postfix)
    fact.docId = oneDocFacts._id
    fact.cprojectID = oneDocFacts.fields.cprojectID
    uploadOneFact(fact, dictionary, entry, client)
  }
}

var uploadOneFact = function(fact, dictionary, entry, client) {
  //console.log("uploading one fact")
  client.create({
    index: 'facts',
    type: 'snippet',
    body: {
      "prefix": fact.prefix,
      "post": fact.postfix,
      "term": fact.term,
      "documentID": fact.docId,
      "cprojectID": fact.cprojectID,
      "identifiers": entry.identifiers
    }
  }, function(err) {
    if (err) console.log(err)
  })
}

module.exports.readDictionaries = readDictionaries
