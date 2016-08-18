var recursive=require('recursive-readdir')
var elasticsearch = require('elasticsearch');
import * as _ from 'lodash'
var path=require('path')
import * as fs from 'fs'
import {XMLHttpRequest as xmhtrq} from 'xmlhttprequest';
var AgentKeepAlive = require('agentkeepalive');
elasticdump = require('elasticdump')


// =====================================================================================
// FUNCTIONS TO GET CONTENT INTO THE INDEX
// recursively looks through a given folder to upload eupmc_result.json contents
// to elastic search
var ESClient = function () {
	var client = new elasticsearch.Client({
		hosts: Meteor.settings.elastichosts,
		maxSockets: 20,
    createNodeAgent(connection, config) {
	    return new AgentKeepAlive(connection.makeAgentConfig(config));
    }
	})
	return client
}

var uploadJSONFileToES =  function(file, index, type, client, cprojectID) {
	fs.readFile(file, function (err, data) {
		document = JSON.parse(data)
		document.cprojectID = cprojectID
		client.create({
			index: index,
			type: type,
			body: document
		})
	})
}

var uploadXMLFileToES = function(file, index, type, client, cprojectID, cb) {
	fs.readFile(file, function (err, data) {
		client.create({
			index: index,
			type: type,
			body: {
				"fulltext": data.toString('utf8'),
				"cprojectID": cprojectID
			}
		}, cb)
	})
}

var loadEuPMCFullTexts = function(folder, cb) {
	var client = ESClient()
	console.log("reading fulltexts from disk")
	recursive(folder, function(err, files) {
		var done = _.after(files.length, function() { cb()
			console.log("done all loading of files")
		})
		files.forEach(function (file) {
			if(path.basename(file)=="fulltext.xml") {
				var cprojectID = path.basename(path.dirname(file))
				//console.log("uploading fulltext from CProject: " + cprojectID)
				uploadXMLFileToES(file, 'fulltext', 'unstructured', client, cprojectID, done)
			}
			else {
				done()
			}
		})
	})
}

var indexEuPMCMetadata = function(folder) {
	var client = ESClient()
	console.log(folder)
	recursive(folder, function(err, files) {
		files.forEach(function (file) {
	    if(path.basename(file)=="eupmc_result.json") {
				cprojectID = path.basename(path.dirname(file))
				//console.log("Uploading file with cprojectID: " + cprojectID)
	    	uploadJSONFileToES(file, 'metadata', 'eupmc', client, cprojectID)
	    }
	  })
	})
}

var indexMetadata = function(dailyset) {
	indexEuPMCMetadata(Meteor.settings.storedir + '/' + dailyset)
  // for every metadata record, use the folder name (the URL uid) as the _id for the record
  //bulkload(metadata,'/catalogue/'+dailyset,true);
  var mdwithflattext = [];
  //var mdwithstructuredtext = [];
  // for every metadata record look in its folder and see if there is a fulltext.txt
  //for ( var m in metadata) {
    // look for the fulltext.txt file and read in the content of it to metadata[m].text
    // if the fulltext was found, then mdwithflattext.push(metadata[m])
  //}
  // if (mdwithflattext.length > 0) bulkload(mdwithflattext,'/flat/'+dailyset,true);
  // if norma processing is enabled, and structured fulltext can also be found in a scholarly.html file,
  // then the loop above could also popualte the mdwithstructuredtext array, and that too could be bulkloaded to '/structured/'+dailyset
}

var query = function(qry,from,size,set,index) {
  if (from === undefined) from = 0;
  if (size === undefined) size = 100;
  if (index === undefined) index = 'facts';
  // filter queries are much faster, but cannot get highlight matches out of them - so use standard queries
  // https://www.elastic.co/guide/en/elasticsearch/reference/1.4/search-request-highlighting.html
  var qr = {
    query: {},
    from: from,
    size:size
  }
  if (index !== 'facts') {
    qr.highlight = {
      fields: {
        text:{
          fragment_size:200,
          number_of_fragments:200 // this is a max
        }
      }
    }
  }
  if (qry.indexOf('/') === 0) {
    // https://www.elastic.co/guide/en/elasticsearch/reference/1.4/query-dsl-regexp-filter.html
    qr.query.regexp = {text:qry};
  } else if (typeof qry === 'object') {
    // allows to pass any query in. There are many highly customisable query types that ES could handle,
    // and these could be passed straight in from dicts with query pointing to full query objects (if they are in json this would be easy)
    // read ES docs https://www.elastic.co/guide/en/elasticsearch/reference/1.4/query-dsl.html and/or ask MM
    qr.query = qry;
  } else {
    // https://www.elastic.co/guide/en/elasticsearch/reference/1.4/query-dsl-term-filter.html
    qr.query.term = {text:qry};
  }
  var qrl = Meteor.settings.indexurl + '/' + index + '/';
  if (set) qrl += set + '/';
  qrl += '_search';
  return Meteor.http.call('POST',qrl,{data:qr}).data;
}

var bulkload = function(records,route,create) {
  if (create) {
    // delete the index at the route it if exists
    // create the index with mapping
  }
	var bulk = '';
	for ( var i in records ) {
		if ( records[i]._id === undefined ) {
  		bulk +=  '{create:{}}\n'; // TODO check this is correct syntax for ES bulk create
    } else {
  		bulk +=  '{index:{_id:"' + records[i]._id + '"}}\n';
    }
		bulk += JSON.stringify( records[i] ) + '\n';
	}
	var frl = Meteor.settings.indexurl + route + '/_bulk';
	var xhr = new xmhtrq();
	xhr.open('POST', frl, true);
	xhr.send(bulk);
	console.log(records.length + ' records sent to ' + route);
}

var defaultEDOptions = {
  limit:           100,
  offset:          0,
  debug:           false,
  type:            'data',
  delete:          false,
  maxSockets:      null,
  input:           'http://'+Meteor.settings.elastichosts[0]+':'+Meteor.settings.elasticport,
  'input-index':   '_all',
  output:          Meteor.settings.userdir+'/'+'dump-'+new Date().toISOString()+'.json',
  'output-index':  null,
  inputTransport:  null,
  outputTransport: null,
  searchBody:      null,
  sourceOnly:      false,
  jsonLines:       false,
  format:          '',
  'ignore-errors': false,
  scrollTime:      '10m',
  timeout:         null,
  toLog:           null,
  awsAccessKeyId:    null,
  awsSecretAccessKey:null,
}

var dump = function() {
	var date = new Date();
	var outfile = Meteor.settings.userdir+'/'+'dump-'+date.toISOString()+'.json'
	var ed = new elasticdump.elasticdump('http://'+Meteor.settings.elastichosts[0]+':'+Meteor.settings.elasticport+'/_all', outfile, defaultEDOptions)
	ed.on('log',   function(message){ console.log('log' + message); });
	ed.on('debug', function(message){ console.log();('debug' + message); });
	ed.on('error', function(error){   console.log('error' + 'Error Emitted => ' + ( error.message || JSON.stringify(error)) ); });
	ed.dump()

}

module.exports.indexMetadata = indexMetadata
module.exports.bulkload = bulkload
module.exports.loadEuPMCFullTexts = loadEuPMCFullTexts
module.exports.ESClient = ESClient
module.exports.dump = dump
