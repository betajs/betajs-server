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
	
		dispatch : function(method, request, response, next) {
			this._beforeDispatch(method, request, response).success(function () {
				var result = this[method](request, response);
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
	
