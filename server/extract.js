var fs = require('fs')
var index = require('./index.js')
var recursive=require('recursive-readdir')
var Entities = require('html-entities').XmlEntities;
entities = new Entities();

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
    //console.log(entry)
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
          fulltext: entry.term
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
        uploadOneDocFacts(response.hits.hits[j]._id, response.hits.hits[j].highlight.fulltext, id, dictionary, finalDoc, client, response.hits.hits[j].fields.cprojectID, entry.identifiers)
      }
    }
  })
}

//insert all the facts from one document as returned by ES
var uploadOneDocFacts = function(docId, snippetArray, dictid, dictionary, finalDoc, client, cprojectID, identifiers) {
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
    fact.prefix = entities.decode(fact.prefix)
    fact.term = entities.decode(fact.term)
    fact.postfix = entities.decode(fact.postfix)
    console.log(match)
    uploadOneFact(fact, docId, dictid, dictionary, finalFact, client, cprojectID, identifiers)
  }
}

var uploadOneFact = function(fact, docId, dictid, dictionary, finalFact, client, cprojectID, identifiers) {
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
      "cprojectID": cprojectID,
      "identifiers": identifiers
    }
  }, function() {
    if (finalFact) dictionaryQuery(dictionary, 'foo', client)
  })
}

module.exports.readDictionaries = readDictionaries
