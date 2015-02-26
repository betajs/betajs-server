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

