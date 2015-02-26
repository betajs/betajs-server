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