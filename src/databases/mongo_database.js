Scoped.define("module:Databases.MongoDatabase", [      
        "module:Databases.Database",
        "module:Databases.MongoDatabaseTable",
        "base:Strings",
        "base:Types",
        "base:Objs",
        "base:Promise",
        "base:Net.Uri"
    ], function (Database, MongoDatabaseTable, Strings, Types, Objs, Promise, Uri, scoped) {
    return Database.extend({scoped: scoped}, function (inherited) {
    	return  {
		
		    constructor : function(db) {
		        if (Types.is_string(db)) {
		            this.__dbUri = Strings.strip_start(db, "mongodb://");
		            this.__dbObject = this.cls.uriToObject(db);
		        } else {
		            db = Objs.extend({
		                database : "database",
		                server : "localhost",
		                port : 27017
		            }, db);
		            this.__dbObject = db;
		            this.__dbUri = this.cls.objectToUri(db);
		        }
		        inherited.constructor.call(this);
		        this.mongo_module = require("mongodb");
		    },
		
		    _tableClass : function() {
		        return MongoDatabaseTable;
		    },
		
		    mongo_object_id : function(id) {
		        return this.mongo_module.ObjectID;
		    },
		
		    mongodb : function() {
		    	if (this.__mongodb)
		    		return Promise.value(this.__mongodb);
		    	var promise = Promise.create();
		        this.mongo_module.MongoClient.connect('mongodb://' + this.__dbUri, {
		            server: {
		                'auto_reconnect': true
		            }
		        }, promise.asyncCallbackFunc());
		        return promise.success(function (db) {
		        	this.__mongodb = db;
		        }, this);
		    }
		};
		
    }, {
	
	    uriToObject : function(uri) {
	        var parsed = Uri.parse(uri);
	        return {
	            database : Strings.strip_start(parsed.path, "/"),
	            server : parsed.host,
	            port : parsed.port,
	            username : parsed.user,
	            password : parsed.password
	        };
	    },
	
	    objectToUri : function(object) {
	        object.path = object.database;
	        return Uri.build(object);
	    }
	    
	}); 
});