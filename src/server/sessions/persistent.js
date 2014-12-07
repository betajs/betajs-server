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