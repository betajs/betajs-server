/*!
betajs-server - v1.0.29 - 2023-12-08
Copyright (c) Oliver Friedmann
Apache-2.0 Software License.
*/
/** @flow **//*!
betajs-scoped - v0.0.22 - 2019-10-23
Copyright (c) Oliver Friedmann
Apache-2.0 Software License.
*/
var Scoped = (function () {
var Globals = (function () {  
/** 
 * This helper module provides functions for reading and writing globally accessible namespaces, both in the browser and in NodeJS.
 * 
 * @module Globals
 * @access private
 */
return {
		
	/**
	 * Returns the value of a global variable.
	 * 
	 * @param {string} key identifier of a global variable
	 * @return value of global variable or undefined if not existing
	 */
	get : function(key/* : string */) {
		if (typeof window !== "undefined")
			return key ? window[key] : window;
		if (typeof global !== "undefined")
			return key ? global[key] : global;
		if (typeof self !== "undefined")
			return key ? self[key] : self;
		return undefined;
	},

	
	/**
	 * Sets a global variable.
	 * 
	 * @param {string} key identifier of a global variable
	 * @param value value to be set
	 * @return value that has been set
	 */
	set : function(key/* : string */, value) {
		if (typeof window !== "undefined")
			window[key] = value;
		if (typeof global !== "undefined")
			global[key] = value;
		if (typeof self !== "undefined")
			self[key] = value;
		return value;
	},
	
	
	/**
	 * Returns the value of a global variable under a namespaced path.
	 * 
	 * @param {string} path namespaced path identifier of variable
	 * @return value of global variable or undefined if not existing
	 * 
	 * @example
	 * // returns window.foo.bar / global.foo.bar 
	 * Globals.getPath("foo.bar")
	 */
	getPath: function (path/* : string */) {
		if (!path)
			return this.get();
		var args = path.split(".");
		if (args.length == 1)
			return this.get(path);		
		var current = this.get(args[0]);
		for (var i = 1; i < args.length; ++i) {
			if (!current)
				return current;
			current = current[args[i]];
		}
		return current;
	},


	/**
	 * Sets a global variable under a namespaced path.
	 * 
	 * @param {string} path namespaced path identifier of variable
	 * @param value value to be set
	 * @return value that has been set
	 * 
	 * @example
	 * // sets window.foo.bar / global.foo.bar 
	 * Globals.setPath("foo.bar", 42);
	 */
	setPath: function (path/* : string */, value) {
		var args = path.split(".");
		if (args.length == 1)
			return this.set(path, value);		
		var current = this.get(args[0]) || this.set(args[0], {});
		for (var i = 1; i < args.length - 1; ++i) {
			if (!(args[i] in current))
				current[args[i]] = {};
			current = current[args[i]];
		}
		current[args[args.length - 1]] = value;
		return value;
	}
	
};}).call(this);
/*::
declare module Helper {
	declare function extend<A, B>(a: A, b: B): A & B;
}
*/

var Helper = (function () {  
/** 
 * This helper module provides auxiliary functions for the Scoped system.
 * 
 * @module Helper
 * @access private
 */
return { 
		
	/**
	 * Attached a context to a function.
	 * 
	 * @param {object} obj context for the function
	 * @param {function} func function
	 * 
	 * @return function with attached context
	 */
	method: function (obj, func) {
		return function () {
			return func.apply(obj, arguments);
		};
	},

	
	/**
	 * Extend a base object with all attributes of a second object.
	 * 
	 * @param {object} base base object
	 * @param {object} overwrite second object
	 * 
	 * @return {object} extended base object
	 */
	extend: function (base, overwrite) {
		base = base || {};
		overwrite = overwrite || {};
		for (var key in overwrite)
			base[key] = overwrite[key];
		return base;
	},
	
	
	/**
	 * Returns the type of an object, particulary returning 'array' for arrays.
	 * 
	 * @param obj object in question
	 * 
	 * @return {string} type of object
	 */
	typeOf: function (obj) {
		return Object.prototype.toString.call(obj) === '[object Array]' ? "array" : typeof obj;
	},
	
	
	/**
	 * Returns whether an object is null, undefined, an empty array or an empty object.
	 * 
	 * @param obj object in question
	 * 
	 * @return true if object is empty
	 */
	isEmpty: function (obj) {
		if (obj === null || typeof obj === "undefined")
			return true;
		if (this.typeOf(obj) == "array")
			return obj.length === 0;
		if (typeof obj !== "object")
			return false;
		for (var key in obj)
			return false;
		return true;
	},
	
	
    /**
     * Matches function arguments against some pattern.
     * 
     * @param {array} args function arguments
     * @param {object} pattern typed pattern
     * 
     * @return {object} matched arguments as associative array 
     */	
	matchArgs: function (args, pattern) {
		var i = 0;
		var result = {};
		for (var key in pattern) {
			if (pattern[key] === true || this.typeOf(args[i]) == pattern[key]) {
				result[key] = args[i];
				i++;
			} else if (this.typeOf(args[i]) == "undefined")
				i++;
		}
		return result;
	},
	
	
	/**
	 * Stringifies a value as JSON and functions to string representations.
	 * 
	 * @param value value to be stringified
	 * 
	 * @return stringified value
	 */
	stringify: function (value) {
		if (this.typeOf(value) == "function")
			return "" + value;
		return JSON.stringify(value);
	}	

	
};}).call(this);
var Attach = (function () {  
/** 
 * This module provides functionality to attach the Scoped system to the environment.
 * 
 * @module Attach
 * @access private
 */
return { 
		
	__namespace: "Scoped",
	__revert: null,
	
	
	/**
	 * Upgrades a pre-existing Scoped system to the newest version present. 
	 * 
	 * @param {string} namespace Optional namespace (default is 'Scoped')
	 * @return {object} the attached Scoped system
	 */
	upgrade: function (namespace/* : ?string */) {
		var current = Globals.get(namespace || Attach.__namespace);
		if (current && Helper.typeOf(current) === "object" && current.guid === this.guid && Helper.typeOf(current.version) === "string") {
			if (this.upgradable === false || current.upgradable === false)
				return current;
			var my_version = this.version.split(".");
			var current_version = current.version.split(".");
			var newer = false;
			for (var i = 0; i < Math.min(my_version.length, current_version.length); ++i) {
				newer = parseInt(my_version[i], 10) > parseInt(current_version[i], 10);
				if (my_version[i] !== current_version[i])
					break;
			}
			return newer ? this.attach(namespace) : current;				
		} else
			return this.attach(namespace);		
	},


	/**
	 * Attaches the Scoped system to the environment. 
	 * 
	 * @param {string} namespace Optional namespace (default is 'Scoped')
	 * @return {object} the attached Scoped system
	 */
	attach : function(namespace/* : ?string */) {
		if (namespace)
			Attach.__namespace = namespace;
		var current = Globals.get(Attach.__namespace);
		if (current === this)
			return this;
		Attach.__revert = current;
		if (current) {
			try {
				var exported = current.__exportScoped();
				this.__exportBackup = this.__exportScoped();
				this.__importScoped(exported);
			} catch (e) {
				// We cannot upgrade the old version.
			}
		}
		Globals.set(Attach.__namespace, this);
		return this;
	},
	

	/**
	 * Detaches the Scoped system from the environment. 
	 * 
	 * @param {boolean} forceDetach Overwrite any attached scoped system by null.
	 * @return {object} the detached Scoped system
	 */
	detach: function (forceDetach/* : ?boolean */) {
		if (forceDetach)
			Globals.set(Attach.__namespace, null);
		if (typeof Attach.__revert != "undefined")
			Globals.set(Attach.__namespace, Attach.__revert);
		delete Attach.__revert;
		if (Attach.__exportBackup)
			this.__importScoped(Attach.__exportBackup);
		return this;
	},
	

	/**
	 * Exports an object as a module if possible. 
	 * 
	 * @param {object} mod a module object (optional, default is 'module')
	 * @param {object} object the object to be exported
	 * @param {boolean} forceExport overwrite potentially pre-existing exports
	 * @return {object} the Scoped system
	 */
	exports: function (mod, object, forceExport) {
		mod = mod || (typeof module != "undefined" ? module : null);
		if (typeof mod == "object" && mod && "exports" in mod && (forceExport || mod.exports === this || !mod.exports || Helper.isEmpty(mod.exports)))
			mod.exports = object || this;
		return this;
	}	

};}).call(this);

function newNamespace (opts/* : {tree ?: boolean, global ?: boolean, root ?: Object} */) {

	var options/* : {
		tree: boolean,
	    global: boolean,
	    root: Object
	} */ = {
		tree: typeof opts.tree === "boolean" ? opts.tree : false,
		global: typeof opts.global === "boolean" ? opts.global : false,
		root: typeof opts.root === "object" ? opts.root : {}
	};

	/*::
	type Node = {
		route: ?string,
		parent: ?Node,
		children: any,
		watchers: any,
		data: any,
		ready: boolean,
		lazy: any
	};
	*/

	function initNode(options)/* : Node */ {
		return {
			route: typeof options.route === "string" ? options.route : null,
			parent: typeof options.parent === "object" ? options.parent : null,
			ready: typeof options.ready === "boolean" ? options.ready : false,
			children: {},
			watchers: [],
			data: {},
			lazy: []
		};
	}
	
	var nsRoot = initNode({ready: true});
	
	if (options.tree) {
		if (options.global) {
			try {
				if (window)
					nsRoot.data = window;
			} catch (e) { }
			try {
				if (global)
					nsRoot.data = global;
			} catch (e) { }
			try {
				if (self)
					nsRoot.data = self;
			} catch (e) { }
		} else
			nsRoot.data = options.root;
	}
	
	function nodeDigest(node/* : Node */) {
		if (node.ready)
			return;
		if (node.parent && !node.parent.ready) {
			nodeDigest(node.parent);
			return;
		}
		if (node.route && node.parent && (node.route in node.parent.data)) {
			node.data = node.parent.data[node.route];
			node.ready = true;
			for (var i = 0; i < node.watchers.length; ++i)
				node.watchers[i].callback.call(node.watchers[i].context || this, node.data);
			node.watchers = [];
			for (var key in node.children)
				nodeDigest(node.children[key]);
		}
	}
	
	function nodeEnforce(node/* : Node */) {
		if (node.ready)
			return;
		if (node.parent && !node.parent.ready)
			nodeEnforce(node.parent);
		node.ready = true;
		if (node.parent) {
			if (options.tree && typeof node.parent.data == "object")
				node.parent.data[node.route] = node.data;
		}
		for (var i = 0; i < node.watchers.length; ++i)
			node.watchers[i].callback.call(node.watchers[i].context || this, node.data);
		node.watchers = [];
	}
	
	function nodeSetData(node/* : Node */, value) {
		if (typeof value == "object" && node.ready) {
			for (var key in value)
				node.data[key] = value[key];
		} else
			node.data = value;
		if (typeof value == "object") {
			for (var ckey in value) {
				if (node.children[ckey])
					node.children[ckey].data = value[ckey];
			}
		}
		nodeEnforce(node);
		for (var k in node.children)
			nodeDigest(node.children[k]);
	}
	
	function nodeClearData(node/* : Node */) {
		if (node.ready && node.data) {
			for (var key in node.data)
				delete node.data[key];
		}
	}
	
	function nodeNavigate(path/* : ?String */) {
		if (!path)
			return nsRoot;
		var routes = path.split(".");
		var current = nsRoot;
		for (var i = 0; i < routes.length; ++i) {
			if (routes[i] in current.children)
				current = current.children[routes[i]];
			else {
				current.children[routes[i]] = initNode({
					parent: current,
					route: routes[i]
				});
				current = current.children[routes[i]];
				nodeDigest(current);
			}
		}
		return current;
	}
	
	function nodeAddWatcher(node/* : Node */, callback, context) {
		if (node.ready)
			callback.call(context || this, node.data);
		else {
			node.watchers.push({
				callback: callback,
				context: context
			});
			if (node.lazy.length > 0) {
				var f = function (node) {
					if (node.lazy.length > 0) {
						var lazy = node.lazy.shift();
						lazy.callback.call(lazy.context || this, node.data);
						f(node);
					}
				};
				f(node);
			}
		}
	}
	
	function nodeUnresolvedWatchers(node/* : Node */, base, result) {
		node = node || nsRoot;
		result = result || [];
		if (!node.ready && node.lazy.length === 0 && node.watchers.length > 0)
			result.push(base);
		for (var k in node.children) {
			var c = node.children[k];
			var r = (base ? base + "." : "") + c.route;
			result = nodeUnresolvedWatchers(c, r, result);
		}
		return result;
	}

	/** 
	 * The namespace module manages a namespace in the Scoped system.
	 * 
	 * @module Namespace
	 * @access public
	 */
	return {
		
		/**
		 * Extend a node in the namespace by an object.
		 * 
		 * @param {string} path path to the node in the namespace
		 * @param {object} value object that should be used for extend the namespace node
		 */
		extend: function (path, value) {
			nodeSetData(nodeNavigate(path), value);
		},
		
		/**
		 * Set the object value of a node in the namespace.
		 * 
		 * @param {string} path path to the node in the namespace
		 * @param {object} value object that should be used as value for the namespace node
		 */
		set: function (path, value) {
			var node = nodeNavigate(path);
			if (node.data)
				nodeClearData(node);
			nodeSetData(node, value);
		},
		
		/**
		 * Read the object value of a node in the namespace.
		 * 
		 * @param {string} path path to the node in the namespace
		 * @return {object} object value of the node or null if undefined
		 */
		get: function (path) {
			var node = nodeNavigate(path);
			return node.ready ? node.data : null;
		},
		
		/**
		 * Lazily navigate to a node in the namespace.
		 * Will asynchronously call the callback as soon as the node is being touched.
		 *
		 * @param {string} path path to the node in the namespace
		 * @param {function} callback callback function accepting the node's object value
		 * @param {context} context optional callback context
		 */
		lazy: function (path, callback, context) {
			var node = nodeNavigate(path);
			if (node.ready)
				callback(context || this, node.data);
			else {
				node.lazy.push({
					callback: callback,
					context: context
				});
			}
		},
		
		/**
		 * Digest a node path, checking whether it has been defined by an external system.
		 * 
		 * @param {string} path path to the node in the namespace
		 */
		digest: function (path) {
			nodeDigest(nodeNavigate(path));
		},
		
		/**
		 * Asynchronously access a node in the namespace.
		 * Will asynchronously call the callback as soon as the node is being defined.
		 *
		 * @param {string} path path to the node in the namespace
		 * @param {function} callback callback function accepting the node's object value
		 * @param {context} context optional callback context
		 */
		obtain: function (path, callback, context) {
			nodeAddWatcher(nodeNavigate(path), callback, context);
		},
		
		/**
		 * Returns all unresolved watchers under a certain path.
		 * 
		 * @param {string} path path to the node in the namespace
		 * @return {array} list of all unresolved watchers 
		 */
		unresolvedWatchers: function (path) {
			return nodeUnresolvedWatchers(nodeNavigate(path), path);
		},
		
		__export: function () {
			return {
				options: options,
				nsRoot: nsRoot
			};
		},
		
		__import: function (data) {
			options = data.options;
			nsRoot = data.nsRoot;
		}
		
	};
	
}
function newScope (parent, parentNS, rootNS, globalNS) {
	
	var self = this;
	var nextScope = null;
	var childScopes = [];
	var parentNamespace = parentNS;
	var rootNamespace = rootNS;
	var globalNamespace = globalNS;
	var localNamespace = newNamespace({tree: true});
	var privateNamespace = newNamespace({tree: false});
	
	var bindings = {
		"global": {
			namespace: globalNamespace
		}, "root": {
			namespace: rootNamespace
		}, "local": {
			namespace: localNamespace
		}, "default": {
			namespace: privateNamespace
		}, "parent": {
			namespace: parentNamespace
		}, "scope": {
			namespace: localNamespace,
			readonly: false
		}
	};
	
	var custom = function (argmts, name, callback) {
		var args = Helper.matchArgs(argmts, {
			options: "object",
			namespaceLocator: true,
			dependencies: "array",
			hiddenDependencies: "array",
			callback: true,
			context: "object"
		});
		
		var options = Helper.extend({
			lazy: this.options.lazy
		}, args.options || {});
		
		var ns = this.resolve(args.namespaceLocator);
		
		var execute = function () {
			this.require(args.dependencies, args.hiddenDependencies, function () {
                var _arguments = [];
                for (var a = 0; a < arguments.length; ++a)
                    _arguments.push(arguments[a]);
                _arguments[_arguments.length - 1].ns = ns;
				if (this.options.compile) {
					var params = [];
					for (var i = 0; i < argmts.length; ++i)
						params.push(Helper.stringify(argmts[i]));
					this.compiled += this.options.ident + "." + name + "(" + params.join(", ") + ");\n\n";
				}
				if (this.options.dependencies) {
					this.dependencies[ns.path] = this.dependencies[ns.path] || {};
					if (args.dependencies) {
						args.dependencies.forEach(function (dep) {
							this.dependencies[ns.path][this.resolve(dep).path] = true;
						}, this);
					}
					if (args.hiddenDependencies) {
						args.hiddenDependencies.forEach(function (dep) {
							this.dependencies[ns.path][this.resolve(dep).path] = true;
						}, this);
					}
				}
				var result = this.options.compile ? {} : args.callback.apply(args.context || this, _arguments);
				callback.call(this, ns, result);
			}, this);
		};
		
		if (options.lazy)
			ns.namespace.lazy(ns.path, execute, this);
		else
			execute.apply(this);

		return this;
	};
	
	/** 
	 * This module provides all functionality in a scope.
	 * 
	 * @module Scoped
	 * @access public
	 */
	return {
		
		getGlobal: Helper.method(Globals, Globals.getPath),
		setGlobal: Helper.method(Globals, Globals.setPath),
		
		options: {
			lazy: false,
			ident: "Scoped",
			compile: false,
			dependencies: false
		},
		
		compiled: "",
		
		dependencies: {},
		
		
		/**
		 * Returns a reference to the next scope that will be obtained by a subScope call.
		 * 
		 * @return {object} next scope
		 */
		nextScope: function () {
			if (!nextScope)
				nextScope = newScope(this, localNamespace, rootNamespace, globalNamespace);
			return nextScope;
		},
		
		/**
		 * Creates a sub scope of the current scope and returns it.
		 * 
		 * @return {object} sub scope
		 */
		subScope: function () {
			var sub = this.nextScope();
			childScopes.push(sub);
			nextScope = null;
			return sub;
		},
		
		/**
		 * Creates a binding within in the scope. 
		 * 
		 * @param {string} alias identifier of the new binding
		 * @param {string} namespaceLocator identifier of an existing namespace path
		 * @param {object} options options for the binding
		 * 
		 */
		binding: function (alias, namespaceLocator, options) {
			if (!bindings[alias] || !bindings[alias].readonly) {
				var ns;
				if (Helper.typeOf(namespaceLocator) != "string") {
					ns = {
						namespace: newNamespace({
							tree: true,
							root: namespaceLocator
						}),
						path: null	
					};
				} else
					ns = this.resolve(namespaceLocator);
				bindings[alias] = Helper.extend(options, ns);
			}
			return this;
		},
		
		
		/**
		 * Resolves a name space locator to a name space.
		 * 
		 * @param {string} namespaceLocator name space locator
		 * @return {object} resolved name space
		 * 
		 */
		resolve: function (namespaceLocator) {
			var parts = namespaceLocator.split(":");
			if (parts.length == 1) {
                throw ("The locator '" + parts[0] + "' requires a namespace.");
			} else {
				var binding = bindings[parts[0]];
				if (!binding)
					throw ("The namespace '" + parts[0] + "' has not been defined (yet).");
				return {
					namespace: binding.namespace,
					path : binding.path && parts[1] ? binding.path + "." + parts[1] : (binding.path || parts[1])
				};
			}
		},

		
		/**
		 * Defines a new name space once a list of name space locators is available.
		 * 
		 * @param {string} namespaceLocator the name space that is to be defined
		 * @param {array} dependencies a list of name space locator dependencies (optional)
		 * @param {array} hiddenDependencies a list of hidden name space locators (optional)
		 * @param {function} callback a callback function accepting all dependencies as arguments and returning the new definition
		 * @param {object} context a callback context (optional)
		 * 
		 */
		define: function () {
			return custom.call(this, arguments, "define", function (ns, result) {
				if (ns.namespace.get(ns.path))
					throw ("Scoped namespace " + ns.path + " has already been defined. Use extend to extend an existing namespace instead");
				ns.namespace.set(ns.path, result);
			});
		},
		
		
		/**
		 * Assume a specific version of a module and fail if it is not met.
		 * 
		 * @param {string} assumption name space locator
		 * @param {string} version assumed version
		 * 
		 */
		assumeVersion: function () {
			var args = Helper.matchArgs(arguments, {
				assumption: true,
				dependencies: "array",
				callback: true,
				context: "object",
				error: "string"
			});
			var dependencies = args.dependencies || [];
			dependencies.unshift(args.assumption);
			this.require(dependencies, function () {
				var argv = arguments;
				var assumptionValue = argv[0].replace(/[^\d\.]/g, "");
				argv[0] = assumptionValue.split(".");
				for (var i = 0; i < argv[0].length; ++i)
					argv[0][i] = parseInt(argv[0][i], 10);
				if (Helper.typeOf(args.callback) === "function") {
					if (!args.callback.apply(args.context || this, args))
						throw ("Scoped Assumption '" + args.assumption + "' failed, value is " + assumptionValue + (args.error ? ", but assuming " + args.error : ""));
				} else {
					var version = (args.callback + "").replace(/[^\d\.]/g, "").split(".");
					for (var j = 0; j < Math.min(argv[0].length, version.length); ++j)
						if (parseInt(version[j], 10) > argv[0][j])
							throw ("Scoped Version Assumption '" + args.assumption + "' failed, value is " + assumptionValue + ", but assuming at least " + args.callback);
				}
			});
		},
		
		
		/**
		 * Extends a potentially existing name space once a list of name space locators is available.
		 * 
		 * @param {string} namespaceLocator the name space that is to be defined
		 * @param {array} dependencies a list of name space locator dependencies (optional)
		 * @param {array} hiddenDependencies a list of hidden name space locators (optional)
		 * @param {function} callback a callback function accepting all dependencies as arguments and returning the new additional definitions.
		 * @param {object} context a callback context (optional)
		 * 
		 */
		extend: function () {
			return custom.call(this, arguments, "extend", function (ns, result) {
				ns.namespace.extend(ns.path, result);
			});
		},
				
		
		/**
		 * Requires a list of name space locators and calls a function once they are present.
		 * 
		 * @param {array} dependencies a list of name space locator dependencies (optional)
		 * @param {array} hiddenDependencies a list of hidden name space locators (optional)
		 * @param {function} callback a callback function accepting all dependencies as arguments
		 * @param {object} context a callback context (optional)
		 * 
		 */
		require: function () {
			var args = Helper.matchArgs(arguments, {
				dependencies: "array",
				hiddenDependencies: "array",
				callback: "function",
				context: "object"
			});
			args.callback = args.callback || function () {};
			var dependencies = args.dependencies || [];
			var allDependencies = dependencies.concat(args.hiddenDependencies || []);
			var count = allDependencies.length;
			var deps = [];
			var environment = {};
			if (count) {
				var f = function (value) {
					if (this.i < deps.length)
						deps[this.i] = value;
					count--;
					if (count === 0) {
						deps.push(environment);
						args.callback.apply(args.context || this.ctx, deps);
					}
				};
				for (var i = 0; i < allDependencies.length; ++i) {
					var ns = this.resolve(allDependencies[i]);
					if (i < dependencies.length)
						deps.push(null);
					ns.namespace.obtain(ns.path, f, {
						ctx: this,
						i: i
					});
				}
			} else {
				deps.push(environment);
				args.callback.apply(args.context || this, deps);
			}
			return this;
		},

		
		/**
		 * Digest a name space locator, checking whether it has been defined by an external system.
		 * 
		 * @param {string} namespaceLocator name space locator
		 */
		digest: function (namespaceLocator) {
			var ns = this.resolve(namespaceLocator);
			ns.namespace.digest(ns.path);
			return this;
		},
		
		
		/**
		 * Returns all unresolved definitions under a namespace locator
		 * 
		 * @param {string} namespaceLocator name space locator, e.g. "global:"
		 * @return {array} list of all unresolved definitions 
		 */
		unresolved: function (namespaceLocator) {
			var ns = this.resolve(namespaceLocator);
			return ns.namespace.unresolvedWatchers(ns.path);
		},
		
		/**
		 * Exports the scope.
		 * 
		 * @return {object} exported scope
		 */
		__export: function () {
			return {
				parentNamespace: parentNamespace.__export(),
				rootNamespace: rootNamespace.__export(),
				globalNamespace: globalNamespace.__export(),
				localNamespace: localNamespace.__export(),
				privateNamespace: privateNamespace.__export()
			};
		},
		
		/**
		 * Imports a scope from an exported scope.
		 * 
		 * @param {object} data exported scope to be imported
		 * 
		 */
		__import: function (data) {
			parentNamespace.__import(data.parentNamespace);
			rootNamespace.__import(data.rootNamespace);
			globalNamespace.__import(data.globalNamespace);
			localNamespace.__import(data.localNamespace);
			privateNamespace.__import(data.privateNamespace);
		}
		
	};
	
}
var globalNamespace = newNamespace({tree: true, global: true});
var rootNamespace = newNamespace({tree: true});
var rootScope = newScope(null, rootNamespace, rootNamespace, globalNamespace);

var Public = Helper.extend(rootScope, (function () {  
/** 
 * This module includes all public functions of the Scoped system.
 * 
 * It includes all methods of the root scope and the Attach module.
 * 
 * @module Public
 * @access public
 */
return {
		
	guid: "4b6878ee-cb6a-46b3-94ac-27d91f58d666",
	version: '0.0.22',

	upgradable: true,
		
	upgrade: Attach.upgrade,
	attach: Attach.attach,
	detach: Attach.detach,
	exports: Attach.exports,
	
	/**
	 * Exports all data contained in the Scoped system.
	 * 
	 * @return data of the Scoped system.
	 * @access private
	 */
	__exportScoped: function () {
		return {
			globalNamespace: globalNamespace.__export(),
			rootNamespace: rootNamespace.__export(),
			rootScope: rootScope.__export()
		};
	},
	
	/**
	 * Import data into the Scoped system.
	 * 
	 * @param data of the Scoped system.
	 * @access private
	 */
	__importScoped: function (data) {
		globalNamespace.__import(data.globalNamespace);
		rootNamespace.__import(data.rootNamespace);
		rootScope.__import(data.rootScope);
	}
	
};

}).call(this));

Public = Public.upgrade();
Public.exports();
	return Public;
}).call(this);
/*!
betajs-server - v1.0.29 - 2023-12-08
Copyright (c) Oliver Friedmann
Apache-2.0 Software License.
*/

