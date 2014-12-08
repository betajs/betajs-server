/*!
betajs-server - v1.0.0 - 2014-12-07
Copyright (c) Oliver Friedmann
MIT Software License.
*/
BetaJS.Net.AbstractAjax.extend("BetaJS.Server.Net.HttpAjax", {

	_syncCall: function (options) {
		throw "Unsupported";
	},
	
	_asyncCall: function (options, callbacks) {
		var parsed = BetaJS.Net.Uri.parse(options.uri);
		var opts = {
			method: options.method,
			host: parsed.host,
			port: parsed.port,
			path: parsed.path
		};		
		var post_data = null;
		if (options.data) {
			if (opts.method == "GET") {
				opts.path = opts.path + "?" + this.cls.querystring().stringify(options.data);
			} else {
				post_data = this.cls.querystring().stringify(options.data);
				if (post_data.length > 0)
					opts.headers = {
			          'Content-Type': 'application/x-www-form-urlencoded',
			          'Content-Length': post_data.length
				    };
			}			
		}
		var request = this.cls.http().request(opts, function (result) {
			var data = "";
			result.on("data", function (chunk) {
				data += chunk;
			}).on("end", function () {
				if (result.statusCode >= 200 && result.statusCode < 300) 
					BetaJS.SyncAsync.callback(callbacks, "success", data);
				else
					BetaJS.SyncAsync.callback(callbacks, "exception", data);
			});
		});
		if (post_data && post_data.length > 0)
			request.write(post_data);
		request.end();
	}

}, {
	
	__http: null,
	
	http: function () {
		if (!this.__http)
			this.__http = require("http");
		return this.__http;
	},	
	
	__querystring: null,
	
	querystring: function () {
		if (!this.__querystring)
			this.__querystring = require("querystring");
		return this.__querystring;
	}	

});

BetaJS.Class.extend("BetaJS.Server.Net.Controller", {}, {
	
	_beforeDispatch : function(method, request, response) {
		return BetaJS.Promise.create(true);
	},

	dispatch : function(method, request, response, next) {
		this._beforeDispatch(method, request, response).success(function () {
			var result = this[method](request, response);
			result = BetaJS.Promise.is(result) ? result : BetaJS.Promise.create(true);
			result.success(function () {
				if (BetaJS.Types.is_defined(next))
					next();
			}).error(function (e) {
				e = BetaJS.Server.Net.ControllerException.ensure(e);
				response.status(e.code()).send(JSON.stringify(e.data()));
			});
		}, this).error(function (e) {
			e = BetaJS.Server.Net.ControllerException.ensure(e);
			response.status(e.code()).send(JSON.stringify(e.data()));
		});
	}
	
});

BetaJS.Exceptions.Exception.extend("BetaJS.Server.Net.ControllerException", {
	
	constructor: function (code, data) {
		data = data || {};
		this.__data = data;
		this.__code = code;
		this._inherited(BetaJS.Server.Net.ControllerException, "constructor", BetaJS.Net.HttpHeader.format(code, true));
	},
	
	code: function () {
		return this.__code;
	},
	
	data: function () {
		return this.__data;
	}
	
});


