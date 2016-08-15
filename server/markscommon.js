var Async = require('async')

var uid = function(url) {
	return url.replace(/\/+/g, '_').replace(/:/g, '');
};

var uuid = function() {
	return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
		var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
		return v.toString(16);
	});
};

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
var todayset = function() {
	return 'daily' + dated();
};

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

module.exports = {
  dated:dated,
  todayset:todayset,
  aexec:aexec,
  uid:uid,
  uuid:uuid,
}