(function () {
var Scoped = this.subScope();
Scoped.binding('module', 'global:BetaJS.Server');
Scoped.binding('base', 'global:BetaJS');
Scoped.binding('data', 'global:BetaJS.Data');
Scoped.define("module:", function () {
	return {
    "guid": "9955100d-6a88-451f-9a85-004523eb8589",
    "version": "1.0.29",
    "datetime": 1702058093514
};
});
Scoped.assumeVersion('base:version', '~1.0.104');
Scoped.assumeVersion('data:version', '~1.0.41');
Scoped.define("module:Ajax.NodeAjax", [
    "base:Ajax.Support",
    "base:Net.Uri",
    "base:Net.HttpHeader",
    "base:Promise",
    "base:Objs",
    "base:Types"
], function (AjaxSupport, Uri, HttpHeader, Promise, Objs, Types) {
	
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
				opts.headers.Authorization = 'Basic ' + Buffer.from(parsed.user + ':' + parsed.password).toString('base64');
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

			var headerPromise = form ? Promise.create() : Promise.value(true);
			if (form) {
				form.getLength(function (err, len) {
					if (!err) {
						opts.headers['Content-Length'] = len;
						headerPromise.asyncSuccess(true);
					} else
						headerPromise.asyncError(err);
				});
			}

			headerPromise.forwardError(promise).success(function () {
				var request = require(parsed.protocol === "https" ? "https" : "http").request(opts, function (result) {
					var data = "";
					if (options.decodeType === "raw")
						result.setEncoding("binary");
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
				if (options.timeout) {
					request.on('socket', function(socket) {
						socket.removeAllListeners('timeout');
						socket.setTimeout(options.timeout, function() {});
						socket.on('timeout', function() {
							request.abort();
						});
					}).on('timeout', function() {
						AjaxSupport.promiseTimeoutException(promise);
						request.abort();
					});
				}
				if (form)
					form.pipe(request);
				else {
					if (post_data && post_data.length > 0)
						request.write(post_data);
					request.end();
				}
			});
			return promise;
		}
			
	};
	
	AjaxSupport.register(Module, 10);
	
	return Module;
});


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
		
		_dispatch: function (method, request, response) {
			return this[method](request, response);
		},
	
		dispatch : function(method, request, response, next) {
			this._beforeDispatch(method, request, response).success(function () {
				var result = this._dispatch(method, request, response);
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
		        var active_session = new this.__helper._active_session_class(this, token || this.__generate_token(), options);
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


Scoped.define("module:Sessions.PersistentSessionModel", [      
        "data:Modelling.Model"
    ], function (Model, scoped) {
    return Model.extend({scoped: scoped}, {}, function (inherited) {
    	return {
    		    	
			_initializeScheme: function () {
				var scheme = inherited._initializeScheme.call(this);
				scheme.token = {
					type: "string",
					index: true
				};
				scheme.created = {
					type: "date",
					index: true
				};
				return scheme;
			}
    
    	};
    });
});			


Scoped.define("module:Sessions.PersistentSessionManagerHelper", [      
         "base:Class",
         "module:Sessions.PersistentSessionModel",
         "base:Objs",
         "base:Types",
         "data:Stores.MemoryStore",
         "data:Modelling.Table",
         "base:Timers.Timer",
         "base:Time"
     ], function (Class, PersistentSessionModel, Objs, Types, MemoryStore, Table, Timer, Time, scoped) {
     return Class.extend({scoped: scoped}, function (inherited) {
     	return {
	
			_persistent_session_model: PersistentSessionModel,
		
			constructor: function (manager, options) {
				inherited.constructor.call(this);
		        this.__manager = manager;
		        options = Objs.tree_extend({
		        	invalidation: {
		        		// All times are in milliseconds; null to disable
		        		// hard timeout to remove sessions
		        		session_timeout: 1000 * 60 * 60 * 24 * 365,
		        		// invalidate; null to disable
		        		timer: 1000 * 60 * 60 * 24
		        	}
		        }, options);
		        this.__options = options;
		        this.__store = options.store ? options.store : this._auto_destroy(new MemoryStore());
		        this._persistent_session_model = options.persistent_session_model || this._persistent_session_model;
		        if (Types.is_string(this._persistent_session_model))
		        	this._persistent_session_model = Scoped.getGlobal(this._persistent_session_model);
		        if (options.invalidation.timer) {
		        	this.__timer = this._auto_destroy(new Timer({
					    fire : this.invalidate,
					    context : this,
					    delay : options.invalidation.timer
		        	}));
		        }
		        if (!this._persistent_session_model.table)
		        	this._persistent_session_model.table = this._auto_destroy(new Table(this.__store, this._persistent_session_model));
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
						created: Time.now()
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
		    		var time = Time.now() - this.__options.invalidation.session_timeout;
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
	
     	};
     });
});

Scoped.define("module:Sessions.RMIHelper", [      
         "base:Class",
         "base:Channels.ReadySender",
         "base:Net.SocketSenderChannel",
         "base:Net.SocketReceiverChannel",
         "base:RMI.Peer"
     ], function (Class, ReadySender, SocketSenderChannel, SocketReceiverChannel, Peer, scoped) {
     return Class.extend({scoped: scoped}, function (inherited) {
     	return {
		
		    constructor: function (active_session) {
		    	inherited.constructor.call(this);
		        this.__active_session = active_session;
		        active_session.rmi = this;
				this.__rmi_socket_sender = new SocketSenderChannel(null, "rmi");
		        this.__rmi_sender = new ReadySender(this.__rmi_socket_sender);
		        this.__rmi_receiver = new SocketReceiverChannel(null, "rmi");
		        this.__rmi_peer = new Peer(this.__rmi_sender, this.__rmi_receiver);
		        active_session.rmi_peer = this.__rmi_peer;
		        this.stubs = {};
		        this.skeletons = {};
		        active_session.stubs = this.stubs;
		        active_session.skeletons = this.skeletons;
		        active_session.on("bind_socket", function (socket) {
			        this.__rmi_receiver.socket(socket);
			        this.__rmi_socket_sender.socket(socket);
			        this.__rmi_sender.ready();
		        }, this);
		        active_session.on("unbind_socket", function () {
		        	this.__rmi_sender.unready();
		        }, this);
		        if ("initialize_rmi" in active_session)
		        	active_session.initialize_rmi();
		    },
		    
		    destroy: function () {
		        for (var key in this.stubs)
		            this.stubs[key].destroy();
		        for (key in this.skeletons)
		            this.skeletons[key].destroy();
		        this.__rmi_peer.destroy();
		        this.__rmi_receiver.destroy();
		        this.__rmi_sender.destroy();
		        inherited.destroy.call(this);
		    }

     	};
     });
});


Scoped.define("module:Sessions.RMIManagerHelper", [      
        "base:Class",
        "module:Sessions.RMIHelper"
    ], function (Class, RMIHelper, scoped) {
    return Class.extend({scoped: scoped}, {
		
		__add_active_session: function (session, active_session) {
			active_session.addHelper(RMIHelper);
		}
    
    });
});

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
		    		return session || this.new_session(null /*token*/, options);
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

			get_session: function (token) {
				return this.__sessions.get(token);
			},
		    
		    find_session: function (token) {
		    	if (!token)
		    		return Promise.value(null);
		    	var session = this.get_session(token);
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


}).call(Scoped);