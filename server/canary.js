
import * as fs from 'graceful-fs';
import exec from 'child_process';
import {XMLHttpRequest as xmhtrq} from 'xmlhttprequest';
var cron = require ('./cron.js')
var index = require('./index.js')

// ========================================================================================
// SOME SIMPLE CONVENIENCE FUNCTIONS
// Now in markscommon.js
// ========================================================================================
// THE API ENDPOINTS, THAT CALL THE OTHER FUNCTIONS
API = new Restivus({
	prettyJson: true
});
API.addRoute('', {
	get: function() {
		return { status: 'success', data: 'ContentMine API. Link to docs once they exist' };
	}
});
API.addRoute('etl/:dailyset', {
	// dailyset form should be like 2016-06-01
	post: function() {
		cron.etl(this.urlParams.dailyset);
		return '';
	}
});
// facts - actually use nginx to configure a direct ES search route safely
// catalogue - again use ES to configure a safe direct ES search onto catalogue METADATA (so store fulltext in separate index)
API.addRoute('retrieve', {
	get: function() {
		return {}; // TODO given a URL as query param, retrieve the content of the URL into the system somehow... could also accept data on POST
		// if we do this, then the items content should be saved into a folder in the store named with some uuid, then can be extracted into an
		// index with that uuid too, then facts could be retrieved from it
	}
});
API.addRoute('extract', {
	get: function() {
		cron.extract(this.urlParams.dailyset)
		return {}; // TODO extract the content of a given source - accept a dicts param to list which dicts to run, and a query param to identify the catalogue items to run it against
	}
});
API.addRoute('dictionary', {
	get: function() {
		return {}; // TODO return a list of the filenames in the dictionary directory
	}
});
API.addRoute('dictionary/:dict', {
	get: function() {
		return {}; // TODO read named dictionary from disk and return it as json
	},
	post: function() {
		return {}; // TODO if given a URL param or POST content, read it into the dictionary directory
	},
	delete: function() {
		return {}; // TODO delete the named dict (although if it is in our repo the next git pull would pull it back in)
	}
});
API.addRoute('store', {
	get: function() {
		return {}; // TODO provide access to normalised OA items stored on disk
		// could also serve fulltexts of non-OA items if queried from inside cambridge. and if this would be useful for any reason
		// this could probably also just be served by nginx configuration
	}
});
API.addRoute('dump', {
	get: function () {
		index.dump()
		return {}
	}
})
API.addRoute('facts', {
	delete: function() {
		index.deleteAndMapFactIndex()
		return {}
	}
})
API.addRoute('metadata', {
	delete: function() {
		index.deleteAndMapMetadataIndex()
		return {}
	}
})
API.addRoute('load/cr/:set/:type', {
	get: function() {
		cron.loadCRMDAndFT(this.urlParams.set, this.urlParams.type)
		return {}
	}
})
API.addRoute('load/eupmc/:set', {
	get: function() {
		cron.loadEuPMCMDAndFT(this.urlParams.set)
		return {}
	}
})
