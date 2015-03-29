
// when a user hits the front page a set uuid should be created and user re-routed (or pushstate)
// the user can also be asked to provide a unique set name - so they will check against the list of known set names
// then that user is on that page set and they can put URLs into it
// they will also get a store folder link with the set uuid where they can find their output files
// users will run processes and the resulting facts will be stored as belonging to this page set
// there will later be an option to push the facts to the main fact store, but for now they are local stored in mongo

cmapi = 'http://cmapi.cottagelabs.com/';

var getUuid = function() {
    return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
    });
}

Sets = new Mongo.Collection("sets");
Facts = new Mongo.Collection("facts");

Router.map(function() {
    this.route('home', {
        path : '/',
        action: function() {
            this.redirect('/' + getUuid())
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
                facts : Facts.find({ set : this.params._id }, {sort : {creationAt : 'desc'}}),
                canarysetid: this.params._id
            }
        }, 
        action : function() {
            if ( Sets.findOne(this.params._id) === undefined ) {
                Meteor.call('createSet',{
                    _id: this.params._id,
                    urls: []
                })
            }
            Session.set('canarysetid', this.params._id);
            Meteor.subscribe('facts', this.params._id);
            this.render();
        }
    });
});


if (Meteor.isClient) {
    
    Meteor.startup(function () {
        setTimeout(function() {$('#urls').focus()}, 2000);
    });

    Template.canary.helpers({
        currentset: function() {
            return Sets.findOne(Session.get("canarysetid"));
        },
        urlscount: function() {
            return Sets.findOne(Session.get("canarysetid")).urls.length;
        },
        /*factdoccount: function () {
            var factdocs = [];
            var f = Facts.find({});
            for ( var i in f ) {
                if ( factdocs.indexOf(f[i]['source']) == -1 ) {
                    factdocs.push(f[i]['source']);
                }
            }
            return factdocs.length;
        },*/
        factcount: function () {
            return Facts.find({}).count();
        },
        factlist: function() {
            return Facts.find({}, {sort: {createdAt: -1}});
        }
    });

    Template.canary.events({
        "click .process": function (event) {
            var proctype = event.target.id;
            var params = {
            };
            if ( proctype == 'regex') {
                if ( $('#regexurl').val() ) {
                    params['-r.r'] = $('#regexurl').val();
                } else if ( $('#regextype').val() ) {
                    params['-r.r'] = $('#regextype').val();
                }
            }
            if ( !params['-r.r'] ) {
                alert('Choose a regex type or provide a URL to your own regex file first!');
            } else {
                //$('#'+proctype).addClass('disabled');
                Meteor.call('ami', {processor: proctype, params: params, canarysetid: Session.get("canarysetid")} );
            }
        },
        "keypress #urls": function (event) {
            var currentset = Sets.findOne(Session.get("canarysetid"));
            var urls = [];
            var knownones = [];
            var oldones = [];
            var newones = [];
            var keycode = (event.keyCode ? event.keyCode : event.which);
            if (keycode == '13') {
                var curls = $('#urls').val().split('\n');
                for ( var u in currentset.urls ) {
                    if ( curls.indexOf(currentset.urls[u]['url']) == -1 ) {
                        oldones.push(currentset.urls[u]['url']);
                    } else {
                        knownones.push(currentset.urls[u]['url']);
                        urls.push(currentset.urls[u]);
                    }
                }
                for ( var c in curls ) {
                    if ( curls[c].length > 1 ) {
                        if ( knownones.indexOf(curls[c]) == -1 ) {
                            newones.push(curls[c]);
                            urls.push({url: curls[c]});
                        }
                    }
                }
                if ( newones.length != 0 || oldones.length != 0 ) {
                    Sets.update(currentset._id, {$set: {urls: urls}});
                }
                for ( var n in oldones ) {
                    // TODO: throw away all facts about url oldones[n] for this set
                }
                for ( var n in newones ) {
                    Meteor.call('quickscrape',{url: newones[n], canarysetid: Session.get("canarysetid")})
                }
            }
        }
    });

}

