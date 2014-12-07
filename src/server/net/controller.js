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
