/*!
betajs-server - v1.0.29 - 2023-12-08
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
    "version": "1.0.29",
    "datetime": 1702058093514
};
});
Scoped.assumeVersion('base:version', '~1.0.104');
Scoped.assumeVersion('data:version', '~1.0.41');
Scoped.define("module:Ajax.NodeAjax", [
    "base:Ajax.Support",
    "base:Net.Uri",
    "base:Net.HttpHeader",
    "base:Promise",
    "base:Objs",
    "base:Types"
], function (AjaxSupport, Uri, HttpHeader, Promise, Objs, Types) {
	
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
  				path: parsed.path + (parsed.query ? "?" + parsed.query : "")
  			};
			opts.headers = {};
			if (parsed.user || parsed.password) {
				opts.headers.Authorization = 'Basic ' + Buffer.from(parsed.user + ':' + parsed.password).toString('base64');
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

			if (options.cookies)
				opts.headers.Cookie = Uri.encodeUriParams(options.cookies);
			
			if (form)
				opts.headers = Objs.extend(opts.headers, form.getHeaders());

			var headerPromise = form ? Promise.create() : Promise.value(true);
			if (form) {
				form.getLength(function (err, len) {
					if (!err) {
						opts.headers['Content-Length'] = len;
						headerPromise.asyncSuccess(true);
					} else
						headerPromise.asyncError(err);
				});
			}

			headerPromise.forwardError(promise).success(function () {
				var request = require(parsed.protocol === "https" ? "https" : "http").request(opts, function (result) {
					var data = "";
					if (options.decodeType === "raw")
						result.setEncoding("binary");
					result.on("data", function (chunk) {
						data += chunk;
					}).on("end", function () {
						if (HttpHeader.isSuccessStatus(result.statusCode)) {
							// TODO: Figure out response type.
							AjaxSupport.promiseReturnData(promise, options, data, options.decodeType || "json");
						} else {
							AjaxSupport.promiseRequestException(promise, result.statusCode, result.statusText, data, options.decodeType || "json");
						}
					});
				});
				if (options.timeout) {
					request.on('socket', function(socket) {
						socket.removeAllListeners('timeout');
						socket.setTimeout(options.timeout, function() {});
						socket.on('timeout', function() {
							request.abort();
						});
					}).on('timeout', function() {
						AjaxSupport.promiseTimeoutException(promise);
						request.abort();
					});
				}
				if (form)
					form.pipe(request);
				else {
					if (post_data && post_data.length > 0)
						request.write(post_data);
					request.end();
				}
			});
			return promise;
		}
			
	};
	
	AjaxSupport.register(Module, 10);
	
	return Module;
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
				this.__rmi_socket_sender = new SocketSenderChannel(null, "rmi");
		        this.__rmi_sender = new ReadySender(this.__rmi_socket_sender);
		        this.__rmi_receiver = new SocketReceiverChannel(null, "rmi");
		        this.__rmi_peer = new Peer(this.__rmi_sender, this.__rmi_receiver);
		        active_session.rmi_peer = this.__rmi_peer;
		        this.stubs = {};
		        this.skeletons = {};
		        active_session.stubs = this.stubs;
		        active_session.skeletons = this.skeletons;
		        active_session.on("bind_socket", function (socket) {
			        this.__rmi_receiver.socket(socket);
			        this.__rmi_socket_sender.socket(socket);
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
		    		return session || this.new_session(null /*token*/, options);
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

			get_session: function (token) {
				return this.__sessions.get(token);
			},
		    
		    find_session: function (token) {
		    	if (!token)
		    		return Promise.value(null);
		    	var session = this.get_session(token);
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
		    		var socket = this.__socket;
			        this.__socket = null;
			        this.__active_session.activity();
			        this.__active_session.trigger("unbind_socket", socket);
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
   "base:Net.Cookies",
   "module:Sessions.SocketsHelper"
], function (Class, Objs, Cookies, SocketsHelper, scoped) {
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
					var session_token = socket.handshake.query[session_cookie] || Cookies.getCookielikeValue(socket.handshake.headers.cookie, session_cookie);
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


}).call(Scoped);