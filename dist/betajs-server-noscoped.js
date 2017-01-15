/*!
betajs-server - v1.0.17 - 2017-01-15
Copyright (c) Oliver Friedmann
Apache-2.0 Software License.
*/

(function () {
var Scoped = this.subScope();
Scoped.binding('module', 'global:BetaJS.Server');
Scoped.binding('base', 'global:BetaJS');
Scoped.binding('data', 'global:BetaJS.Data');
Scoped.define("module:", function () {
	return {
    "guid": "9955100d-6a88-451f-9a85-004523eb8589",
    "version": "1.0.17"
};
});
Scoped.assumeVersion('base:version', '~1.0.96');
Scoped.assumeVersion('data:version', '~1.0.41');
Scoped.define("module:Ajax.NodeAjax", [
    "base:Ajax.Support",
    "base:Net.Uri",
    "base:Net.HttpHeader",
    "base:Promise",
    "base:Objs",
    "base:Types",
    "base:Ajax.RequestException"
], function (AjaxSupport, Uri, HttpHeader, Promise, Objs, Types, RequestException) {
	
	var Module = {
		
		supports: function (options) {
			return true;
		},
		
		execute: function (options) {
			var uri = Uri.appendUriParams(options.uri, options.query || {});
			if (options.method === "GET")
				uri = Uri.appendUriParams(uri, options.data || {});
			var parsed = Uri.parse(uri);
			var opts = {
  				method: options.method,
  				host: parsed.host,
  				port: parsed.port,
  				path: parsed.path
  			};
			opts.headers = {};
			if (parsed.user || parsed.password) {
				opts.headers.Authorization = 'Basic ' + new Buffer(parsed.user + ':' + parsed.password).toString('base64');
			} else if (options.bearer) {
				opts.headers.Authorization = 'Bearer ' + options.bearer;
			}
			var post_data = null;
			var form = null;
			if (options.method !== "GET" && !Types.is_empty(options.data)) {
				var FS = require("fs"); 
				Objs.iter(options.data, function (value) {
					if (!form && (value instanceof FS.ReadStream))
						form = new (require('form-data'))();
				});
				if (form) {
					Objs.iter(options.data, function (value, key) {
						form.append(key, value);
					});
				} else if (options.contentType === "json") {
					if (options.sendContentType)
						opts.headers["Content-Type"] = "application/json;charset=UTF-8";
					post_data = JSON.stringify(options.data);
				} else {
					if (options.sendContentType)
						opts.headers["Content-type"] = "application/x-www-form-urlencoded";
					post_data = Uri.encodeUriParams(options.data, undefined, true);
				}
				if (post_data)
					opts.headers['Content-Length'] = post_data.length;
  			}

			var promise = Promise.create();
			
			if (form)
				opts.headers = Objs.extend(opts.headers, form.getHeaders());
			
  			var request = require(parsed.protocol === "https" ? "https" : "http").request(opts, function (result) {
  				var data = "";
  				result.on("data", function (chunk) {
  					data += chunk;
  				}).on("end", function () {
  					if (HttpHeader.isSuccessStatus(result.statusCode)) {
				    	// TODO: Figure out response type.
				    	AjaxSupport.promiseReturnData(promise, options, data, "json"); //options.decodeType);
			    	} else {
			    		AjaxSupport.promiseRequestException(promise, result.statusCode, result.statusText, data, "json"); //options.decodeType);)
			    	}
  				});
  			});
  			if (form)
  				form.pipe(request);
  			else {
  				if (post_data && post_data.length > 0)
  					request.write(post_data);
  				request.end();
  			}

  			return promise;
		}
			
	};
	
	AjaxSupport.register(Module, 10);
	
	return Module;
});


Scoped.define("module:Databases.DatabaseTable", [      
        "base:Class",
        "base:Iterators.MappedIterator"
    ], function (Class, MappedIterator, scoped) {
    return Class.extend({scoped: scoped}, function (inherited) {
    	return  {
			
			constructor: function (database, table_name) {
				inherited.constructor.call(this);
				this._database = database;
				this._table_name = table_name;
			},
		
			findOne: function (query, options) {
				return this._findOne(this._encode(query), options).mapSuccess(function (result) {
					return !result ? null : this._decode(result);
				}, this);
			},
			
			_findOne: function (query, options) {
				options = options || {};
				options.limit = 1;
				return this._find(query, options).mapSuccess(function (result) {
					return result.next();
				});
			},
			
			_encode: function (data) {
				return data;	
			},
			
			_decode: function (data) {
				return data;
			},
		
			_find: function (query, options) {
			},
		
			find: function (query, options) {
				return this._find(this._encode(query), options).mapSuccess(function (result) {
					return new MappedIterator(result, this._decode, this);
				}, this);
			},
			
			findById: function (id) {
				return this.findOne({id : id});
			},
			
			count: function (query) {
				return this._count(this._encode(query));
			},
			
			_insertRow: function (row) {		
			},
			
			_removeRow: function (query) {		
			},
			
			_updateRow: function (query, row) {
			},
			
			_count: function (query) {				
			},
			
			insertRow: function (row) {
				return this._insertRow(this._encode(row)).mapSuccess(this._decode, this);
			},
			
			removeRow: function (query) {
				return this._removeRow(this._encode(query));
			},
			
			updateRow: function (query, row) {
				return this._updateRow(this._encode(query), this._encode(row)).mapSuccess(this._decode, this);
			},
			
			removeById: function (id) {
				return this.removeRow({id : id});
			},
			
			updateById: function (id, data) {
				return this.updateRow({id: id}, data);
			},
			
			ensureIndex: function (key) {}
			
    	};
    });
});
Scoped.define("module:Databases.Database", [      
        "base:Class"
    ], function (Class, scoped) {
    return Class.extend({scoped: scoped}, {
		
		_tableClass: function () {
			return null;
		},
		
		getTable: function (table_name) {
			var cls = this._tableClass();		
			return new cls(this, table_name);
		}

    });
});

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
Scoped.define("module:Databases.MongoDatabaseTable", [      
        "module:Databases.DatabaseTable",
        "base:Promise",
        "base:Objs",
        "base:Types",
        "base:Iterators.ArrayIterator"
    ], function (DatabaseTable, Promise, Objs, Types, ArrayIterator, scoped) {
    return DatabaseTable.extend({scoped: scoped}, {
		
		table: function () {
			if (this.__table)
				return Promise.create(this.__table);
			return this._database.mongodb().mapSuccess(function (db) {
				this.__table = db.collection(this._table_name);
				return this.__table;
			}, this);
		},
		
		_encode: function (data) {
			var obj = Objs.clone(data, 1);
			if ("id" in data) {
				delete obj.id;
				if (data.id !== null) {
		            var objid = this._database.mongo_object_id();
		            obj._id = Types.is_object(data.id) ? data.id : new objid(data.id + "");
				}
			}
			return obj;
		},
		
		_decode: function (data) {
			var obj = Objs.clone(data, 1);
			if ("_id" in data) {
				delete obj._id;
				obj.id = data._id;
			}
			return obj;
		},
	
		_find: function (query, options) {
			return this.table().mapSuccess(function (table) {
				return Promise.funcCallback(table, table.find, query).mapSuccess(function (result) {
					options = options || {};
					if ("sort" in options)
						result = result.sort(options.sort);
					if ("skip" in options)
						result = result.skip(options.skip);
					if ("limit" in options)
						result = result.limit(options.limit);
					return Promise.funcCallback(result, result.toArray).mapSuccess(function (cols) {
						return new ArrayIterator(cols);
					}, this);
				}, this);
			}, this);
		},
		
		_count: function (query) {
			return this.table().mapSuccess(function (table) {
				return Promise.funcCallback(table, table.find, query).mapSuccess(function (result) {
					return Promise.funcCallback(result, result.count);
				});
			});
		},
	
		_insertRow: function (row) {
			return this.table().mapSuccess(function (table) {
				return Promise.funcCallback(table, table.insert, row).mapSuccess(function (result) {
					return row;
				}, this);
			}, this);
		},
		
		_removeRow: function (query, callbacks) {
			return this.table().mapSuccess(function (table) {
				return Promise.funcCallback(table, table.remove, query); 
			}, this);
		},
		
		_updateRow: function (query, row, callbacks) {
			return this.table().mapSuccess(function (table) {
				return Promise.funcCallback(table, table.update, query, {"$set" : row}).mapSuccess(function () {
					return row;
				}); 
			}, this);
		},
			
		ensureIndex: function (key) {
			var obj = {};
			obj[key] = 1;
			this.table().success(function (table) {
				table.ensureIndex(Objs.objectBy(key, 1));
			});
		}	
		
    });
});

Scoped.define("module:Net.ControllerException", [      
        "base:Exceptions.Exception",
        "base:Net.HttpHeader"
    ], function (Exception, HttpHeader, scoped) {
    return Exception.extend({scoped: scoped}, function (inherited) {
    	return {
		
			constructor: function (code, data) {
				data = data || {};
				this.__data = data;
				this.__code = code;
				inherited.constructor.call(this, HttpHeader.format(code, true));
			},
			
			code: function () {
				return this.__code;
			},
			
			data: function () {
				return this.__data;
			}

    	};
    });
});


Scoped.define("module:Net.Controller", [      
        "base:Class",
        "base:Promise",
        "base:Types",
        "module:Net.ControllerException"
    ], function (Class, Promise, Types, ControllerException, scoped) {
    return Class.extend({scoped: scoped}, {}, {
		
		_beforeDispatch : function(method, request, response) {
			return Promise.create(true);
		},
		
		_dispatch: function (method, request, response) {
			return this[method](request, response);
		},
	
		dispatch : function(method, request, response, next) {
			this._beforeDispatch(method, request, response).success(function () {
				var result = this._dispatch(method, request, response);
				result = Promise.is(result) ? result : Promise.create(true);
				result.success(function () {
					if (Types.is_defined(next))
						next();
				}).error(function (e) {
					e = ControllerException.ensure(e);
					response.status(e.code()).send(JSON.stringify(e.data()));
				});
			}, this).error(function (e) {
				e = ControllerException.ensure(e);
				response.status(e.code()).send(JSON.stringify(e.data()));
			});
		}

    });
});


Scoped.define("module:Net.SessionControllerMixin", function () {
	return {
		
		_obtainSession: function (session_manager, session_cookie_key, method, request, response) {
			return session_manager.obtain_session(request.cookies[session_cookie_key]).mapSuccess(function (session) {
				request.session = session;
				response.cookie(session_cookie_key, session.cid(), {
					maxAge: session_manager.options().invalidation.session_timeout
				});
				return session;
			});
		}

	};
}); 
	

Scoped.define("module:Sessions.ActiveSessionHelper", [      
        "base:Class",
        "base:Classes.HelperClassMixin",
        "base:Lists.ObjectIdList",
        "base:Tokens"
    ], function (Class, HelperClassMixin, ObjectIdList, Tokens, scoped) {
    return Class.extend({scoped: scoped}, [HelperClassMixin, function (inherited) {
        return {
			
			constructor: function (session, helper) {
				inherited.constructor.call(this);
				this.__helper = helper;
				this.__session = session;
				session.active_sessions = this;
				this.__active_sessions = new ObjectIdList();
			},
			
			destroy: function () {
		        this.iterate(function (active_session) {
		            active_session.destroy();
		        }, this);
		        this.__active_sessions.destroy();
		        inherited.destroy.call(this);
			},
			
			session: function () {
				return this.__session;
			},
			
			helper: function () {
				return this.__helper;
			},
			
		    invalidate: function () {
		        this.iterate(function (active_session) {
		            active_session.invalidate();
		        }, this);
		    },
		
		    iterate: function (cb, ctx) {
		    	this.__active_sessions.iterate(cb, ctx || this);
		    },
			
			is_active: function () {
				return this.__active_sessions.count() > 0;
			},
			
			find_active_session: function (token) {
			    return this.__active_sessions.get(token);
			},
			
		    __generate_token: function () {
		    	return Tokens.generate_token();
		    },
		
		    __remove_active_session: function (active_session) {
		    	if (this.__active_sessions.exists(active_session)) {
			    	this.__active_sessions.remove(active_session);
			    	this.__session.activity();
			    }
		    },
		    
		    delete_active_session: function (active_session) {
		    	active_session.destroy();
		    },
		    
		    obtain_active_session: function (token, options) {
		    	return this.find_active_session(token) || this.new_active_session(token, options);
		    },
		    
		    __add_active_session: function (active_session) {
		        this.__active_sessions.add(active_session);
		    	this.session().manager().__add_active_session(this.session(), active_session);
		    },
		
		    new_active_session: function (token, options) {
		        var active_session = new this.__helper._active_session_class(this, token || this.__generate_token(), options);
		        this.__add_active_session(active_session);
		        return active_session;
		    },
		    
		    continue_active_session: function (options) {
				var active_session = null;
				this.iterate(function (as) {
					if (as.suspended() && as.can_continue(options)) {
						active_session = as;
						return false; 
					}
					return true;
				});
				return active_session;
		    },
		    
		    attach_active_session: function (options) {
		    	return this.continue_active_session(options) || this.new_active_session(null, options);
		    }
		
        };
    }]);
});




Scoped.define("module:Sessions.ActiveSession", [      
      "base:Class",
      "base:Classes.HelperClassMixin",
      "base:Events.EventsMixin",
      "base:Ids",
      "base:Time"
  ], function (Class, HelperClassMixin, EventsMixin, Ids, Time, scoped) {
  return Class.extend({scoped: scoped}, [HelperClassMixin, EventsMixin, function (inherited) {
      return {
		
		    constructor: function (helper, token, options) {
		    	inherited.constructor.call(this);
		        this.__helper = helper;
		        this.__options = options || {};
		        Ids.objectId(this, token);
		        this.initiation_time = Time.now();
		        this.active_time = this.initiation_time;
		    },
		    
		    destroy: function () {
		    	this.trigger("destroy");
		    	this.__helper.__remove_active_session(this);
		    	inherited.destroy.call(this);
		    },
		    
		    session: function () {
		    	return this.__helper.session();
		    },
		    
		    options: function () {
		        return this.__options;
		    },
		    
		    activity: function () {
		    	this.active_time = Time.now();
		    },
		    
		    suspended: function () {
		    	return this._helper({
		    		method: "suspended",
		    		fold_start: false,
		    		fold: function (acc, result) {
		    			return acc || result;
		    		}
		    	});
		    },
		    
		    can_continue: function (options) {
		    	return false;
		    },
		    
		    invalidate: function () {
		    	var opts = this.__helper.helper().options().invalidation;
		    	var now = Time.now();
		    	if ((opts.active_session_timeout && now > this.initiation_time + opts.active_session_timeout) ||
		    		(this.suspended() && opts.active_session_inactivity_timeout && now > this.active_time + opts.active_session_inactivity_timeout)) {
		    		this.destroy();
		    	}
		    }    
    
      };
  }]);    
});
        	


Scoped.define("module:Sessions.ActiveSessionManagerHelper", [      
      "base:Class",
      "module:Sessions.ActiveSession",
      "module:Sessions.ActiveSessionHelper",
      "base:Objs",
      "base:Types"
  ], function (Class, ActiveSession, ActiveSessionHelper, Objs, Types, scoped) {
  return Class.extend({scoped: scoped}, function (inherited) {
      return {

			_active_session_class: ActiveSession,
		
			constructor: function (manager, options) {
				inherited.constructor.call(this);
		        options = Objs.tree_extend({
		        	invalidation: {
		        		// All times are in milliseconds; null to disable
		        		// hard timeout to remove active sessions
		        		active_session_timeout: 1000 * 60 * 60,
		        		// kill active session if there is no active session after time
		        		active_session_inactivity_timeout: 1000 * 60
		        	}
		        }, options);
		        this.__options = options;
		        this._active_session_class = options.active_session_class || this._active_session_class;
		        if (Types.is_string(this._active_session_class))
		        	this._active_session_class = Scoped.getGlobal(this._active_session_class);
		        manager.__add_active_session = function (session, active_session) {
		        	this._helper("__add_active_session", session, active_session);
		        };
			},
			
			__add_session: function (session) {
				session.addHelper(ActiveSessionHelper, this);
			},
			
			options: function () {
				return this.__options;
			}

      };
  });
});


Scoped.define("module:Sessions.PersistentSessionModel", [      
        "data:Modelling.Model"
    ], function (Model, scoped) {
    return Model.extend({scoped: scoped}, {}, function (inherited) {
    	return {
    		    	
			_initializeScheme: function () {
				var scheme = inherited._initializeScheme.call(this);
				scheme.token = {
					type: "string",
					index: true
				};
				scheme.created = {
					type: "date",
					index: true
				};
				return scheme;
			}
    
    	};
    });
});			


Scoped.define("module:Sessions.PersistentSessionManagerHelper", [      
         "base:Class",
         "module:Sessions.PersistentSessionModel",
         "base:Objs",
         "base:Types",
         "data:Stores.MemoryStore",
         "data:Modelling.Table",
         "base:Timers.Timer",
         "base:Time"
     ], function (Class, PersistentSessionModel, Objs, Types, MemoryStore, Table, Timer, Time, scoped) {
     return Class.extend({scoped: scoped}, function (inherited) {
     	return {
	
			_persistent_session_model: PersistentSessionModel,
		
			constructor: function (manager, options) {
				inherited.constructor.call(this);
		        this.__manager = manager;
		        options = Objs.tree_extend({
		        	invalidation: {
		        		// All times are in milliseconds; null to disable
		        		// hard timeout to remove sessions
		        		session_timeout: 1000 * 60 * 60 * 24 * 365,
		        		// invalidate; null to disable
		        		timer: 1000 * 60 * 60 * 24
		        	}
		        }, options);
		        this.__options = options;
		        this.__store = options.store ? options.store : this._auto_destroy(new MemoryStore());
		        this._persistent_session_model = options.persistent_session_model || this._persistent_session_model;
		        if (Types.is_string(this._persistent_session_model))
		        	this._persistent_session_model = Scoped.getGlobal(this._persistent_session_model);
		        if (options.invalidation.timer) {
		        	this.__timer = this._auto_destroy(new Timer({
					    fire : this.invalidate,
					    context : this,
					    delay : options.invalidation.timer
		        	}));
		        }
		        if (!this._persistent_session_model.table)
		        	this._persistent_session_model.table = this._auto_destroy(new Table(this.__store, this._persistent_session_model));
		        this.__table = this._persistent_session_model.table;
		        manager.table = this.__table;
		        manager.store = this.__store;
			},
			
			__lookup_session: function (token) {
				return this.__table.findBy({token: token}).mapCallback(function (err, model) {
					return model && !err ? this.__manager.new_session(token, { model: model }) : null;
				}, this);
			},
			
			__add_session: function (session) {
				var session_options = session.options();
				if (!session_options.model) {
					session_options.model = this.__table.newModel({
						token: session.cid(),
						created: Time.now()
					});
					session_options.model.save();
				}
				session.model = session_options.model;
				session.model.session = session;
			},
			
			options: function () {
				return this.__options;
			},
			
		    invalidate: function () {
		    	if (this.__options.invalidation.session_timeout) {
		    		var time = Time.now() - this.__options.invalidation.session_timeout;
		    		this.__table.allBy({"created" : {"$lt": time}}).success(function (iter) {
						while (iter.hasNext()) {
							var model = iter.next();
							if (model.session)
								this.__manager.delete_session(model.session);
							model.remove();
						}
		    		}, this);
		    	}
		    }
	
     	};
     });
});

Scoped.define("module:Sessions.RMIHelper", [      
         "base:Class",
         "base:Channels.ReadySender",
         "base:Net.SocketSenderChannel",
         "base:Net.SocketReceiverChannel",
         "base:RMI.Peer"
     ], function (Class, ReadySender, SocketSenderChannel, SocketReceiverChannel, Peer, scoped) {
     return Class.extend({scoped: scoped}, function (inherited) {
     	return {
		
		    constructor: function (active_session) {
		    	inherited.constructor.call(this);
		        this.__active_session = active_session;
		        active_session.rmi = this;
		        this.__rmi_sender = new ReadySender(new SocketSenderChannel(null, "rmi"));
		        this.__rmi_receiver = new SocketReceiverChannel(null, "rmi");
		        this.__rmi_peer = new Peer(this.__rmi_sender, this.__rmi_receiver);
		        active_session.rmi_peer = this.__rmi_peer;
		        this.stubs = {};
		        this.skeletons = {};
		        active_session.stubs = this.stubs;
		        active_session.skeletons = this.skeletons;
		        active_session.on("bind_socket", function (socket) {
			        this.__rmi_receiver.socket(socket);
			        this.__rmi_sender.socket(socket);
			        this.__rmi_sender.ready();
		        }, this);
		        active_session.on("unbind_socket", function () {
		        	this.__rmi_sender.unready();
		        }, this);
		        if ("initialize_rmi" in active_session)
		        	active_session.initialize_rmi();
		    },
		    
		    destroy: function () {
		        for (var key in this.stubs)
		            this.stubs[key].destroy();
		        for (key in this.skeletons)
		            this.skeletons[key].destroy();
		        this.__rmi_peer.destroy();
		        this.__rmi_receiver.destroy();
		        this.__rmi_sender.destroy();
		        inherited.destroy.call(this);
		    }

     	};
     });
});


Scoped.define("module:Sessions.RMIManagerHelper", [      
        "base:Class",
        "module:Sessions.RMIHelper"
    ], function (Class, RMIHelper, scoped) {
    return Class.extend({scoped: scoped}, {
		
		__add_active_session: function (session, active_session) {
			active_session.addHelper(RMIHelper);
		}
    
    });
});

Scoped.define("module:Sessions.Session", [      
        "base:Class",
        "base:Classes.HelperClassMixin",
        "base:Ids",
        "base:Time"
    ], function (Class, HelperClassMixin, Ids, Time, scoped) {
    return Class.extend({scoped: scoped}, [HelperClassMixin, function (inherited) {
		return {
				
		    constructor: function (manager, token, options) {
		    	inherited.constructor.call(this);
		        this.__manager = manager;
		        this.__options = options || {};
		        Ids.objectId(this, token);
		        this.initiation_time = Time.now();
		        this.active_time = this.initiation_time;
		    },
		    
		    destroy: function () {
		    	this.__manager.__remove_session(this);
		    	inherited.destroy.call(this);
		    },
		    
		    is_active: function () {
		    	return this._helper({
		    		method: "is_active",
		    		fold_start: false,
		    		fold: function (acc, result) {
		    			return acc || result;
		    		}
		    	});
		    },
		    
		    activity: function () {
		    	this.active_time = Time.now();
		    },
		    
		    invalidate: function () {
		    	this._helper("invalidate");
		    	var opts = this.__manager.options().invalidation;
		    	var now = Time.now();
		    	if ((opts.session_timeout && now > this.initiation_time + opts.session_timeout) ||
		    		(!this.is_active() && opts.session_inactivity_timeout && now > this.active_time + opts.session_inactivity_timeout)) {
		    		this.destroy();
		    	}
		    },
		
		    manager: function () {
		    	return this.__manager;
		    },
		    
		    options: function () {
		    	return this.__options;
		    }
    
		};
    }]);
});


Scoped.define("module:Sessions.Manager", [      
	      "base:Class",
	      "base:Events.EventsMixin",
	      "base:Classes.HelperClassMixin",
	      "module:Sessions.Session",
	      "base:Objs",
	      "base:Types",
	      "base:Timers.Timer",
	      "base:Lists.ObjectIdList",
	      "base:Tokens",
	      "base:Promise"
	  ], function (Class, EventsMixin, HelperClassMixin, Session, Objs, Types, Timer, ObjectIdList, Tokens, Promise, scoped) {
	  return Class.extend({scoped: scoped}, [EventsMixin, HelperClassMixin, function (inherited) {
		return {
				
			_session_class: Session,
		
		    constructor: function (options) {
		    	inherited.constructor.call(this);
		        options = Objs.tree_extend({
		        	invalidation: {
		        		// All times are in milliseconds; null to disable
		        		// hard timeout to remove sessions
		        		session_timeout: 1000 * 60 * 60 * 24,
		        		// kill session if there is no active session after time
		        		session_inactivity_timeout: 1000 * 60 * 60,
		        		// invalidate; null to disable
		        		timer: 1000 * 60 
		        	}
		        }, options);
		        this.__options = options;
		        this._session_class = options.session_class || this._session_class;
		        if (Types.is_string(this._session_class))
		        	this._session_class = Scoped.getGlobal(this._session_class);
		        if (options.invalidation.timer) {
		        	this.__timer = this._auto_destroy(new Timer({
					    fire : this.invalidate,
					    context : this,
					    delay : options.invalidation.timer
		        	}));
		        }
		        this.__sessions = new ObjectIdList();
		    },
		    
		    destroy: function () {
		    	this.iterate(function (session) {
		    		session.destroy();
		    	});
		    	this.__sessions.destroy();
		    	inherited.destroy.call(this);
		    },
		    
		    iterate: function (cb, ctx) {
		    	this.__sessions.iterate(cb, ctx || this);
		    },
		
		    obtain_session: function (token, options) {
		    	return this.find_session(token).mapSuccess(function (session) {
		    		return session || this.new_session(token, options);
		    	}, this);
		    },
		    
		    __generate_token: function () {
		    	return Tokens.generate_token();
		    },
		    
		    __lookup_session: function (token) {
		    	return this._helper({
		    		method: "__lookup_session",
		    		async: true
		    	}, token);
		    },
		    
		    find_session: function (token) {
		    	if (!token)
		    		return Promise.value(null);
		    	var session = this.__sessions.get(token);
		    	return session ? Promise.create(session) : this.__lookup_session(token);
		    },
		    
		    __add_session: function (session) {
		    	this.__sessions.add(session);
		    	this._helper("__add_session", session);
		    },
		    
		    new_session: function (token, options) {
		        var session = new this._session_class(this, token || this.__generate_token(), options);
		        this.__add_session(session);
		        return session;
		    },
		    
		    invalidate: function () {
		        this.iterate(function (session) {
		            session.invalidate();
		        });
		    },
		    
		    options: function () {
		    	return this.__options;
		    },
		    
		    __remove_session: function (session) {
		    	if (this.__sessions.exists(session)) {
			    	this._helper("remove_session", session);
			    	this.__sessions.remove(session);
			    }
		    },
		    
		    delete_session: function (session) {
		    	session.destroy();
		    }
		    
		};
	  }]);
});
Scoped.define("module:Sessions.SocketsHelper", [      
        "base:Class"
    ], function (Class, scoped) {
    return Class.extend({scoped: scoped}, function (inherited) {
        return {
		
		    constructor: function (active_session) {
		    	inherited.constructor.call(this);
		        this.__active_session = active_session;
		        active_session.socket = this;
		    },
		    
		    destroy: function () {
		        this.unbind();
		        inherited.destroy.call(this);
		    },    
		
		    suspended: function () {
		    	return !this.socket();
		    },
		    
		    bind: function (socket) {
		        if (socket == this.__socket)
		            return;
		        this.unbind();
		        this.__socket = socket;
		        var self = this;
		        socket.on("disconnect", function() {
		            self.unbind();
		        });
		        this.__active_session.trigger("bind_socket", socket);
		    },
		    
		    unbind: function () {
		    	if (this.__socket) {
			        this.__socket = null;
			        this.__active_session.activity();
			        this.__active_session.trigger("unbind_socket");
			        if (this.__active_session.session().manager().sockets_manager_helper.__options.remove_on_disconnect)
			        	this.__active_session.destroy();
		    	}
		    },
		    
		    socket: function () {
		        return this.__socket;
		    }
        };
    });
});



Scoped.define("module:Sessions.SocketsManagerHelper", [      
       "base:Class",
       "base:Objs",
       "base:Strings",
       "module:Sessions.SocketsHelper"
   ], function (Class, Objs, Strings, SocketsHelper, scoped) {
   return Class.extend({scoped: scoped}, function (inherited) {
       return {
		                                   			
			constructor: function (manager, options) {
				inherited.constructor.call(this);
				this.__manager = manager;
				manager.sockets_manager_helper = this;
				this.__options = Objs.extend({
					remove_on_disconnect: false
				}, options);
				manager.bind_socket = function (socket, session_cookie, data) {
					var session_token = Strings.read_cookie_string(socket.handshake.headers.cookie, session_cookie, data);
			        this.find_session(session_token).success(function (session) {
				        if (!session) {
				            socket.disconnect();
				            return;
				        }
				        var active_session = session.active_sessions.find_active_session(data.active_session_token);
				        if (!active_session) {
				            socket.disconnect();
				            return;
				        }
				        active_session.socket.bind(socket);        
			        }, this);
				};
			},
		
			__add_active_session: function (session, active_session) {
				active_session.addHelper(SocketsHelper);
			}

       };
   });
});


Scoped.define("module:Stores.DatabaseStore", [      
        "data:Stores.BaseStore",
        "base:Objs",
        "data:Queries",
        "data:Queries.Constrained"
    ], function (BaseStore, Objs, Queries, ConstrainedQueries, scoped) {
    return BaseStore.extend({scoped: scoped}, function (inherited) {
		return {
			
			constructor: function (database, table_name, foreign_id) {
				inherited.constructor.call(this);
				this.__database = database;
				this.__table_name = table_name;
				this.__table = null;
				this.__foreign_id = foreign_id;
			},
			
			table: function () {
				if (!this.__table)
					this.__table = this.__database.getTable(this.__table_name);
				return this.__table;
			},
			
			_insert: function (data) {
			    if (!this.__foreign_id || !data[this.__foreign_id])
			        return this.table().insertRow(data);
			    return this.table().findOne(Objs.objectBy(this.__foreign_id, data[this.__foreign_id])).mapSuccess(function (result) {
			    	return result ? result : this.table().insertRow(data);
			    }, this);
			},
			
			_remove: function (id) {
			    if (!this.__foreign_id)
				    return this.table().removeById(id);
				return this.table().removeRow(Objs.objectBy(this.__foreign_id, id));
			},
			
			_get: function (id) {
		        if (!this.__foreign_id)
		    		return this.table().findById(id);
			    return this.table().findOne(Objs.objectBy(this.__foreign_id, id));
			},
			
			_update: function (id, data) {
		        if (!this.__foreign_id)
		    		return this.table().updateById(id, data);
		        return this.updateRow(Objs.objectBy(this.__foreign_id, id), data);
			},
			
			_query_capabilities: function () {
				return ConstrainedQueries.fullConstrainedQueryCapabilities(Queries.fullQueryCapabilities());
			},
			
			_query: function (query, options) {
				return this.table().find(query, options);
			},
			
			_ensure_index: function (key) {
				this.table().ensureIndex(key);
			}
		
		};
    });
});

Scoped.define("module:Stores.Migrator", [      
        "base:Class",
        "base:Types"
    ], function (Class, Types, scoped) {
    return Class.extend({scoped: scoped}, function (inherited) {
		return {
			
			constructor: function () {
				inherited.constructor.call(this);
				this.__version = null;
				this.__migrations = [];
				this.__sorted = true;
			},
			
			version: function (offset) {
				if (!this.__version)
					this.__version = this._getVersion();
				return this.__version;
			},
			
			_getVersion: function () {
			},
			
			_setVersion: function (version) {
			},
			
			_log: function (s) {		
			},
			
			migrations: function () {
				if (!this.__sorted) {
					this.__migrations.sort(function (x, y) {
						return x.version - y.version;
					});
					this.__sorted = true;
				}
				return this.__migrations;
			},
			
			register: function (migration) {
				this.__migrations.push(migration);
				this.__sorted = false;
			},
			
			_indexByVersion: function (version) {
				for (var i = 0; i < this.__migrations.length; ++i) {
					if (version == this.__migrations[i].version)
						return i;
					else if (version < this.__migrations[i].version)
						return i-1;
				}
				return this.__migrations.length;				
			},
			
			migrate: function (version) {
				var current = this._indexByVersion(this.version());		
				var target = Types.is_defined(version) ? this._indexByVersion(version) : this.__migrations.length - 1;		
				while (current < target) {
					var migration = this.__migrations[current + 1];
					this._log("Migrate " + migration.version + ": " + migration.title + " - " + migration.description + "...\n");
					try {
						migration.migrate();
						this._setVersion(this.__migrations[current+1].version);
						current++;
						this._log("Successfully migrated " + migration.version + ".\n");
					} catch (e) {
						this._log("Failure! Rolling back " + migration.version + "...\n");
						try {
							if ("partial_rollback" in migration)
								migration.partial_rollback();
							else if ("rollback" in migration)
								migration.rollback();
							else
								throw "No rollback defined";
						} catch (ex) {
							this._log("Failure! Couldn't roll back " + migration.version + "!\n");
							throw ex;
						}
						this._log("Rolled back " + migration.version + "!\n");
						throw e;
					}
				}
			},
			
			rollback: function (version) {
				var current = this._indexByVersion(this.version());
				var target = Types.is_defined(version) ? this._indexByVersion(version) : current-1;
				while (current > target) {
					var migration = this.__migrations[current];
					this._log("Rollback " + migration.version + ": " + migration.title + " - " + migration.description + "...\n");
					try {
						migration.rollback();
						this._setVersion(current >= 1 ? this.__migrations[current-1].version : 0);
						current--;
						this._log("Successfully rolled back " + migration.version + ".\n");
					} catch (e) {
						this._log("Failure! Couldn't roll back " + migration.version + "!\n");
						throw e;
					}
				}
			}
			
		};
    });
});

Scoped.define("module:Stores.MongoDatabaseStore", [
        "data:Stores.TransformationStore",
        "base:Objs",                                                   
        "module:Stores.DatabaseStore"
    ], function (TransformationStore, Objs, DatabaseStore, scoped) {
    return TransformationStore.extend({scoped: scoped}, function (inherited) {
		return {
			
			constructor: function (database, table_name, types, foreign_id) {
				var store = new DatabaseStore(database, table_name, foreign_id);
				this._types = types || {};
		        if (!foreign_id)
				    this._types.id = "id";
		        this._foreign_id = foreign_id;
		        this._ObjectId = database.mongo_object_id();
				inherited.constructor.call(this, store);
			},
			
			table: function () {
				return this.store().table();
			},
			
			_encodeSort: function (data) {
				var result = {};
				Objs.iter(data, function (value, key) {
					if (key === "id")
						key = "_id";
					result[key] = value;
				});
				return result;
			},
			
			_encodeData: function (data) {
				var result = Objs.map(data, function (value, key) {
					if (this._types[key] === "id")
						return value ? new this._ObjectId(value + "") : null;
					return value;
				}, this);
				if (this._foreign_id) {
					result.id = result[this._foreign_id];
					delete result[this._foreign_id];
				}
				return result;
			},
			
			_decodeData: function (data) {
				var result = Objs.map(data, function (value, key) {
					if (this._types[key] === "id")
						return value ? value + "" : null;
					return value;
				}, this);
				if (this._foreign_id) {
					result[this._foreign_id] = result.id;
					delete result.id;
				}
				return result;
			}			

		};
    });
});

}).call(Scoped);