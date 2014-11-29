BetaJS.Class.extend("BetaJS.Server.Net.Controller", {}, {
	
	_beforeDispatch : function(method, request, response, callback) {
		callback.call(this);
	},

	dispatch : function(method, request, response, next) {
		this._beforeDispatch(method, request, response, function () {
			var self = this;
			self[method](request, response, {
				success : function() {
					if (BetaJS.Types.is_defined(next))
						next();
				},
				exception : function(e) {
					e = BetaJS.Server.Net.ControllerException.ensure(e);
					response.status(e.code()).send(JSON.stringify(e.data()));
				}
			});
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
	
	_obtainSession: function (session_manager, session_cookie_key, method, request, response, callback) {
		session_manager.obtain_session(request.cookies[session_cookie_key], {}, {
			success: function (session) {
				request.session = session;
				response.cookie(session_cookie_key, session.cid(), {
					maxAge: session_manager.options().invalidation.session_timeout
				});
				callback.call(this);
			},
			context: this
		});
	}
		
};
