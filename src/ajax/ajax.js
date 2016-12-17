Scoped.define("module:Ajax.NodeAjax", [
    "base:Ajax.Support",
    "base:Net.Uri",
    "base:Net.HttpHeader",
    "base:Promise",
    "base:Types",
    "base:Ajax.RequestException"
], function (AjaxSupport, Uri, HttpHeader, Promise, Types, RequestException) {
	
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
  				path: parsed.path
  			};
			if (parsed.user || parsed.password) {
				opts.headers = {
					'Authorization': 'Basic ' + new Buffer(parsed.user + ':' + parsed.password).toString('base64')
				};
			}
			var post_data = null;
			if (options.method !== "GET" && !Types.is_empty(options.data)) {
				opts.headers = {};
				if (options.contentType === "json") {
					if (options.sendContentType)
						opts.headers["Content-Type"] = "application/json;charset=UTF-8";
					post_data = JSON.stringify(options.data);
				} else {
					if (options.sendContentType)
						opts.headers["Content-type"] = "application/x-www-form-urlencoded";
					post_data = Uri.encodeUriParams(options.data, undefined, true);
				}
				opts.headers['Content-Length'] = post_data.length;
  			}

			var promise = Promise.create();
			
  			var request = require(parsed.protocol === "https" ? "https" : "http").request(opts, function (result) {
  				var data = "";
  				result.on("data", function (chunk) {
  					data += chunk;
  				}).on("end", function () {
  					if (HttpHeader.isSuccessStatus(result.statusCode)) {
				    	// TODO: Figure out response type.
				    	AjaxSupport.promiseReturnData(promise, options, data, "json"); //options.decodeType);
			    	} else {
			    		AjaxSupport.promiseRequestException(promise, result.statusCode, result.statusText, data, "json"); //options.decodeType);)
			    	}
  				});
  			});
   			if (post_data && post_data.length > 0)
  				request.write(post_data);
  			request.end();

  			return promise;
		}
			
	};
	
	AjaxSupport.register(Module, 10);
	
	return Module;
});