if (Meteor.isServer) {
    Meteor.startup(function () {
    });
    
    Meteor.publish("sets", function (canarysetid) {
        return Sets.find(canarysetid);
    });

    Meteor.publish("facts", function (canarysetid) {
        return Facts.find({"set": canarysetid});
    });

    // TODO: MOST OF THESE METHODS HAVE REPEATED CODE - SHOULD ABSTRACT OUT TO A METHOD THAT UPDATES THE URLS DATA
    // JUST NOT DONE IT COS I AM LEARNING METEOR RIGHT NOW AND NOT THINKING TIDILY
    Meteor.methods({
        ami: function(obj) {
            console.log('starting ami ' + obj.processor);
            console.log(obj);
            var currentset = Sets.findOne(obj.canarysetid);
            var params = {
                params: obj.params
            }
            for ( var u in currentset.urls ) {
                var tu = currentset.urls[u];
                params.params.cid = tu.cid;
                // TODO: delete any facts that came from same processor on this set on this url
                if ( tu.results === undefined ) { tu.results = {}; };
                tu.results[obj.processor] = {processing: true};
                Meteor.http.call('GET', cmapi+'ami'+obj.processor, params, function(sth,res) {
                    tu.results[obj.processor] = res.data;
                    console.log(res)
                    for ( var f in res.data.facts ) {
                        var fc = res.data.facts[f];
                        fc.set = obj.canarysetid;
                        fc.url = tu.url;
                        fc.processor = obj.processor;
                        Meteor.call('createFact',fc);
                    }
                    //$('#'+obj.processor).removeClass('disabled');
                    Sets.update(currentset._id, {$set: {urls: currentset.urls}});
                });
            }
            Sets.update(currentset._id, {$set: {urls: currentset.urls}});
        },
        norma: function(obj) {
            Meteor.http.call('GET', cmapi+'norma', {params: {cid: obj.cid}}, function(sth,res) {
                var currentset = Sets.findOne(obj.canarysetid);
                for ( var u in currentset.urls ) {
                    var tu = currentset.urls[u];
                    if ( tu.url == obj.url ) {
                        if ( tu.results === undefined ) { tu.results = {}; };
                        console.log(res.data);
                        tu.results.norma = res.data;
                    }
                }
                Sets.update(currentset._id, {$set: {urls: currentset.urls}});
            });
        },
        retrieve: function(obj) {
            Meteor.http.call('GET', cmapi+'retrieve', {params: {url: obj.url, cid: obj.cid}}, function(sth,res) {
                var currentset = Sets.findOne(obj.canarysetid);
                for ( var u in currentset.urls ) {
                    var tu = currentset.urls[u];
                    if ( tu.url == obj.url ) {
                        if ( tu.results === undefined ) { tu.results = {}; };
                        tu.results.retrieve = res.data;
                        if ( res.data.retrieved ) {
                            tu.results.norma = {processing: true};
                            Meteor.call('norma',obj);
                        }
                    }
                }
                Sets.update(currentset._id, {$set: {urls: currentset.urls}});
            });
        },
        quickscrape: function(obj) {
            var currentset = Sets.findOne(obj.canarysetid);
            for ( var u in currentset.urls ) {
                var tu = currentset.urls[u];
                if ( tu.url == obj.url ) {
                    if ( tu.results === undefined ) { tu.results = {}; };
                    tu.results.quickscrape = {processing: true};
                }
            }
            Sets.update(currentset._id, {$set: {urls: currentset.urls}});
            Meteor.http.call('GET', cmapi+'quickscrape', {params: {url: obj.url}}, function(sth,res) {
                for ( var u in currentset.urls ) {
                    var tu = currentset.urls[u];
                    if ( tu.url == obj.url ) {
                        if ( tu.results === undefined ) { tu.results = {}; };
                        if ( res.data.files === undefined ) {
                            tu.results.quickscrape = {failed: true};
                        } else {
                            tu.results.quickscrape = res.data;
                            tu.cid = res.data.cid;
                            obj.cid = res.data.cid;
                            if ( res.data.files.indexOf('fulltext.html') == -1 ) {
                                // fulltext failed to be retrieved by quickscrape, so just try a retrieve on it
                                tu.results.retrieve = {processing: true};
                                Meteor.call('retrieve', obj)
                            } else {
                                // fulltext was there, so try norma
                                tu.results.norma = {processing: true};
                                Meteor.call('norma',obj);
                            }
                        }
                    }
                }
                Sets.update(currentset._id, {$set: {urls: currentset.urls}});
            });
        }
    });
}


Meteor.methods({
    createFact: function(obj) {
        var d = new Date();
        obj.createdAt = d;
        obj.updatedAt = d;
        Facts.insert(obj);
        console.log('fact created');
    },
    createSet: function (obj) {
        var d = new Date();
        obj.createdAt = d;
        obj.updatedAt = d;
        Sets.insert(obj);
        console.log('set ' + obj._id + ' created');
    }
});


