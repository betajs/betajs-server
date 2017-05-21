Scoped.define("module:Ajax.NodeAjax", [
    "base:Ajax.Support",
    "base:Net.Uri",
    "base:Net.HttpHeader",
    "base:Promise",
    "base:Objs",
    "base:Types",
    "base:Ajax.RequestException"
], function (AjaxSupport, Uri, HttpHeader, Promise, Objs, Types, RequestException) {
	
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
  				path: parsed.path + (parsed.query ? "?" + parsed.query : "")
  			};
			opts.headers = {};
			if (parsed.user || parsed.password) {
				opts.headers.Authorization = 'Basic ' + new Buffer(parsed.user + ':' + parsed.password).toString('base64');
			} else if (options.bearer) {
				opts.headers.Authorization = 'Bearer ' + options.bearer;
			}
			var post_data = null;
			var form = null;
			if (options.method !== "GET" && !Types.is_empty(options.data)) {
				var FS = require("fs"); 
				Objs.iter(options.data, function (value) {
					if (!form && (value instanceof FS.ReadStream))
						form = new (require('form-data'))();
				});
				if (form) {
					Objs.iter(options.data, function (value, key) {
						form.append(key, value);
					});
				} else if (options.contentType === "json") {
					if (options.sendContentType)
						opts.headers["Content-Type"] = "application/json;charset=UTF-8";
					post_data = JSON.stringify(options.data);
				} else {
					if (options.sendContentType)
						opts.headers["Content-type"] = "application/x-www-form-urlencoded";
					post_data = Uri.encodeUriParams(options.data, undefined, true);
				}
				if (post_data)
					opts.headers['Content-Length'] = post_data.length;
  			}

			var promise = Promise.create();

			if (options.cookies)
				opts.headers.Cookie = Uri.encodeUriParams(options.cookies);
			
			if (form)
				opts.headers = Objs.extend(opts.headers, form.getHeaders());
			
  			var request = require(parsed.protocol === "https" ? "https" : "http").request(opts, function (result) {
  				var data = "";
  				result.on("data", function (chunk) {
  					data += chunk;
  				}).on("end", function () {
  					if (HttpHeader.isSuccessStatus(result.statusCode)) {
				    	// TODO: Figure out response type.
				    	AjaxSupport.promiseReturnData(promise, options, data, options.decodeType || "json");
			    	} else {
			    		AjaxSupport.promiseRequestException(promise, result.statusCode, result.statusText, data, options.decodeType || "json");
			    	}
  				});
  			});
  			if (form)
  				form.pipe(request);
  			else {
  				if (post_data && post_data.length > 0)
  					request.write(post_data);
  				request.end();
  			}

  			return promise;
		}
			
	};
	
	AjaxSupport.register(Module, 10);
	
	return Module;
});