BetaJS.Server.Net.SessionControllerMixin = {
	
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

BetaJS.Class.extend("BetaJS.Server.Net.Imap", [
	BetaJS.Events.EventsMixin,
	{
			
	constructor: function (auth, options) {
		this._inherited(BetaJS.Server.Net.Imap, "constructor");
		this.__quoted_printable = require("quoted-printable");
		this.__html_strip = require('htmlstrip-native');
		this.__auth = auth;
		options = options || {};
		this.__options = options;
		this.__count = 0;
		this.__Imap = require("imap");
		this.__connected = false;
		this.__imap = new this.__Imap(BetaJS.Objs.extend({
			tls : true,
			tlsOptions : {
				rejectUnauthorized : false
			}
		}, auth));
		var self = this;
		this.__imap.on("mail", function (mails) {
			self.__count += mails;
		});
		this.__imap.on("error", function () {
			self.trigger("error");
			if (options.reconnect_on_error)
				BetaJS.SyncAsync.eventually(self.reconnect, [], self);
		});
	},
	
	destroy: function () {
		this.disconnect();
		this._inherited(BetaJS.Server.Net.Imap, "destroy");
	},
	
	connect: function () {
		if (this.__connected)
			return BetaJS.Promise.value(true);
		this.__count = 0;
		var self = this;
		var promise = BetaJS.Promise.create();
		var f = function () {
			promise.error(true);
			self.off("error", f);
		};
		this.on("error", f);
		this.__imap.connect();
		this.__imap.once('ready', function() {
			self.__connected = true;
			var boxes = self.__options.mailbox || "INBOX";
			if (!BetaJS.Types.is_array(boxes))
			    boxes = [boxes];
			boxes = BetaJS.Objs.clone(boxes, 1);
			var err = null;
			var worker = function () {
			    if (boxes.length === 0) {
			    	promise.error(err);
                    self.__connected = false;
                }
                var box = boxes.shift();
                self.__imap.openBox(box, true, function (error, box) {
                    if (error) {
                        err = error;
                        worker();
                        return;
                    }
                    self.on("error", f);
                    self.__imap.on('mail', function (count) {
                        self.trigger("new_mail", count);
                    });
                    promise.asyncSuccess(true);
                });
			};
			self.off("error", f);
			worker();
		});
		return promise;
	},
	
	disconnect: function () {
		if (!this.__connected)
			return;
		this.__imap.end();
		this.__connected = false;
	},
	
	reconnect: function () {
		this.disconnect();
		this.connect();
	},
	
	count: function () {
		return this.__count;
	},
		
	/*
	 * body: boolean (= true)
	 * headers: boolean (= true)
	 * seq_from
	 * seq_to
	 * seq_count
	 * reverse
	 */
	fetch: function (options, callbacks) {
		options = options || {};
		var bodies = [];
		if (!("headers" in options) || options.headers)
			bodies.push('HEADER.FIELDS (FROM TO SUBJECT DATE)');
		if (!("body" in options) || options.body)
			bodies.push('TEXT');
		var seq_start = 1;
		var seq_end = 100;
		if (options.seq_count) {
			if (options.seq_end) {
				seq_end = options.seq_end;
				seq_start = seq_end - options.seq_count + 1;
			} else {
				seq_start = options.seq_start || seq_start;
				seq_end = seq_start + options.seq_count - 1;
			}
		} else {
			seq_start = options.seq_start || seq_start;
			seq_end = options.seq_end || seq_start + 99;
		}
		if (options.reverse) {
			var dist = seq_end - seq_start;
			seq_end = this.__count - seq_start + 1;
			seq_start = seq_end - dist;
		}
		var f = this.__imap.seq.fetch(seq_start + ":" + seq_end, {
			bodies : bodies,
			struct : true
		});
		return this.__query(f);
	},
	
	__query: function (f) {
		var self = this;
		var mails = [];
		f.on('message', function(msg, seqno) {
			var attrs = {};
			var header_buffer = '';
			var body_buffer = '';
			msg.on('body', function(stream, info) {
				stream.on('data', function(chunk) {
					if (info.which === 'TEXT')
						body_buffer += chunk.toString('utf8');
					else
						header_buffer += chunk.toString('utf8');
				});
			});
		  	msg.once('attributes', function (a) {
		  		attrs = a;
	      	});
	      	msg.once('end', function() {
		  		attrs.seqno = seqno;
		  		try {
		      		var mail = self.__parse(self.__Imap.parseHeader(header_buffer), body_buffer, attrs);
					if (mail)
						mails.push(mail);
				} catch (e) {}
			});
		});
		var promise = BetaJS.Promise.create(); 
		f.once('error', function(err) {
			promise.asyncError(err);
		});
		f.once('end', function() {
			promise.asyncSuccess(mails);
		});			
		return promise;
	},
	
	__parse: function (header, body, attrs) {
		this.trigger("parse", header, body, attrs);
		var mail = {};
		/* Attrs */
    	mail.uid = attrs.uid;
    	mail.threadid = attrs['x-gm-thrid'];
    	mail.id = attrs.uid;
    	mail.seqid = attrs.seqno;
    	/* Header */
    	if (header && header.subject && header.subject.length > 0)
			mail.subject = header.subject[0];
    	if (header && header.to && header.to.length > 0)
			mail.to = header.to[0];
    	if (header && header.from && header.from.length > 0)
			mail.from = header.from[0];
    	if (header && header.date && header.date.length > 0) {
			var d = new Date(header.date[0]);
			mail.date = d.getTime();
		}
		if (body) {
			/* Meta Body */
			var struct = attrs.struct;
			var parts = [];
			if (struct.length > 1) {
				var boundary = struct[0].params.boundary;
				var rest = body;
				var boundary_prefix = rest.indexOf(boundary);
				for (var i = 1; i < struct.length; ++i) {
					var obj = struct[i][0] || {};
					// Remove everything before boundary
					rest = rest.substring(rest.indexOf(boundary) + boundary.length);
					// Remove everything before empty line
					rest = rest.substring(rest.indexOf("\r\n\r\n") + "\r\n\r\n".length);
					// Ignore attachments for now
					if (obj.disposition || obj.type != 'text')
						continue;
					var j = rest.indexOf(boundary) - boundary_prefix;
					parts.push({meta: obj, body: j >= 0 ? rest.substring(0, j) : rest});
				}
			} else
				parts.push({meta: struct[0], body: body});
			var html_body = null;
			var text_body = null;
			for (var k = 0; k < parts.length; ++k) {
				var encoded = parts[k].body;
				var encoding = parts[k].meta.encoding.toLowerCase();
				try {
					if (encoding == "quoted-printable") {
						encoded = this.__quoted_printable.decode(encoded).toString();
					} else {
						encoded = new Buffer(encoded, encoding).toString();
					}
				} catch (e) {}
				if (parts[k].meta.subtype == "html")
					html_body = encoded;
				else
					text_body = encoded;
			}
			if (!text_body && html_body) {
				text_body = this.__html_strip.html_strip(html_body, {
			        include_script : false,
			        include_style : false,
			        compact_whitespace : true
				});
		    }
			mail.html_body = html_body;
			mail.text_body = text_body;
		}
		return mail;
	}

}]);
BetaJS.Server.Net.Smtp = {
	
	send: function (config, message) {
		var email = require("emailjs");
		message.from = BetaJS.Strings.email_get_email(message.from);
		message.to = BetaJS.Strings.email_get_email(message.to);
		if (message.text_body) {
			message.text = message.text_body;
			delete message.text_body;
		}
		var promise = BetaJS.Promise.create();
 		email.server.connect(config).send(email.message.create(message), promise.asyncCallbackFunc());
 		return promise;
	}
	
};
BetaJS.Class.extend("BetaJS.Server.Sessions.Manager", [
	BetaJS.Events.EventsMixin,
	BetaJS.Classes.HelperClassMixin,
	{
		
	_session_class: "BetaJS.Server.Sessions.Session",

    constructor: function (options) {
        this._inherited(BetaJS.Server.Sessions.Manager, "constructor");
        options = BetaJS.Objs.tree_extend({
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
        if (BetaJS.Types.is_string(this._session_class))
        	this._session_class = BetaJS.Scopes.resolve(this._session_class);
        if (options.invalidation.timer) {
        	this.__timer = this._auto_destroy(new BetaJS.Timers.Timer({
			    fire : this.invalidate,
			    context : this,
			    delay : options.invalidation.timer
        	}));
        }
        this.__sessions = new BetaJS.Lists.ObjectIdList();
    },
    
    destroy: function () {
    	this.iterate(function (session) {
    		session.destroy();
    	});
    	this.__sessions.destroy();
    	this._inherited(BetaJS.Server.Sessions.Manager, "destroy");
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
    	return BetaJS.Tokens.generate_token();
    },
    
    __lookup_session: function (token) {
    	return this._helper({
    		method: "__lookup_session",
    		async: true
    	}, token);
    },
    
    find_session: function (token) {
    	var session = this.__sessions.get(token);
    	return session ? BetaJS.Promise.create(session) : this.__lookup_session(token);
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
    
}]);


BetaJS.Class.extend("BetaJS.Server.Sessions.Session", [
	BetaJS.Classes.HelperClassMixin,
	{
		
    constructor: function (manager, token, options) {
        this._inherited(BetaJS.Server.Sessions.Session, "constructor");
        this.__manager = manager;
        this.__options = options || {};
        BetaJS.Ids.objectId(this, token);
        this.initiation_time = BetaJS.Time.now();
        this.active_time = this.initiation_time;
    },
    
    destroy: function () {
    	this.__manager.__remove_session(this);
        this._inherited(BetaJS.Server.Sessions.Session, "destroy");
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
    	this.active_time = BetaJS.Time.now();
    },
    
    invalidate: function () {
    	this._helper("invalidate");
    	var opts = this.__manager.options().invalidation;
    	var now = BetaJS.Time.now();
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
    
}]);

BetaJS.Class.extend("BetaJS.Server.Session.ActiveSessionManagerHelper", {
	
	_active_session_class: "BetaJS.Server.Sessions.ActiveSession",

	constructor: function (manager, options) {
		this._inherited(BetaJS.Server.Session.ActiveSessionManagerHelper, "constructor");
        options = BetaJS.Objs.tree_extend({
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
        if (BetaJS.Types.is_string(this._active_session_class))
        	this._active_session_class = BetaJS.Scopes.resolve(this._active_session_class);
        manager.__add_active_session = function (session, active_session) {
        	this._helper("__add_active_session", session, active_session);
        };
	},
	
	__add_session: function (session) {
		session.addHelper(BetaJS.Server.Session.ActiveSessionHelper, this);
	},
	
	options: function () {
		return this.__options;
	}
	
});

BetaJS.Class.extend("BetaJS.Server.Session.ActiveSessionHelper", [
	BetaJS.Classes.HelperClassMixin,
	{
	
	constructor: function (session, helper) {
		this._inherited(BetaJS.Server.Session.ActiveSessionHelper, "constructor");
		this.__helper = helper;
		this.__session = session;
		session.active_sessions = this;
		this.__active_sessions = new BetaJS.Lists.ObjectIdList();
	},
	
	destroy: function () {
        this.iterate(function (active_session) {
            active_session.destroy();
        }, this);
        this.__active_sessions.destroy();
		this._inherited(BetaJS.Server.Session.ActiveSessionHelper, "destroy");
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
    	return BetaJS.Tokens.generate_token();
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
        active_session = new this.__helper._active_session_class(this, token || this.__generate_token(), options);
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
	
}]);


BetaJS.Class.extend("BetaJS.Server.Sessions.ActiveSession", [
	BetaJS.Classes.HelperClassMixin,
	BetaJS.Events.EventsMixin,
	{

    constructor: function (helper, token, options) {
        this._inherited(BetaJS.Server.Sessions.ActiveSession, "constructor");
        this.__helper = helper;
        this.__options = options || {};
        BetaJS.Ids.objectId(this, token);
        this.initiation_time = BetaJS.Time.now();
        this.active_time = this.initiation_time;
    },
    
    destroy: function () {
    	this.trigger("destroy");
    	this.__helper.__remove_active_session(this);
        this._inherited(BetaJS.Server.Sessions.ActiveSession, "destroy");
    },
    
    options: function () {
        return this.__options;
    },
    
    activity: function () {
    	this.active_time = BetaJS.Time.now();
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
    	var now = BetaJS.Time.now();
    	if ((opts.active_session_timeout && now > this.initiation_time + opts.active_session_timeout) ||
    		(this.suspended() && opts.active_session_inactivity_timeout && now > this.active_time + opts.active_session_inactivity_timeout)) {
    		this.destroy();
    	}
    }    
    
}]);
BetaJS.Class.extend("BetaJS.Server.Session.PersistentSessionManagerHelper", {
	
	_persistent_session_model: "BetaJS.Server.Sessions.PersistentSessionModel",

	constructor: function (manager, options) {
		this._inherited(BetaJS.Server.Session.PersistentSessionManagerHelper, "constructor");
        this.__manager = manager;
        options = BetaJS.Objs.tree_extend({
        	invalidation: {
        		// All times are in milliseconds; null to disable
        		// hard timeout to remove sessions
        		session_timeout: 1000 * 60 * 60 * 24 * 365,
        		// invalidate; null to disable
        		timer: 1000 * 60 * 60 * 24
        	}
        }, options);
        this.__options = options;
        this.__store = options.store ? options.store : this._auto_destroy(new BetaJS.Stores.MemoryStore());
        this._persistent_session_model = options.persistent_session_model || this._persistent_session_model;
        if (BetaJS.Types.is_string(this._persistent_session_model))
        	this._persistent_session_model = BetaJS.Scopes.resolve(this._persistent_session_model);
        if (options.invalidation.timer) {
        	this.__timer = this._auto_destroy(new BetaJS.Timers.Timer({
			    fire : this.invalidate,
			    context : this,
			    delay : options.invalidation.timer
        	}));
        }
        if (!this._persistent_session_model.table)
        	this._persistent_session_model.table = this._auto_destroy(new BetaJS.Modelling.Table(this.__store, this._persistent_session_model));
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
				created: BetaJS.Time.now()
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
    		var time = BetaJS.Time.now() - this.__options.invalidation.session_timeout;
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
	
});


BetaJS.Modelling.Model.extend("BetaJS.Server.Sessions.PersistentSessionModel", {}, {
	_initializeScheme: function () {
		var scheme = this._inherited(BetaJS.Server.Sessions.PersistentSessionModel, "_initializeScheme");
		scheme["token"] = {
			type: "string",
			index: true
		};
		scheme["created"] = {
			type: "date",
			index: true
		};
		return scheme;
	}
});
BetaJS.Class.extend("BetaJS.Server.Session.RMIManagerHelper", {
	
	__add_active_session: function (session, active_session) {
		active_session.addHelper(BetaJS.Server.Session.RMIHelper);
	}
	
});

BetaJS.Class.extend("BetaJS.Server.Session.RMIHelper", {

    constructor: function (active_session) {
        this._inherited(BetaJS.Server.Session.RMIHelper, "constructor");
        this.__active_session = active_session;
        active_session.rmi = this;
        this.__rmi_sender = new BetaJS.Net.SocketSenderChannel(null, "rmi", false);
        this.__rmi_receiver = new BetaJS.Net.SocketReceiverChannel(null, "rmi");
        this.__rmi_peer = new BetaJS.RMI.Peer(this.__rmi_sender, this.__rmi_receiver);
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
            this.stubs[key].destroy;
        for (key in this.skeletons)
            this.skeletons[key].destroy;
        this.__rmi_peer.destroy();
        this.__rmi_receiver.destroy();
        this.__rmi_sender.destroy();
        this._inherited(BetaJS.Server.Session.RMIHelper, "destroy");
    }
      
});

BetaJS.Class.extend("BetaJS.Server.Session.SocketsManagerHelper", {
	
	constructor: function (manager) {
		this._inherited(BetaJS.Server.Session.SocketsManagerHelper, "constructor");
		this.__manager = manager;
		manager.bind_socket = function (socket, session_cookie, data) {
			var session_token = BetaJS.Strings.read_cookie_string(socket.handshake.headers.cookie, session_cookie, data);
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
		active_session.addHelper(BetaJS.Server.Session.SocketsHelper);
	}
	
});

BetaJS.Class.extend("BetaJS.Server.Session.SocketsHelper", {

    constructor: function (active_session) {
        this._inherited(BetaJS.Server.Session.SocketsHelper, "constructor");
        this.__active_session = active_session;
        active_session.socket = this;
    },
    
    destroy: function () {
        this.unbind_socket();
        this._inherited(BetaJS.Server.Session.SocketsHelper, "destroy");
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
        this.__socket = null;
        this.__active_session.activity();
        this.__active_session.trigger("unbind_socket");
    },
    
    socket: function () {
        return this.__socket;
    }
      
});

BetaJS.Class.extend("BetaJS.Databases.Database", {
	
	_tableClass: function () {
		return null;
	},
	
	getTable: function (table_name) {
		var cls = this._tableClass();		
		return new cls(this, table_name);
	}
		
});

BetaJS.Class.extend("BetaJS.Databases.DatabaseTable", {
	
	constructor: function (database, table_name) {
		this._inherited(BetaJS.Databases.DatabaseTable, "constructor");
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
			return new BetaJS.Iterators.MappedIterator(result, this._decode, this);
		}, this);
	},
	
	findById: function (id) {
		return this.findOne({id : id});
	},
	
	_insertRow: function (row) {		
	},
	
	_removeRow: function (query) {		
	},
	
	_updateRow: function (query, row) {
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
	
});
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
BetaJS.Databases.DatabaseTable.extend("BetaJS.Databases.MongoDatabaseTable", {
	
	table: function () {
		if (this.__table)
			return BetaJS.Promise.create(this.__table);
		return this._database.mongodb().mapSuccess(function (db) {
			this.__table = db.collection(this._table_name);
			return this.__table;
		}, this);
	},
	
	_encode: function (data) {
		var obj = BetaJS.Objs.clone(data, 1);
		if ("id" in data) {
			delete obj["id"];
            var objid = this._database.mongo_object_id();
            obj._id = new objid(data.id + "");
		}
		return obj;
	},
	
	_decode: function (data) {
		var obj = BetaJS.Objs.clone(data, 1);
		if ("_id" in data) {
			delete obj["_id"];
			obj.id = data._id;
		}
		return obj;
	},

	_find: function (query, options) {
		return this.table().mapSuccess(function (table) {
			return BetaJS.Promise.funcCallback(table, table.find, query).mapSuccess(function (result) {
				options = options || {};
				if ("sort" in options)
					result = result.sort(options.sort);
				if ("skip" in options)
					result = result.skip(options.skip);
				if ("limit" in options)
					result = result.limit(options.limit);
				return BetaJS.Promise.funcCallback(result, result.toArray).mapSuccess(function (cols) {
					return new BetaJS.Iterators.ArrayIterator(cols);
				}, this);
			}, this);
		}, this);
	},

	_insertRow: function (row) {
		return this.table().mapSuccess(function (table) {
			return BetaJS.Promise.funcCallback(table, table.insert, row).mapSuccess(function (result) {
				return result[0] ? result[0] : result;
			}, this);
		}, this);
	},
	
	_removeRow: function (query, callbacks) {
		return this.table().mapSuccess(function (table) {
			return BetaJS.Promise.funcCallback(table, table.remove, query); 
		}, this);
	},
	
	_updateRow: function (query, row, callbacks) {
		return this.table().mapSuccess(function (table) {
			return BetaJS.Promise.funcCallback(table, table.update, query, {"$set" : row}).mapSuccess(function () {
				return row;
			}); 
		}, this);
	},
		
	ensureIndex: function (key) {
		var obj = {};
		obj[key] = 1;
		this.table().success(function (table) {
			table.ensureIndex(BetaJS.Objs.objectBy(key, 1));
		});
	}	

});

BetaJS.Stores.BaseStore.extend("BetaJS.Stores.DatabaseStore", {
	
	constructor: function (database, table_name, foreign_id) {
		this._inherited(BetaJS.Stores.DatabaseStore, "constructor");
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
	    return this.table().findOne(BetaJS.Objs.objectBy(this.__foreign_id, data[this.__foreign_id])).mapSuccess(function (result) {
	    	return result ? result : this.table().insertRow(data);
	    }, this);
	},
	
	_remove: function (id) {
	    if (!this.__foreign_id)
		    return this.table().removeById(id);
		return this.table().removeRow(BetaJS.Objs.objectBy(this.__foreign_id, id));
	},
	
	_get: function (id) {
        if (!this.__foreign_id)
    		return this.table().findById(id);
	    return this.table().findOne(BetaJS.Objs.objectBy(this.__foreign_id, id));
	},
	
	_update: function (id, data) {
        if (!this.__foreign_id)
    		return this.table().updateById(id, data);
        return this.updateRow(BetaJS.Objs.objectBy(this.__foreign_id, id), data);
	},
	
	_query_capabilities: function () {
		return {
			"query": true,
			"sort": true,
			"skip": true,
			"limit": true
		};
	},
	
	_query: function (query, options) {
		return this.table().find(query, options);
	},
	
	_ensure_index: function (key) {
		this.table().ensureIndex(key);
	}

});

BetaJS.Stores.ConversionStore.extend("BetaJS.Stores.MongoDatabaseStore", {
	
	constructor: function (database, table_name, types, foreign_id) {
		var store = new BetaJS.Stores.DatabaseStore(database, table_name, foreign_id);
		var encoding = {};
		var decoding = {};
		types = types || {};
        var ObjectId = database.mongo_object_id();
        if (!foreign_id)
		    types.id = "id";
		for (var key in types) {
			if (types[key] == "id") {
				encoding[key] = function (value) {
					return value ? new ObjectId(value + "") : null;
				};
				decoding[key] = function (value) {
					return value ? value + "" : null;
				};
			}
		}
		var opts = {
            value_encoding: encoding,
            value_decoding: decoding
		};
		if (foreign_id) {
		    opts.key_encoding = {
		        "id": foreign_id
		    };
		    opts.key_encoding[foreign_id] = null;
            opts.key_decoding = {
                "id": null
            };
            opts.key_encoding[foreign_id] = "id";
		}
		this._inherited(BetaJS.Stores.MongoDatabaseStore, "constructor", store, opts);
	},
	
	table: function () {
		return this.store().table();
	}

});

BetaJS.Class.extend("BetaJS.Stores.Migrator", {
	
	constructor: function () {
		this._inherited(BetaJS.Stores.Migrator, "constructor");
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
		var target = BetaJS.Types.is_defined(version) ? this._indexByVersion(version) : this.__migrations.length - 1;		
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
					migration.partial_rollback();
				} catch (e) {
					this._log("Failure! Couldn't roll back " + migration.version + "!\n");
					throw e;
				}
				this._log("Rolled back " + migration.version + "!\n");
				throw e;
			}
		}
	},
	
	rollback: function (version) {
		var current = this._indexByVersion(this.version());
		var target = BetaJS.Types.is_defined(version) ? this._indexByVersion(target) : -1;
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
	
});

BetaJS.Stores.BaseStore.extend("BetaJS.Stores.ImapStore", {
	
	constructor: function (options) {
		this._inherited(BetaJS.Stores.ImapStore, "constructor", options);
		this.__imap = BetaJS.Objs.extend(BetaJS.Objs.clone(options.base, 1), options.imap);
		this.__smtp = BetaJS.Objs.extend(BetaJS.Objs.clone(options.base, 1), options.smtp);
		this.__imap_opts = options.imap_options || {};
		this.__imap_opts.reconnect_on_error = false;
	},
	
	test: function () {
		var imap = new BetaJS.Server.Net.Imap(this.__imap, this.__imap_opts);
		return imap.connect().callback(imap.destroy, imap);
	},
	
	_query_capabilities: function () {
		return {
			skip: true,
			limit: true
		};
	},

	_query: function (query, options) {
		var self = this;
		var imap = new BetaJS.Server.Net.Imap(this.__imap, this.__imap_opts);
		return imap.connect().mapSuccess(function () {
			var opts = {};
			if ("skip" in options)
				opts.seq_start = options.skip + 1;
			if ("limit" in options)
				opts.seq_count = options.limit;
			opts.reverse = true;
			return imap.fetch(opts).success(function (mails) {
				imap.destroy();
			}, this);
		}, this);
	},
	
	_insert: function (mail) {
		BetaJS.Server.Net.Smtp.send(this.__smtp, {
 			from: mail.from,
 			to: mail.to,
 			subject: mail.subject,
			text_body: mail.text_body
		}).mapCallback(function (err, msg) {
			if (err)
				return new BetaJS.Stores.StoreException(err);
			mail.id = msg.header["message-id"];
			return mail;
		});
	}
	
});


BetaJS.Stores.ListenerStore.extend("BetaJS.Stores.ImapListenerStore", {

	constructor: function (options) {
		this._inherited(BetaJS.Stores.ImapListenerStore, "constructor", options);
		var opts = BetaJS.Objs.extend(BetaJS.Objs.clone(options.base, 1), options.imap);
		var imap = new BetaJS.Server.Net.Imap(opts, {reonnect_on_error: true});
		this._auto_destroy(imap);
		imap.on("new_mail", function (count) {
			imap.fetch({seq_count: count, reverse: true}).success(function (mails) {
				BetaJS.Objs.iter(mails, function (mail) {
					this._inserted(mail);
				}, this);
			}, this);
		}, this);
		imap.connect();
	}
	
});