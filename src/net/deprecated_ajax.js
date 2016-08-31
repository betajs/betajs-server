Scoped.define("module:Net.HttpAjax", [      
        "base:Net.Ajax",
        "base:Promise",
        "base:Net.Uri"
    ], function (Ajax, Promise, Uri, scoped) {
    var Cls = Ajax.extend({scoped: scoped}, {
		
		_asyncCall: function (options) {
			var parsed = Uri.parse(options.uri);
			var opts = {
				method: options.method,
				host: parsed.host,
				port: parsed.port,
				path: parsed.path
			};		
			var post_data = null;
			if (options.data) {
				if (opts.method == "GET") {
					opts.path = opts.path + "?" + require("querystring").stringify(options.data);
				} else {
					post_data = require("querystring").stringify(options.data);
					if (post_data.length > 0)
						opts.headers = {
				          'Content-Type': 'application/x-www-form-urlencoded',
				          'Content-Length': post_data.length
					    };
				}			
			}
			var promise = Promise.create();
			var request = require("http").request(opts, function (result) {
				var data = "";
				result.on("data", function (chunk) {
					data += chunk;
				}).on("end", function () {
					if (result.statusCode >= 200 && result.statusCode < 300)
						promise.asyncSuccess(data);
					else
						promise.asyncError(data);
				});
			});
			if (post_data && post_data.length > 0)
				request.write(post_data);
			request.end();
			return promise;
		}
	
    }, {
		
		supported: function (options) {
			return true;
		}
	
	});
    
    Ajax.register(Cls, 1);
    
    return Cls;
});