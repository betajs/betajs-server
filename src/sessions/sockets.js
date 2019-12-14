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

