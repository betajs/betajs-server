BetaJS.Databases.Database.extend("BetaJS.Databases.MongoDatabase", {

    constructor : function(db) {
        if (BetaJS.Types.is_string(db)) {
            this.__dbUri = BetaJS.Strings.strip_start(db, "mongodb://");
            this.__dbObject = this.cls.uriToObject(db);
        } else {
            db = BetaJS.Objs.extend({
                database : "database",
                server : "localhost",
                port : 27017
            }, db);
            this.__dbObject = db;
            this.__dbUri = this.cls.objectToUri(db);
        }
        this._inherited(BetaJS.Databases.MongoDatabase, "constructor");
        this.mongo_module = require("mongodb");
    },

    _tableClass : function() {
        return BetaJS.Databases.MongoDatabaseTable;
    },

    mongo_object_id : function(id) {
        return this.mongo_module.BSONNative.ObjectID;
    },

    mongodb : function() {
    	if (this.__mongodb)
    		return BetaJS.Promise.value(this.__mongodb);
    	var promise = BetaJS.Promise.create();
        this.mongo_module.MongoClient.connect('mongodb://' + this.__dbUri, {
            server: {
                'auto_reconnect': true
            }
        }, promise.asyncCallbackFunc());
        return promise.success(function (db) {
        	this.__mongodb = db;
        }, this);
    },

    destroy : function() {
        this._inherited(BetaJS.Databases.MongoDatabase, "destroy");
    }
}, {

    uriToObject : function(uri) {
        var parsed = BetaJS.Net.Uri.parse(uri);
        return {
            database : BetaJS.Strings.strip_start(parsed.path, "/"),
            server : parsed.host,
            port : parsed.port,
            username : parsed.user,
            password : parsed.password
        };
    },

    objectToUri : function(object) {
        object["path"] = object["database"];
        return BetaJS.Net.Uri.build(object);
    }
}); 