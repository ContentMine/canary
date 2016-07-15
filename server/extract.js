var fs = require('fs')
var index = require('./index.js')
var recursive=require('recursive-readdir')
var Entities = require('html-entities').XmlEntities;
entities = new Entities();

var readDictionaries = function(dailyset) {
  var dictionaries = []
  var folder = Meteor.settings.dictsdir + '/json/'
  var client = index.ESClient()
  console.log("starting extraction")
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
    dictionarySingleQuery(dailyset, entry, dictionary)
    }
    else {
      console.log("finished extraction")
    }
  }, 0)
}

var dictionarySingleQuery = function(dailyset, entry, dictionary) {
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
        uploadOneDocFacts(response.hits.hits[j], dictionary, finalDoc, entry, client)
      }
    }
  })
}

//insert all the facts from one document as returned by ES
var uploadOneDocFacts = function(oneDocFacts, dictionary, finalDoc, entry, client) {
  //console.log('snippet array is: ' + snippetArray)
  finalFact = false
  var snippetArray = oneDocFacts.highlight.fulltext
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
    fact.docId = oneDocFacts._id
    fact.cprojectID = oneDocFacts.fields.cprojectID
    uploadOneFact(fact, dictionary, finalFact, entry)
  }
}

var uploadOneFact = function(fact, dictionary, finalFact, entry, client) {
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
  }, function() {
    if (finalFact) dictionaryQuery(dictionary, 'foo')
  })
}

module.exports.readDictionaries = readDictionaries
