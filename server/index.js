
// =====================================================================================
// FUNCTIONS TO GET CONTENT INTO THE INDEX
var indexMetadata = function(dailyset) {
	console.log('uploading metadata to catalogue');
  // TODO use fs to read a list of every folder in the dailyset directory
  // for every folder in there, look in it for the metadata, if that is where the retrieve operation put them
  // this depends on what we find out about getpapers and the metadata returned by the query
  var metadata = [];
  // for every metadata record, use the folder name (the URL uid) as the _id for the record
  bulkload(metadata,'/catalogue/'+dailyset,true);
  var mdwithflattext = [];
  //var mdwithstructuredtext = [];
  // for every metadata record look in its folder and see if there is a fulltext.txt
  for ( var m in metadata) {
    // look for the fulltext.txt file and read in the content of it to metadata[m].text
    // if the fulltext was found, then mdwithflattext.push(metadata[m])
  }
  if (mdwithflattext.length > 0) bulkload(mdwithflattext,'/flat/'+dailyset,true);
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
  var qrl = indexurl + '/' + index + '/';
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
	var frl = indexurl + route + '/_bulk';
	var xhr = new xmhtrq();
	xhr.open('POST', frl, true);
	xhr.send(bulk);
	console.log(records.length + ' records sent to ' + route);  
}

