/*!
betajs-data - v1.0.0 - 2015-03-17
Copyright (c) Oliver Friedmann
MIT Software License.
*/
(function () {

var Scoped = this.subScope();

Scoped.binding("module", "global:BetaJS.Data");
Scoped.binding("base", "global:BetaJS");
Scoped.binding("json", "global:JSON");

Scoped.define("module:", function () {
	return {
		guid: "70ed7146-bb6d-4da4-97dc-5a8e2d23a23f",
		version: '17.1426632310626'
	};
});

Scoped.define("module:Queries.Constrained", [
        "json:",
        "module:Queries",
        "base:Types",
        "base:Comparators",
        "base:Iterators.ArrayIterator",
        "base:Iterators.FilteredIterator",
        "base:Iterators.SortedIterator",
        "base:Iterators.SkipIterator",
        "base:Iterators.LimitIterator"
	], function (JSON, Queries, Types, Comparators, ArrayIterator, FilteredIterator, SortedIterator, SkipIterator, LimitIterator) {
	return {		
		
		make: function (query, options) {
			return {
				query: query,
				options: options || {}
			};
		},
		
		is_constrained: function (query) {
			return query && (query.query || query.options);
		},
		
		format: function (instance) {
			var query = instance.query;
			instance.query = Queries.format(query);
			var result = JSON.stringify(instance);
			instance.query = query;
			return result;
		},
		
		normalize: function (constrained_query) {
			return {
				query: "query" in constrained_query ? Queries.normalize(constrained_query.query) : {},
				options: {
					skip: "options" in constrained_query && "skip" in constrained_query.options ? constrained_query.options.skip : null,
					limit: "limit" in constrained_query && "limit" in constrained_query.options ? constrained_query.options.limit : null,
					sort: "sort" in constrained_query && "sort" in constrained_query.options ? constrained_query.options.sort : {}
				}
			};
		},
		
		emulate: function (constrained_query, query_capabilities, query_function, query_context) {
			var query = constrained_query.query || {};
			var options = constrained_query.options || {};
			var execute_query = {};
			var execute_options = {};
			if ("sort" in options && "sort" in query_capabilities)
				execute_options.sort = options.sort;
			execute_query = query;
			if ("query" in query_capabilities || Types.is_empty(query)) {
				execute_query = query;
				if (!options.sort || ("sort" in query_capabilities)) {
					if ("skip" in options && "skip" in query_capabilities)
						execute_options.skip = options.skip;
					if ("limit" in options && "limit" in query_capabilities) {
						execute_options.limit = options.limit;
						if ("skip" in options && !("skip" in query_capabilities))
							execute_options.limit += options.skip;
					}
				}
			}  
			return query_function.call(query_context || this, execute_query, execute_options).mapSuccess(function (raw) {
				var iter = raw;
				if (raw === null)
					iter = new ArrayIterator([]);
				else if (Types.is_array(raw))
					iter = new ArrayIterator(raw);		
				if (!("query" in query_capabilities || Types.is_empty(query)))
					iter = new FilteredIterator(iter, function(row) {
						return Queries.evaluate(query, row);
					});
				if ("sort" in options && !("sort" in execute_options))
					iter = new SortedIterator(iter, Comparators.byObject(options.sort));
				if ("skip" in options && !("skip" in execute_options))
					iter = new SkipIterator(iter, options["skip"]);
				if ("limit" in options && !("limit" in execute_options))
					iter = new LimitIterator(iter, options["limit"]);
				return iter;
			});
		},
		
		subsumizes: function (query, query2) {
			var qopt = query.options || {};
			var qopt2 = query2.options || {};
			var qskip = qopt.skip || 0;
			var qskip2 = qopt2.skip || 0;
			var qlimit = qopt.limit || null;
			var qlimit2 = qopt2.limit || null;
			var qsort = qopt.sort;
			var qsort2 = qopt2.sort;
			if (qskip > qskip2)
				return false;
			if (qlimit) {
				if (!qlimit2)
					return false;
				if (qlimit2 + qskip2 > qlimit + qskip)
					return false;
			}
			if ((qskip || qlimit) && (qsort || qsort2) && JSON.stringify(qsort) != JSON.stringify(qsort2))
				return false;
			return Queries.subsumizes(query.query, query2.query);
		},
		
		serialize: function (query) {
			return JSON.stringify(this.normalize(query));
		},
		
		unserialize: function (query) {
			return JSON.parse(query);
		},
		
		mergeable: function (query, query2) {
			if (Queries.serialize(query.query) != Queries.serialize(query2.query))
				return false;
			var qopts = query.options || {};
			var qopts2 = query2.options || {};
			if (JSON.stringify(qopts.sort || {}) != JSON.stringify(qopts2.sort || {}))
				return false;
			if ("skip" in qopts) {
				if ("skip" in qopts2) {
					if (qopts.skip <= qopts2.skip)
						return !qopts.limit || (qopts.skip + qopts.limit >= qopts2.skip);
					else
						return !qopts2.limit || (qopts2.skip + qopts2.limit >= qopts.skip);
				} else 
					return (!qopts2.limit || (qopts2.limit >= qopts.skip));
			} else 
				return !("skip" in qopts2) || (!qopts.limit || (qopts.limit >= qopts2.skip));
		},
		
		merge: function (query, query2) {
			var qopts = query.options || {};
			var qopts2 = query2.options || {};
			return {
				query: query.query,
				options: {
					skip: "skip" in qopts ? ("skip" in qopts2 ? Math.min(qopts.skip, qopts2.skip): null) : null,
					limit: "limit" in qopts ? ("limit" in qopts2 ? Math.max(qopts.limit, qopts2.limit): null) : null,
					sort: query.sort
				}
			};
		}
	
	}; 
});
Scoped.define("module:Queries", [
        "json:",
	    "base:Types",
	    "base:Sort",
	    "base:Objs",
	    "base:Class",
	    "base:Iterators.ArrayIterator",
	    "base:Iterators.FilteredIterator"
	], function (JSON, Types, Sort, Objs, Class, ArrayIterator, FilteredIterator) {
	return {		
		
		/*
		 * Syntax:
		 *
		 * queries :== [query, ...]
		 * simples :== [simple, ...]
		 * query :== {pair, ...}
		 * pair :== string: value | $or : queries | $and: queries
		 * value :== simple | {condition, ...}  
		 * condition :== $in: simples | $gt: simple | $lt: simple | $gte: simple | $le: simple | $sw: simple | $gtic: simple | $ltic: simple | $geic: simple | $leic: simple | $swic: simple | $ct: simple | $ctic: simple
		 *
		 */
		
		subsumizes: function (query, query2) {
			// This is very simple at this point
			if (!Types.is_object(query) || !Types.is_object)
				return query == query2;
			for (var key in query) {
				if (!(key in query2) || !this.subsumizes(query[key], query2[key]))
					return false;
			}
			return true;
		},
		
		normalize: function (query) {
			return Sort.deep_sort(query);
		},
		
		serialize: function (query) {
			return JSON.stringify(this.normalize(query));
		},
		
		unserialize: function (query) {
			return JSON.parse(query);
		},
		
		__increase_dependency: function (key, dep) {
			if (key in dep)
				dep[key]++;
			else
				dep[key] = 1;
			return dep;		
		},
		
		__dependencies_queries: function (queries, dep) {
			Objs.iter(queries, function (query) {
				dep = this.__dependencies_query(query, dep);
			}, this);
			return dep;
		},
		
		__dependencies_query: function (query, dep) {
			for (var key in query)
				dep = this.__dependencies_pair(key, query[key], dep);
			return dep;
		},
		
		__dependencies_pair: function (key, value, dep) {
			if (key == "$or" || key == "$and")
				return this.__dependencies_queries(value, dep);
			else
				return this.__increase_dependency(key, dep);
		},
	
		dependencies : function(query) {
			return this.__dependencies_query(query, {});
		},
			
		__evaluate_query: function (query, object) {
			for (var key in query) {
				if (!this.__evaluate_pair(key, query[key], object))
					return false;
			}
			return true;
		},
		
		__evaluate_pair: function (key, value, object) {
			if (key == "$or")
				return this.__evaluate_or(value, object);
			if (key == "$and")
				return this.__evaluate_and(value, object);
			return this.__evaluate_value(value, object[key]);
		},
		
		__evaluate_value: function (value, object_value) {
			if (Types.is_object(value)) {
				var result = true;
				Objs.iter(value, function (tar, op) {
					if (op == "$in")
						result = result && Objs.contains_value(tar, object_value);
					if (op == "$gt")
						result = result && object_value > tar;
					if (op == "$gtic")
						result = result && object_value.toLowerCase() > tar.toLowerCase();
					if (op == "$lt")
						result = result && object_value < tar;
					if (op == "$ltic")
						result = result && object_value.toLowerCase() < tar.toLowerCase();
					if (op == "$gte")
						result = result && object_value >= tar;
					if (op == "$geic")
						result = result && object_value.toLowerCase() >= tar.toLowerCase();
					if (op == "$le")
						result = result && object_value <= tar;
					if (op == "$leic")
						result = result && object_value.toLowerCase() <= tar.toLowerCase();
					if (op == "$sw")
						result = result && object_value.indexOf(tar) === 0;
					if (op == "$swic")
						result = result && object_value.toLowerCase().indexOf(tar.toLowerCase()) === 0;
					if (op == "$ct")
						result = result && object_value.indexOf(tar) >= 0;
					if (op == "$ctic")
						result = result && object_value.toLowerCase().indexOf(tar.toLowerCase()) >= 0;
				}, this);
				return result;
			}
			return value == object_value;
		},
		
		__evaluate_or: function (arr, object) {
			var result = false;
			Objs.iter(arr, function (query) {
				if (this.__evaluate_query(query, object)) {
					result = true;
					return false;
				}
			}, this);
			return result;
		},
		
		__evaluate_and: function (arr, object) {
			var result = true;
			Objs.iter(arr, function (query) {
				if (!this.__evaluate_query(query, object)) {
					result = false;
					return false;
				}
			}, this);
			return result;
		},
		
		format: function (query) {
			if (Class.is_class_instance(query))
				return query.format();
			return JSON.stringify(query);
		},
		
		overloaded_evaluate: function (query, object) {
			if (Class.is_class_instance(query))
				return query.evaluate(object);
			if (Types.is_function(query))
				return query(object);
			return this.evaluate(query, object);
		},
		
		evaluate : function(query, object) {
			return this.__evaluate_query(query, object);
		},
	/*
		__compile : function(query) {
			if (Types.is_array(query)) {
				if (query.length == 0)
					throw "Malformed Query";
				var op = query[0];
				if (op == "Or") {
					var s = "false";
					for (var i = 1; i < query.length; ++i)
						s += " || (" + this.__compile(query[i]) + ")";
					return s;
				} else if (op == "And") {
					var s = "true";
					for (var i = 1; i < query.length; ++i)
						s += " && (" + this.__compile(query[i]) + ")";
					return s;
				} else {
					if (query.length != 3)
						throw "Malformed Query";
					var key = query[1];
					var value = query[2];
					var left = "object['" + key + "']";
					var right = Types.is_string(value) ? "'" + value + "'" : value;
					return left + " " + op + " " + right;
				}
			} else if (Types.is_object(query)) {
				var s = "true";
				for (key in query)
					s += " && (object['" + key + "'] == " + (Types.is_string(query[key]) ? "'" + query[key] + "'" : query[key]) + ")";
				return s;
			} else
				throw "Malformed Query";
		},
	
		compile : function(query) {
			var result = this.__compile(query);
			var func = new Function('object', result);
			var func_call = function(data) {
				return func.call(this, data);
			};
			func_call.source = 'function(object){\n return ' + result + '; }';
			return func_call;		
		},
	*/	
		emulate: function (query, query_function, query_context) {
			var raw = query_function.apply(query_context || this, {});
			var iter = raw;
			if (!raw)
				iter = new ArrayIterator([]);
			else if (Types.is_array(raw))
				iter = new ArrayIterator(raw);		
			return new FilteredIterator(iter, function(row) {
				return this.evaluate(query, row);
			}, this);
		}	
		
	}; 
});
Scoped.define("module:Collections.QueryCollection", [      
        "base:Collections.Collection",
        "base:Objs",
        "base:Types",
        "base:Promise"
    ], function (Collection, Objs, Types, Promise, scoped) {
    return Collection.extend({scoped: scoped}, function (inherited) {
		return {
			
			constructor: function (source, query, options) {
				this._source = source;
				inherited.constructor.call(this, options);
				this._options = Objs.extend({
					forward_steps: null,
					backward_steps: null,
					range: null
				}, options);
				if (query !== null)
					this.set_query(query);
			},
			
			query: function () {
				return this._query;
			},
			
			set_query: function (query) {
				this._query = Objs.extend({
					query: {},
					options: {}
				}, query);
				this._query.options.skip = this._query.options.skip || 0;
				this._query.options.limit = this._query.options.limit || null;
				this._query.options.sort = this._query.options.sort || {};  
				this._count = 0;
				return this.__execute_query(this._query.options.skip, this._query.options.limit, true);
			},
			
			__sub_query: function (options) {
				return this._source.query(this._query.query, options);
			},
			
			__execute_query: function (skip, limit, clear_before) {
				skip = Math.max(skip, 0);
				var q = {};
				if (this._query.options.sort && !Types.is_empty(this._query.options.sort))
					q.sort = this._query.options.sort;
				if (clear_before) {
					if (skip > 0)
						q.skip = skip;
					if (limit !== null)
						q.limit = limit;
					return this.__sub_query(q).mapSuccess(function (iter) {
						var objs = iter.asArray();
						this._query.options.skip = skip;
						this._query.options.limit = limit;
						this._count = !limit || objs.length < limit ? skip + objs.length : null;
						this.clear();
						this.add_objects(objs);
						return true;
					}, this);
				} else if (skip < this._query.options.skip) {
					limit = this._query.options.skip - skip;
					if (skip > 0)
						q.skip = skip;
					q.limit = limit;
					return this.__sub_query(q).mapSuccess(function (iter) {
						var objs = iter.asArray();
						this._query.options.skip = skip;
						var added = this.add_objects(objs);
						this._query.options.limit = this._query.options.limit === null ? null : this._query.options.limit + added;
						return true;
					}, this);
				} else if (skip >= this._query.options.skip) {
					if (this._query.options.limit !== null && (!limit || skip + limit > this._query.options.skip + this._query.options.limit)) {
						limit = (skip + limit) - (this._query.options.skip + this._query.options.limit);
						skip = this._query.options.skip + this._query.options.limit;
						if (skip > 0)
							q.skip = skip;
						if (limit)
							q.limit = limit;
						return this.__sub_query(q).mapSuccess(function (iter) {
							var objs = iter.asArray();
							var added = this.add_objects(objs);
							this._query.options.limit = this._query.options.limit + added;
							if (limit > objs.length)
								this._count = skip + added;
							return true;
						}, this);
					} else
						return Promise.create(true);
				}
			},
			
			increase_forwards: function (steps) {
				steps = !steps ? this._options.forward_steps : steps;
				if (!steps || this._query.options.limit === null)
					return Promise.create(true);
				return this.__execute_query(this._query.options.skip + this._query.options.limit, steps, false);
			},
			
			increase_backwards: function (steps) {
				steps = !steps ? this._options.backward_steps : steps;
				if (steps && this._query.options.skip > 0) {
					steps = Math.min(steps, this._query.options.skip);
					return this.__execute_query(this._query.options.skip - steps, steps, false);
				} else
					return Promise.create(true);
			},
			
			paginate: function (index) {
				return this.__execute_query(this._options.range * index, this._options.range, true);
			},
			
			paginate_index: function () {
				return !this._options.range ? null : Math.floor(this._query.options.skip / this._options.range);
			},
			
			paginate_count: function () {
				return !this._count || !this._options.range ? null : Math.ceil(this._count / this._options.range);
			},
			
			next: function () {
				var paginate_index = this.paginate_index();
				if (!paginate_index)
					return Promise.create(true);
				var paginate_count = this.paginate_count();
				if (!paginate_count || paginate_index < this.paginate_count() - 1)
					return this.paginate(paginate_index + 1);
				return Promise.create(true);
			},
			
			prev: function () {
				var paginate_index = this.paginate_index();
				if (!paginate_index)
					return Promise.create(true);
				if (paginate_index > 0)
					this.paginate(paginate_index - 1);
				return Promise.create(true);
			},
			
			isComplete: function () {
				return this._count !== null;
			}
			
    	};
	});
});
	

Scoped.define("module:Collections.ActiveQueryCollection", [      
         "module:Collections.QueryCollection",
         "module:Queries",
         "base:Objs"
     ], function (QueryCollection, Queries, Objs, scoped) {
     return QueryCollection.extend({scoped: scoped}, function (inherited) {
 		return {
                                             			
			constructor: function (source, query, options) {
				inherited.constructor.call(this, source, query, options);
				source.on("create", this.__active_create, this);
				source.on("remove", this.__active_remove, this);
				source.on("update", this.__active_update, this);
			},
			
			destroy: function () {
				this._source.off(null, null, this);
				inherited.destroy.call(this);
			},
			
			get_ident: function (obj) {
				return obj.id();
			},
			
			is_valid: function (data) {
				return Queries.evaluate(this.query().query, data);
			},
			
			__active_create: function (data, materialize) {
				if (!this.is_valid(data))
					return;
				var obj = materialize();
				this.add(obj);
				this._count = this._count + 1;
				if (this._query.options.limit !== null)
					this._query.options.limit = this._query.options.limit + 1;
			},
			
			__active_remove: function (id) {
				var object = this.getById(id);
				if (!object)
					return;
				this.remove(object);
				this._count = this._count - 1;
				if (this._query.options.limit !== null)
					this._query.options.limit = this._query.options.limit - 1;
			},
			
			__active_update: function (id, data, row) {
				var object = this.getById(id);
				var merged = Objs.extend(row, data);
				if (!object)
					this.__active_create(merged, this._source.materializer(merged));
				else if (!this.is_valid(merged))
					this.__active_remove(id);
			}

		};
    });
});

Scoped.define("module:Stores.AssocDumbStore", ["module:Stores.DumbStore"], function (DumbStore, scoped) {
  	return DumbStore.extend({scoped: scoped}, {
		
		_read_key: function (key) {},
		_write_key: function (key, value) {},
		_remove_key: function (key) {},
		
		__read_id: function (key) {
			var raw = this._read_key(key);
			return raw ? parseInt(raw, 10) : null;
		},
		
		_read_last_id: function () {
			return this.__read_id("last_id");
		},
		
		_write_last_id: function (id) {
			this._write_key("last_id", id);
		},
	
		_remove_last_id: function () {
			this._remove_key("last_id");
		},
	
		_read_first_id: function () {
			return this.__read_id("first_id");
		},
		
		_write_first_id: function (id) {
			this._write_key("first_id", id);
		},
		
		_remove_first_id: function () {
			this._remove_key("first_id");
		},
	
		_read_item: function (id) {
			return this._read_key("item_" + id);
		},
	
		_write_item: function (id, data) {
			this._write_key("item_" + id, data);
		},
		
		_remove_item: function (id) {
			this._remove_key("item_" + id);
		},
		
		_read_next_id: function (id) {
			return this.__read_id("next_" + id);
		},
	
		_write_next_id: function (id, next_id) {
			this._write_key("next_" + id, next_id);
		},
		
		_remove_next_id: function (id) {
			this._remove_key("next_" + id);
		},
		
		_read_prev_id: function (id) {
			return this.__read_id("prev_" + id);
		},
	
		_write_prev_id: function (id, prev_id) {
			this._write_key("prev_" + id, prev_id);
		},
	
		_remove_prev_id: function (id) {
			this._remove_key("prev_" + id);
		}

  	});
});

Scoped.define("module:Stores.AssocStore", [
          "module:Stores.BaseStore",
          "base:Promise",
          "base:Objs"
  	], function (BaseStore, Promise, Objs, scoped) {
  	return BaseStore.extend({scoped: scoped}, function (inherited) {			
  		return {

			_read_key: function (key) {},
			_write_key: function (key, value) {},
			_remove_key: function (key) {},
			_iterate: function () {},
			
			constructor: function (options) {
				options = options || {};
				options.create_ids = true;
				inherited.constructor.call(this, options);
			},
			
			_insert: function (data) {
				return Promise.tryCatch(function () {
					this._write_key(data[this._id_key], data);
					return data;
				}, this);
			},
			
			_remove: function (id) {
				return Promise.tryCatch(function () {
					var row = this._read_key(id);
					if (row && !this._remove_key(id))
						return null;
					return row;
				}, this);
			},
			
			_get: function (id) {
				return Promise.tryCatch(function () {
					return this._read_key(id);
				}, this);
			},
			
			_update: function (id, data) {
				return Promise.tryCatch(function () {
					var row = this._read_key(id);
					if (row) {
					    if (this._id_key in data) {
					        this._remove_key(id);
			                id = data[this._id_key];
			                delete data[this._id_key];
					    }
						Objs.extend(row, data);
						this._write_key(id, row);
					}
					return row;
				}, this);
			},
			
			_query: function (query, options) {
				return Promise.tryCatch(function () {
					return this._iterate();
				}, this);
			}

  		};
  	});
});

Scoped.define("module:Stores.StoreException", ["base:Exceptions.Exception"], function (Exception, scoped) {
	return Exception.extend({scoped: scoped}, {});
});


Scoped.define("module:Stores.ListenerStore", [
         "base:Class",
         "base:Events.EventsMixin"
 	], function (Class, EventsMixin, scoped) {
 	return Class.extend({scoped: scoped}, [EventsMixin, function (inherited) {			
 		return {
 			
	 		constructor: function (options) {
	 			inherited.constructor.call(this);
				options = options || {};
				this._id_key = options.id_key || "id";
			},
		
			id_key: function () {
				return this._id_key;
			},
			
			_inserted: function (row, event_data) {
				this.trigger("insert", row, event_data);		
			},
			
			_removed: function (id, event_data) {
				this.trigger("remove", id, event_data);		
			},
			
			_updated: function (row, data, event_data) {
				this.trigger("update", row, data, event_data);		
			} 

 		};
 	}]);
});


Scoped.define("module:Stores.BaseStore", [
          "module:Stores.ListenerStore",
          "module:Stores.StoreException",
          "module:Queries.Constrained",
          "module:Queries",
          "base:Classes.TimedIdGenerator",
          "base:Promise",
          "base:Types",
          "base:Objs"
  	], function (ListenerStore, StoreException, Constrained, Queries, TimedIdGenerator, Promise, Types, Objs, scoped) {
  	return ListenerStore.extend({scoped: scoped}, function (inherited) {			
  		return {
				
			constructor: function (options) {
				inherited.constructor.call(this, options);
				options = options || {};
				this._id_key = options.id_key || "id";
				this._create_ids = options.create_ids || false;
				if (this._create_ids)
					this._id_generator = options.id_generator || this._auto_destroy(new TimedIdGenerator());
				this._query_model = "query_model" in options ? options.query_model : null;
			},
			
		    query_model: function () {
		        if (arguments.length > 0)
		            this._query_model = arguments[0];
		        return this._query_model;
		    },
		    
			_insert: function (data) {
				return Promise.create(null, new StoreException("unsupported: insert"));
			},
			
			_remove: function (id) {
				return Promise.create(null, new StoreException("unsupported: remove"));
			},
			
			_get: function (id) {
				return Promise.create(null, new StoreException("unsupported: get"));
			},
			
			_update: function (id, data) {
				return Promise.create(null, new StoreException("unsupported: update"));
			},
			
			_query_capabilities: function () {
				return {};
			},
			
			_query: function (query, options) {
				return Promise.create(null, new StoreException("unsupported: query"));
			},
			
			insert: function (data) {
				var event_data = null;
				if (Types.is_array(data)) {
					event_data = data[1];
					data = data[0];
				}			
				if (this._create_ids && !(this._id_key in data && data[this._id_key]))
					data[this._id_key] = this._id_generator.generate();
				return this._insert(data).success(function (row) {
					this._inserted(row, event_data);
				}, this);
			},
			
			insert_all: function (data, query) {
				var event_data = null;
				if (arguments.length > 2)
					event_data = arguments[2];
				if (query && this._query_model) {
					this.trigger("query_register", query);
					this._query_model.register(query);
				}
				var promise = Promise.and();
				for (var i = 0; i < data.length; ++i)
					promise = promise.and(this.insert(event_data ? [data[i], event_data] : data[i]));
				return promise.end();
			},
		
			remove: function (id) {
				var event_data = null;
				if (Types.is_array(id)) {
					event_data = id[1];
					id = id[0];
				}			
				return this._remove(id).success(function () {
					this._removed(id, event_data);
				}, this);
			},
			
			get: function (id) {
				return this._get(id);
			},
			
			update: function (id, data) {
				var event_data = null;
				if (Types.is_array(data)) {
					event_data = data[1];
					data = data[0];
				}			
				return this._update(id, data).success(function (row) {
					this._updated(row, data, event_data);
				}, this);
			},
			
			query: function (query, options) {
				query = Objs.clone(query, -1);
				if (options) {
					if (options.limit)
						options.limit = parseInt(options.limit, 10);
					if (options.skip)
						options.skip = parseInt(options.skip, 10);
				}
				if (this._query_model) {
				    var subsumizer = this._query_model.subsumizer_of({query: query, options: options});
		    		if (!subsumizer) {
		    			this.trigger("query_miss", {query: query, options: options});
		    			return Promise.error(new StoreException("Cannot execute query"));
		    		}
		    		this.trigger("query_hit", {query: query, options: options}, subsumizer);
				}
				return Constrained.emulate(
						Constrained.make(query, options || {}),
						this._query_capabilities(),
						this._query,
						this);
			},
			
			_query_applies_to_id: function (query, id) {
				var row = this.get(id);
				return row && Queries.overloaded_evaluate(query, row);
			},
			
			_ensure_index: function (key) {
			},
			
			ensure_index: function (key) {
				return this._ensure_index(key);
			},
			
			clear: function () {
				return this.query().mapSuccess(function (iter) {
					var promise = Promise.and();
					while (iter.hasNext()) {
						var obj = iter.next();
						promise = promise.and(this.remove(obj[this._id_key]));
					}
					return promise;
				}, this);
			},
			
			perform: function (commit) {
				var action = Objs.keyByIndex(commit);
				var data = Objs.valueByIndex(commit);
				if (action == "insert")
					return this.insert(data);
				else if (action == "remove")
					return this.remove(data);
				else if (action == "update")
					return this.update(Objs.keyByIndex(data), Objs.valueByIndex(data));
				else
					return Promise.error(new StoreException("unsupported: perform " + action));
			}

  		};
  	});
});


Scoped.define("module:Stores.ConversionStore", [
          "module:Stores.BaseStore",
          "base:Objs",
          "base:Iterators.MappedIterator"
  	], function (BaseStore, Objs, MappedIterator, scoped) {
  	return BaseStore.extend({scoped: scoped}, function (inherited) {			
  		return {

			constructor: function (store, options) {
				options = options || {};
				options.id_key = store._id_key;
				inherited.constructor.call(this, options);
				this.__store = store;
				this.__key_encoding = options["key_encoding"] || {};
				this.__key_decoding = options["key_decoding"] || {};
				this.__value_encoding = options["value_encoding"] || {};
				this.__value_decoding = options["value_decoding"] || {};
				this.__projection = options["projection"] || {};
			},
			
			store: function () {
				return this.__store;
			},
			
			encode_object: function (obj) {
				if (!obj)
					return null;
				var result = {};
				for (var key in obj) {
				    var encoded_key = this.encode_key(key);
				    if (encoded_key)
					    result[encoded_key] = this.encode_value(key, obj[key]);
				}
				return Objs.extend(result, this.__projection);
			},
			
			decode_object: function (obj) {
				if (!obj)
					return null;
				var result = {};
				for (var key in obj) {
				    var decoded_key = this.decode_key(key);
				    if (decoded_key)
					    result[decoded_key] = this.decode_value(key, obj[key]);
			    }
				for (key in this.__projection)
					delete result[key];
				return result;
			},
			
			encode_key: function (key) {
				return key in this.__key_encoding ? this.__key_encoding[key] : key;
			},
			
			decode_key: function (key) {
				return key in this.__key_decoding ? this.__key_decoding[key] : key;
			},
			
			encode_value: function (key, value) {
				return key in this.__value_encoding ? this.__value_encoding[key](value) : value;
			},
			
			decode_value: function (key, value) {
				return key in this.__value_decoding ? this.__value_decoding[key](value) : value;
			},	
		
			_query_capabilities: function () {
				return this.__store._query_capabilities();
			},
			
			_ensure_index: function (key) {
				return this.__store.ensure_index(key);
			},
			
			_insert: function (data) {
				return this.__store.insert(this.encode_object(data)).mapSuccess(this.decode_object, this);
			},
			
			_remove: function (id) {
				return this.__store.remove(this.encode_value(this._id_key, id));
			},
		
			_get: function (id) {
				return this.__store.get(this.encode_value(this._id_key, id)).mapSuccess(this.decode_object, this);
			},
			
			_update: function (id, data) {
				return this.__store.update(this.encode_value(this._id_key, id), this.encode_object(data)).mapSuccess(this.decode_object, this);
			},
			
			_query: function (query, options) {
				return this.__store.query(this.encode_object(query), options).mapSuccess(function (result) {
					return new MappedIterator(result, this.decode_object, this);
				}, this);
			}		

  		};
  	});
});

Scoped.define("module:Stores.DumbStore", [
          "module:Stores.BaseStore",
          "base:Promise",
          "base:Objs",
          "base:Iterators.Iterator"
  	], function (BaseStore, Promise, Objs, Iterator, scoped) {
  	return BaseStore.extend({scoped: scoped}, function (inherited) {			
  		return {
			
			_read_last_id: function () {},
			_write_last_id: function (id) {},
			_remove_last_id: function () {},
			_read_first_id: function () {},
			_write_first_id: function (id) {},
			_remove_first_id: function () {},
			_read_item: function (id) {},
			_write_item: function (id, data) {},
			_remove_item: function (id) {},
			_read_next_id: function (id) {},
			_write_next_id: function (id, next_id) {},
			_remove_next_id: function (id) {},
			_read_prev_id: function (id) {},
			_write_prev_id: function (id, prev_id) {},
			_remove_prev_id: function (id) {},
			
			constructor: function (options) {
				options = options || {};
				options.create_ids = true;
				inherited.constructor.call(this, options);
			},
		
			_insert: function (data) {
				return Promise.tryCatch(function () {
					var last_id = this._read_last_id();
					var id = data[this._id_key];
					if (last_id !== null) {
						this._write_next_id(last_id, id);
						this._write_prev_id(id, last_id);
					} else
						this._write_first_id(id);
					this._write_last_id(id);
					this._write_item(id, data);
					return data;
				}, this);
			},
			
			_remove: function (id) {
				return Promise.tryCatch(function () {
					var row = this._read_item(id);
					if (row) {
						this._remove_item(id);
						var next_id = this._read_next_id(id);
						var prev_id = this._read_prev_id(id);
						if (next_id !== null) {
							this._remove_next_id(id);
							if (prev_id !== null) {
								this._remove_prev_id(id);
								this._write_next_id(prev_id, next_id);
								this._write_prev_id(next_id, prev_id);
							} else {
								this._remove_prev_id(next_id);
								this._write_first_id(next_id);
							}
						} else if (prev_id !== null) {
							this._remove_next_id(prev_id);
							this._write_last_id(prev_id);
						} else {
							this._remove_first_id();
							this._remove_last_id();
						}
					}
					return row;
				}, this);
			},
			
			_get: function (id) {
				return Promise.tryCatch(function () {
					return this._read_item(id);
				}, this);
			},
			
			_update: function (id, data) {
				return Promise.tryCatch(function () {
					var row = this._get(id);
					if (row) {
						delete data[this._id_key];
						Objs.extend(row, data);
						this._write_item(id, row);
					}
					return row;
				}, this);
			},
			
			_query_capabilities: function () {
				return {
					query: true
				};
			},
		
			_query: function (query, options) {
				return Promise.tryCatch(function () {
					var iter = new Iterator();
					var store = this;
					var fid = this._read_first_id();
					Objs.extend(iter, {
						__id: fid === null ? 1 : fid,
						__store: store,
						__query: query,
						
						hasNext: function () {
							var last_id = this.__store._read_last_id();
							if (last_id === null)
								return false;
							while (this.__id < last_id && !this.__store._read_item(this.__id))
								this.__id++;
							while (this.__id <= last_id) {
								if (this.__store._query_applies_to_id(query, this.__id))
									return true;
								if (this.__id < last_id)
									this.__id = this.__store._read_next_id(this.__id);
								else
									this.__id++;
							}
							return false;
						},
						
						next: function () {
							if (this.hasNext()) {
								var item = this.__store.get(this.__id);
								if (this.__id == this.__store._read_last_id())
									this.__id++;
								else
									this.__id = this.__store._read_next_id(this.__id);
								return item;
							}
							return null;
						}
					});
					return iter;
				}, this);
			}	

  		};
  	});
});

// Stores everything permanently in the browser's local storage

Scoped.define("module:Stores.LocalStore", [
          "module:Stores.AssocDumbStore",
          "json:"
  	], function (AssocDumbStore, JSON, scoped) {
  	return AssocDumbStore.extend({scoped: scoped}, function (inherited) {			
  		return {

			constructor: function (options, localStorage) {
				inherited.constructor.call(this, options);
				this.__prefix = options.prefix;
				this.__localStorage = localStorage;
			},
			
			__key: function (key) {
				return this.__prefix + key;
			},
			
			_read_key: function (key) {
				var prfkey = this.__key(key);
				return prfkey in this.__localStorage ? JSON.parse(this.__localStorage[prfkey]) : null;
			},
			
			_write_key: function (key, value) {
				this.__localStorage[this.__key(key)] = JSON.stringify(value);
			},
			
			_remove_key: function (key) {
				delete this.__localStorage[this.__key(key)];
			}

  		};
  	});
});

// Stores everything temporarily in the browser's memory

Scoped.define("module:Stores.MemoryStore", [
          "module:Stores.AssocStore",
          "base:Iterators.ObjectValuesIterator"
  	], function (AssocStore, ObjectValuesIterator, scoped) {
  	return AssocStore.extend({scoped: scoped}, function (inherited) {			
  		return {
			
			constructor: function (options) {
				inherited.constructor.call(this, options);
				this.__data = {};
			},
		
			_read_key: function (key) {
				return this.__data[key];
			},
			
			_write_key: function (key, value) {
				this.__data[key] = value;
			},
			
			_remove_key: function (key) {
				delete this.__data[key];
			},
			
			_iterate: function () {
				return new ObjectValuesIterator(this.__data);
			}

  		};
  	});
});


Scoped.define("module:Stores.PassthroughStore", [
          "module:Stores.BaseStore",
          "base:Objs"
  	], function (BaseStore, Objs, scoped) {
  	return BaseStore.extend({scoped: scoped}, function (inherited) {			
  		return {
			
			constructor: function (store, options) {
				this.__store = store;
				options = options || {};
				options.id_key = store.id_key();
				this._projection = options.projection || {};
				inherited.constructor.call(this, options);
		        if (options.destroy_store)
		            this._auto_destroy(store);
			},
			
			_query_capabilities: function () {
				return this.__store._query_capabilities();
			},
		
			_insert: function (data) {
				return this.__store.insert(Objs.extend(data, this._projection));
			},
			
			_remove: function (id) {
				return this.__store.remove(id);
			},
			
			_get: function (id) {
				return this.__store.get(id);
			},
			
			_update: function (id, data) {
				return this.__store.update(id, data);
			},
			
			_query: function (query, options) {
				return this.__store.query(Objs.extend(query, this._projection), options);
			},
			
			_ensure_index: function (key) {
				return this.__store.ensure_index(key);
			},
			
			_store: function () {
				return this.__store;
			}

  		};
  	});
});



Scoped.define("module:Stores.ActiveStore", [
          "module:Stores.PassthroughStore"
  	], function (PassthroughStore, scoped) {
  	return PassthroughStore.extend({scoped: scoped}, function (inherited) {			
  		return {
			
			constructor: function (store, listener, options) {
				inherited.constructor.call(this, store, options);
				this.__listener = listener;
				this.delegateEvents(null, listener);
			}

  		};
  	});
});

Scoped.define("module:Stores.RemoteStoreException", [
          "module:Stores.StoreException",
          "base:Net.AjaxException"
  	], function (StoreException, AjaxException, scoped) {
  	return StoreException.extend({scoped: scoped}, function (inherited) {			
  		return {
			
			constructor: function (source) {
				source = AjaxException.ensure(source);
				inherited.constructor.call(this, source.toString());
				this.__source = source;
			},
			
			source: function () {
				return this.__source;
			}
			
  		};
  	});
});



Scoped.define("module:Stores.RemoteStore", [
         "module:Stores.BaseStore",
         "module:Stores.RemoteStoreException",
         "base:Objs",
         "base:Types",
         "json:"
 	], function (BaseStore, RemoteStoreException, Objs, Types, JSON, scoped) {
 	return BaseStore.extend({scoped: scoped}, function (inherited) {			
 		return {
                                           			
			constructor : function(uri, ajax, options) {
				inherited.constructor.call(this, options);
				this._uri = uri;
				this.__ajax = ajax;
				this.__options = Objs.extend({
					"update_method": "PUT",
					"uri_mappings": {}
				}, options || {});
			},
			
			getUri: function () {
				return this._uri;
			},
			
			prepare_uri: function (action, data) {
				if (this.__options["uri_mappings"][action])
					return this.__options["uri_mappings"][action](data);
				if (action == "remove" || action == "get" || action == "update")
					return this.getUri() + "/" + data[this._id_key];
				return this.getUri();
			},
			
			_encode_query: function (query, options) {
				return {
					uri: this.prepare_uri("query")
				};		
			},
			
			__invoke: function (options, parse_json) {
				return this.__ajax.asyncCall(options).mapCallback(function (e, result) {
					if (e)
						return new RemoteStoreException(e);
					if (parse_json && Types.is_string(result)) {
						try {
							result = JSON.parse(result);
						} catch (ex) {}
					}
					return result;
				});
			},
			
			_insert : function(data) {
				return this.__invoke({
					method: "POST",
					uri: this.prepare_uri("insert", data),
					data: data
				}, true);
			},
		
			_get : function(id) {
				var data = {};
				data[this._id_key] = id;
				return this.__invoke({
					uri: this.prepare_uri("get", data)
				});
			},
		
			_update : function(id, data) {
				var copy = Objs.clone(data, 1);
				copy[this._id_key] = id;
				return this.__invoke({
					method: this.__options.update_method,
					uri: this.prepare_uri("update", copy),
					data: data
				});
			},
			
			_remove : function(id) {
				var data = {};
				data[this._id_key] = id;
				return this.__invoke({
					method: "DELETE",
					uri: this.prepare_uri("remove", data)
				});
			},
		
			_query : function(query, options) {
				return this.__invoke(this._encode_query(query, options), true);
			}	
			
 		};
 	});
});


Scoped.define("module:Stores.QueryGetParamsRemoteStore", [
        "module:Stores.RemoteStore",
        "json:"
	], function (RemoteStore, JSON, scoped) {
	return RemoteStore.extend({scoped: scoped}, function (inherited) {			
		return {
                                          			
			constructor : function(uri, ajax, capability_params, options) {
				inherited.constructor.call(this, uri, ajax, options);
				this.__capability_params = capability_params;
			},
			
			_query_capabilities: function () {
				var caps = {};
				if ("skip" in this.__capability_params)
					caps.skip = true;
				if ("limit" in this.__capability_params)
					caps.limit = true;
				if ("query" in this.__capability_params)
					caps.query = true;
				if ("sort" in this.__capability_params)
					caps.sort = true;
				return caps;
			},
		
			_encode_query: function (query, options) {
				options = options || {};
				var uri = this.getUri() + "?"; 
				if (options["skip"] && "skip" in this.__capability_params)
					uri += this.__capability_params["skip"] + "=" + options["skip"] + "&";
				if (options["limit"] && "limit" in this.__capability_params)
					uri += this.__capability_params["limit"] + "=" + options["limit"] + "&";
				if (options["sort"] && "sort" in this.__capability_params)
					uri += this.__capability_params["sort"] + "=" + JSON.stringify(options["sort"]) + "&";
				if ("query" in this.__capability_params)
					uri += this.__capability_params["query"] + "=" + JSON.stringify(query) + "&";
				return {
					uri: uri
				};		
			}

		};
	});
});
Scoped.define("module:Stores.SocketStore", [
          "module:Stores.BaseStore",
          "base:Objs"
  	], function (BaseStore, Objs, scoped) {
  	return BaseStore.extend({scoped: scoped}, function (inherited) {			
  		return {
			
			constructor: function (options, socket, prefix) {
				inherited.constructor.call(this, options);
				this.__socket = socket;
				this.__prefix = prefix;
				this._supportsAsync = false;
			},

			/** @suppress {missingProperties} */
			__send: function (action, data) {
				this.__socket.emit(this.__prefix + ":" + action, data);
			},
			
			_insert: function (data) {
				this.__send("insert", data);
			},
			
			_remove: function (id) {
				this.__send("remove", id);
			},
			
			_update: function (id, data) {
				this.__send("update", Objs.objectBy(id, data));
			}	

  		};
  	});
});


Scoped.define("module:Stores.SocketListenerStore", [
        "module:Stores.ListenerStore",
        "module:Stores.StoreException",
        "base:Objs"
	], function (ListenerStore, StoreException, Objs, scoped) {
	return ListenerStore.extend({scoped: scoped}, function (inherited) {			
		return {
		
			constructor: function (options, socket, prefix) {
				inherited.constructor.call(this, options);
				var self = this;
				this.__prefix = prefix;
				socket.on(this.__prefix + ":insert", function (data) {
					self._perform("insert", data);
				});
				socket.on(this.__prefix + ":remove", function (id) {
					self._perform("remove", id);
				});
				socket.on(this.__prefix + ":update", function (data) {
					self._perform("update", data);
				});
				socket.on(this.__prefix + ":bulk", function (commits) {
					for (var i = 0; i < commits.length; ++i)
						self._perform(Objs.keyByIndex(commits[i]), Objs.valueByIndex(commits[i]));
				});
			},
			
			_perform: function (action, data) {
				if (action == "insert")
					this._inserted(data);
				else if (action == "remove")
					this._removed(data);
				else if (action == "update")
					this._updated(Objs.objectBy(this.id_key(), Objs.keyByIndex(data)), Objs.valueByIndex(data));
				else
					throw new StoreException("unsupported: perform " + action);
			}

		};
	});
});
Scoped.define("module:Stores.AbstractIndex", [
	"base:Class",
	"base:Comparators"
], function (Class, Comparators, scoped) {
  	return Class.extend({scoped: scoped}, function (inherited) {
  		return {
  			
  			constructor: function (store, key, compare) {
  				inherited.constructor.call(this);
  				this._compare = compare || Comparators.byValue;
  				this._store = store;
  				var id_key = store.id_key();
  				store.query({}).value().iterate(function (row) {
  					this._insert(row[id_key], row[key]);
  				}, this);
  				store.on("insert", function (row) {
  					this._insert(row[id_key], row[key]);
  				}, this);
  				store.on("remove", function (id) {
  					this._remove(id);
  				}, this);
  				store.on("update", function (id, data) {
  					if (key in data)
  						this._update(id, data[key]);
  				}, this);
  			},

  			destroy: function () {
  				this._store.off(null, null, this);
  				inherited.destroy.call(this);
  			},
  			
  			iterate: function (key, direction, callback, context) {
  				this._iterate(key, direction, callback, context);
  			},
  			
  			itemIterate: function (key, direction, callback, context) {
  				this.iterate(key, direction, function (iterKey, id) {
  					return callback.call(context, iterKey, this._store.get(id).value());
  				}, this); 
  			},
  			
  			_iterate: function (key, direction, callback, context) {},
  			
  			_insert: function (id, key) {},
  			
  			_remove: function (id) {},
  			
  			_update: function (id, key) {}
  		
  		};
  	});
});

Scoped.define("module:Stores.MemoryIndex", [
	"module:Stores.AbstractIndex",
	"base:Structures.TreeMap",
	"base:Objs"
], function (AbstractIndex, TreeMap, Objs, scoped) {
  	return AbstractIndex.extend({scoped: scoped}, function (inherited) {
  		return {
  			
  			constructor: function (store, key, compare) {
  				inherited.constructor.call(this, store, key, compare);
  				this._treeMap = TreeMap.empty(this._compare);
  				this._idToKey = {};
  			},
  			
  			_insert: function (id, key) {
				this._idToKey[id] = key;
  				var value = TreeMap.find(key, this._treeMap);
  				if (value)
  					value[id] = true;
  				else 
  					this._treeMap = TreeMap.add(key, Objs.objectBy(id, true), this._treeMap);
  			},
  			
  			_remove: function (id) {
  				var key = this._idToKey[id];
  				delete this._idToKey[id];
  				var value = TreeMap.find(key, this._treeMap);
  				delete value[id];
  				if (Objs.is_empty(value))
  					this._treeMap = TreeMap.remove(key, this._treeMap);
  			},
  			
  			_update: function (id, key) {
  				var old_key = this._idToKey[id];
  				if (old_key == key)
  					return;
  				this._remove(id);
  				this._insert(id, key);
  			},
  			
  			_iterate: function (key, direction, callback, context) {
  				TreeMap.iterate_from(key, this._treeMap, function (iterKey, value) {
  					for (var id in value) {
  						if (callback.call(context, iterKey, id) === false)
  							return false;
  					}
  					return true;
  				}, this, !direction);
  			}  			
  		
  		};
  	});
});


Scoped.define("module:Stores.CachedStore", [
          "module:Stores.DualStore",
          "module:Stores.MemoryStore",
          "module:Queries.DefaultQueryModel",
          "module:Queries.Constrained",
          "base:Objs",
          "base:Async"
  	], function (DualStore, MemoryStore, DefaultQueryModel, Constrained, Objs, Async, scoped) {
  	return DualStore.extend({scoped: scoped}, function (inherited) {			
  		return {

			constructor: function (parent, options) {
				options = options || {};
				var cache_store = options.cache_store;
				if (!("cache_store" in options)) {
				    cache_store = this._auto_destroy(new MemoryStore({
		                id_key: parent.id_key()
		            }));
		        }
		        if (!cache_store.query_model())
		            cache_store.query_model(options.cache_query_model ? options.cache_query_model : this._auto_destroy(new DefaultQueryModel()));
		        this.__invalidation_options = options.invalidation || {};
		        inherited.constructor.call(this,
					parent,
					cache_store,
					Objs.extend({
						get_options: {
							start: "second",
							strategy: "or"
						},
						query_options: {
							start: "second",
							strategy: "or",
							clone: true,
							or_on_null: false
						}
					}, options));
			   if (this.__invalidation_options.reload_after_first_hit) {
			       this.__queries = {};
			       this.cache().on("query_hit", function (query, subsumizer) {
			           var s = Constrained.serialize(subsumizer);
			           if (!this.__queries[s]) {
			               this.__queries[s] = true;
			               Async.eventually(function () {
			                   this.invalidate_query(subsumizer, true);	                   
			               }, [], this);
			           }
			       }, this);
		           this.cache().on("query_miss", function (query) {
		               var s = Constrained.serialize(query);
		               this.__queries[s] = true;
		           }, this);
			   }
			},
			
			destroy: function () {
			    this.cache().off(null, null, this);
			    inherited.destroy.call(this);
			},
			
			invalidate_query: function (query, reload) {
			    this.cache().query_model().invalidate(query);
			    if (reload) 
		           this.query(query.query, query.options);
		        this.trigger("invalidate_query", query, reload);
			},
			
			cache: function () {
				return this.second();
			},
			
			store: function () {
				return this.first();
			}
			
  		};
  	});
});

Scoped.define("module:Stores.DualStore", [
          "module:Stores.BaseStore",
          "base:Objs",
          "base:Iterators.ArrayIterator"
  	], function (BaseStore, Objs, ArrayIterator, scoped) {
  	return BaseStore.extend({scoped: scoped}, function (inherited) {			
  		return {
			
			constructor: function (first, second, options) {
				options = Objs.extend({
					create_options: {},
					update_options: {},
					delete_options: {},
					get_options: {},
					query_options: {}
				}, options || {});
				options.id_key = first._id_key;
				this.__first = first;
				this.__second = second;
				inherited.constructor.call(this, options);
				this.__create_options = Objs.extend({
					start: "first", // "second"
					strategy: "then", // "or", "single"
					auto_replicate: "first" // "first", "second", "both", "none"
				}, options.create_options);
				this.__update_options = Objs.extend({
					start: "first", // "second"
					strategy: "then", // "or", "single"
					auto_replicate: "first" // "first", "second", "both", "none"
				}, options.update_options);
				this.__remove_options = Objs.extend({
					start: "first", // "second"
					strategy: "then", // "or", "single",
					auto_replicate: "first" // "first", "second", "both", "none"
				}, options.delete_options);
				this.__get_options = Objs.extend({
					start: "first", // "second"
					strategy: "or", // "single"
					clone: true, // false
					clone_second: false,
					or_on_null: true // false
				}, options.get_options);
				this.__query_options = Objs.extend({
					start: "first", // "second"
					strategy: "or", // "single"
					clone: true, // false
					clone_second: false,
					or_on_null: true // false
				}, options.query_options);
				this.__first.on("insert", this.__inserted_first, this);
				this.__second.on("insert", this.__inserted_second, this);
				this.__first.on("update", this.__updated_first, this);
				this.__second.on("update", this.__updated_second, this);
				this.__first.on("remove", this.__removed_first, this);
				this.__second.on("remove", this.__removed_second, this);
			},
			
			__inserted_first: function (row, event_data) {
				if (event_data && event_data.dual_insert)
					return;
				if (this.__create_options.auto_replicate == "first" || this.__create_options.auto_replicate == "both")
					this.__second.insert([row, {dual_insert: true}]);
				this._inserted(row);
			},
			
			__inserted_second: function (row, event_data) {
				if (event_data && event_data.dual_insert)
					return;
				if (this.__create_options.auto_replicate == "second" || this.__create_options.auto_replicate == "both")
					this.__first.insert([row, {dual_insert: true}]);
				this._inserted(row);
			},
		
			__updated_first: function (row, update, event_data) {
				if (event_data && event_data.dual_update)
					return;
				if (this.__update_options.auto_replicate == "first" || this.__update_options.auto_replicate == "both")
					this.__second.update(row[this.id_key()], [update, {dual_update: true}]);
				this._updated(row, update);
			},
			
			__updated_second: function (row, update, event_data) {
				if (event_data && event_data.dual_update)
					return;
				if (this.__update_options.auto_replicate == "second" || this.__update_options.auto_replicate == "both")
					this.__first.update(row[this.id_key()], [update, {dual_update: true}]);
				this._updated(row, update);
			},
		
			__removed_first: function (id, event_data) {
				if (event_data && event_data.dual_remove)
					return;
				if (this.__remove_options.auto_replicate == "first" || this.__remove_options.auto_replicate == "both")
					this.__second.remove([id, {dual_remove: true}]);
				this._removed(id);
			},
			
			__removed_second: function (id, event_data) {
				if (event_data && event_data.dual_remove)
					return;
				if (this.__remove_options.auto_replicate == "second" || this.__remove_options.auto_replicate == "both")
					this.__first.remove([id, {dual_remove: true}]);
				this._removed(id);
			},
		
			first: function () {
				return this.__first;
			},
			
			second: function () {
				return this.__second;
			},
		
			_insert: function (data) {
				var first = this.__first;
				var second = this.__second;
				if (this.__create_options.start != "first") {
					first = this.__second;
					second = this.__first;
				}
				var strategy = this.__create_options.strategy;
				if (strategy == "then")
					return first.insert([data, {dual_insert: true}]).mapSuccess(function (row) {
						return second.insert([row, {dual_insert: true}]);
					}, this);
				else if (strategy == "or")
					return first.insert([data, {dual_insert: true}]).mapError(function () {
						return second.insert([data, {dual_insert: true}]);
					}, this);
				else
					return first.insert([data, {dual_insert: true}]);
			},
		
			_update: function (id, data) {
				var first = this.__first;
				var second = this.__second;
				if (this.__update_options.start != "first") {
					first = this.__second;
					second = this.__first;
				}
				var strategy = this.__update_options.strategy;
				if (strategy == "then")
					return first.update(id, [data, {dual_update: true}]).mapSuccess(function (row) {
						return second.update(id, [row, {dual_update: true}]);
					}, this);
				else if (strategy == "or")
					return first.update(id, [data, {dual_update: true}]).mapError(function () {
						return second.update(id, [data, {dual_update: true}]);
					}, this);
				else
					return first.update(id, [data, {dual_update: true}]);
			},
		
			_remove: function (id) {
				var first = this.__first;
				var second = this.__second;
				if (this.__remove_options.start != "first") {
					first = this.__second;
					second = this.__first;
				}
				var strategy = this.__remove_options.strategy;
				if (strategy == "then")
					return first.remove([id, {dual_remove: true}]).mapSuccess(function () {
						return second.remove([id, {dual_remove: true}]);
					}, this);
				else if (strategy == "or")
					return first.remove([id, {dual_remove: true}]).mapError(function () {
						return second.remove([id, {dual_remove: true}]);
					}, this);
				else
					return first.remove(id);
			},
		
			_query_capabilities: function () {
				return {
					"query": true,
					"sort": true,
					"limit": true,
					"skip": true
				};
			},
		
			_get: function (id) {
				var first = this.__first;
				var second = this.__second;
				if (this.__get_options.start != "first") {
					first = this.__second;
					second = this.__first;
				}
				var strategy = this.__get_options.strategy;
				var clone = this.__get_options.clone;
				var clone_second = this.__get_options.clone_second;
				var or_on_null = this.__get_options.or_on_null;
				var result = null;
				if (strategy == "or") {
					return first.get(id).mapCallback(function (error, result) {
						if (error || (!result && or_on_null))
							return second.get(id).mapSuccess(function (result) {
								return result && clone ? first.insert(result) : result;
							}, this);
						if (!clone_second)
							return result;
						return second.get(id).mapCallback(function (error, row) {
							if (error || !row)
								return second.insert(result);
							return result;
						}, this);
					}, this);
				} else
					return first.get(id);
			},
		
			_query: function (query, options) {
				var first = this.__first;
				var second = this.__second;
				if (this.__query_options.start != "first") {
					first = this.__second;
					second = this.__first;
				}
				var strategy = this.__query_options.strategy;
				var clone = this.__query_options.clone;
				var clone_second = this.__get_options.clone_second;
				var or_on_null = this.__query_options.or_on_null;
				var result = null;
				if (strategy == "or") {
					this.trigger("query_first", query, options);
					return first.query(query, options).mapCallback(function (error, result) {
						if (error || (!result && or_on_null)) {
							this.trigger("query_second", query, options);
							return second.query(query, options).mapSuccess(function (result) {
								if (result && clone) {
									var arr = result.asArray();
									return first.insert_all(arr, {query: query, options: options}, {dual_insert: true}).mapSuccess(function () {
										return new ArrayIterator(arr);
									});
								}
								return result;
							}, this);
						}
						if (!clone_second)
							return result;
						this.trigger("query_second", query, options);
						return second.query(query, options).mapCallback(function (error, result2) {
							if (error || !result2) {
								var arr = result.asArray();
								return second.insert_all(arr, {query: query, options: options}, {dual_insert: true}).mapSuccess(function () {
									return new ArrayIterator(arr);
								});
							}
							return result;
						}, this);
					}, this);
				} else {
					this.trigger("query_first", query, options);
					return first.query(query, options);
				}
			}

  		};
  	});
});

Scoped.define("module:Queries.AbstractQueryModel", [
	    "base:Class"
	], function (Class, scoped) {
	return Class.extend({scoped: scoped}, {
	
		register: function (query) {},
		
		executable: function (query) {}

	});
});


Scoped.define("module:Queries.DefaultQueryModel", [
        "module:Queries.AbstractQueryModel",
        "module:Queries.Constrained",
        "base:Objs"
    ], function (AbstractQueryModel, Constrained, Objs, scoped) {
    return AbstractQueryModel.extend({scoped: scoped}, function (inherited) {
		return {
					
			constructor: function () {
				inherited.constructor.call(this);
		        this.__queries = {};    
			},
			
			_insert: function (query) {
				this.__queries[Constrained.serialize(query)] = query;
			},
			
			_remove: function (query) {
				delete this.__queries[Constrained.serialize(query)];
			},
			
			exists: function (query) {
				return Constrained.serialize(query) in this.__queries;
			},
			
			subsumizer_of: function (query) {
		        if (this.exists(query))
		            return query;
		        var result = null;
		        Objs.iter(this.__queries, function (query2) {
		            if (Constrained.subsumizes(query2, query))
		                result = query2;
		            return !result;
		        }, this);
		        return result;
			},
			
			executable: function (query) {
			    return !!this.subsumizer_of(query);
			},
			
			register: function (query) {
				var changed = true;
				while (changed) {
					changed = false;
					Objs.iter(this.__queries, function (query2) {
						if (Constrained.subsumizes(query, query2)) {
							this._remove(query2);
							changed = true;
						}/* else if (Constrained.mergable(query, query2)) {
							this._remove(query2);
							changed = true;
							query = Constrained.merge(query, query2);
						} */
					}, this);
				}
				this._insert(query);
			},
			
			invalidate: function (query) {
			    var subsumizer = this.subsumizer_of(query);
			    if (subsumizer)
			       this._remove(subsumizer);
			}
	
		};
    });
});


Scoped.define("module:Queries.StoreQueryModel", [
       "module:Queries.DefaultQueryModel",
       "module:Queries.Constrained"
   ], function (DefaultQueryModel, Constrained, scoped) {
   return DefaultQueryModel.extend({scoped: scoped}, function (inherited) {
	   return {
			
			constructor: function (store) {
		        this.__store = store;
		        inherited.constructor.call(this);
			},
			
			initialize: function () {
				return this.__store.mapSuccess(function (result) {
					while (result.hasNext()) {
						var query = result.next();
						delete query["id"];
		                this._insert(query);
					}
				}, this);
			},
			
			_insert: function (query) {
				inherited._insert.call(this, query);
				this.__store.insert(query);
			},
			
			_remove: function (query) {
				delete this.__queries[Constrained.serialize(query)];
				this.__store.query({query: query}).success(function (result) {
					while (result.hasNext())
						this.__store.remove(result.next().id);
				}, this);
			}

	    };
    });
});

Scoped.define("module:Modelling.ModelException", [
          "base:Exceptions.Exception"
  	], function (Exception, scoped) {
  	return Exception.extend({scoped: scoped}, function (inherited) {			
  		return {
			
			constructor: function (model, message) {
				inherited.constructor.call(this, message);
				this.__model = model;
			},
			
			model: function () {
				return this.__model;
			}
	
  		};
  	});
});


Scoped.define("module:Modelling.ModelMissingIdException", [
          "module:Modelling.ModelException"
  	], function (Exception, scoped) {
  	return Exception.extend({scoped: scoped}, function (inherited) {			
  		return {
			
			constructor: function (model) {
				inherited.constructor.call(this, model, "No id given.");
			}

  		};
  	});
});


Scoped.define("module:Modelling.ModelInvalidException", [
           "module:Modelling.ModelException",
           "base:Objs"
   	], function (Exception, Objs, scoped) {
   	return Exception.extend({scoped: scoped}, function (inherited) {			
   		return {
 			
   			constructor: function (model) {
   				var message = Objs.values(model.errors()).join("\n");
 				inherited.constructor.call(this, model, message);
 			}

   		};
   	});
 });

Scoped.define("module:Modelling.Model", [
          "module:Modelling.AssociatedProperties",
          "module:Modelling.ModelInvalidException",
          "base:Objs",
          "base:Promise",
          "base:Types",
          "base:Exceptions"
  	], function (AssociatedProperties, ModelInvalidException, Objs, Promise, Types, Exceptions, scoped) {
  	return AssociatedProperties.extend({scoped: scoped}, function (inherited) {			
  		return {

			constructor: function (attributes, table, options) {
				this.__table = table;
				this.__options = Objs.extend({
					newModel: true,
					removed: false
				}, options);
				this.__silent = 1;
				inherited.constructor.call(this, attributes);
				this.__silent = 0;
				if (!this.isNew()) {
					this._properties_changed = {};
					this._registerEvents();
				}
				if (this.option("auto_create") && this.isNew())
					this.save();
			},
			
			destroy: function () {
				this.__table.off(null, null, this);
				this.trigger("destroy");
				inherited.destroy.call(this);
			},
			
			option: function (key) {
				var opts = key in this.__options ? this.__options : this.table().options();
				return opts[key];
			},
			
			table: function () {
				return this.__table;
			},
			
			isSaved: function () {
				return this.isRemoved() || (!this.isNew() && !this.isChanged());
			},
			
			isNew: function () {
				return this.option("newModel");
			},
			
			isRemoved: function () {
				return this.option("removed");
			},
		
			_registerEvents: function () {
				this.__table.on("update:" + this.id(), function (data) {
					if (this.isRemoved())
						return;
					this.__silent++;
					for (var key in data) {
						if (!this._properties_changed[key])
							this.set(key, data);
					}
					this.__silent--;
				}, this);
				this.__table.on("remove:" + this.id(), function () {
					if (this.isRemoved())
						return;
					this.trigger("remove");
					this.__options.removed = true;
				}, this);
			},
			
			update: function (data) {
				this.__silent++;
				this.setAll(data);
				this.__silent--;
				return this.isNew() ? Promise.create(true) : this.save();
			},
		
			_afterSet: function (key, value, old_value, options) {
				inherited._afterSet.call(this, key, value, old_value, options);
				var scheme = this.cls.scheme();
				if (!(key in scheme) || this.__silent > 0)
					return;
				if (this.option("auto_update") && !this.isNew())
					this.save();
			},
			
			save: function () {
				if (this.isRemoved())
					return Promise.create({});
				var promise = this.option("save_invalid") ? Promise.value(true) : this.validate();
				return promise.mapSuccess(function (valid) {
					if (!valid)
						return Promise.create(null, new ModelInvalidException(this));
					var attrs;
					if (this.isNew()) {
						attrs = this.cls.filterPersistent(this.get_all_properties());
						if (this.__options.type_column)
							attrs[this.__options.type_column] = this.cls.classname;
					} else {
						attrs = this.cls.filterPersistent(this.properties_changed());
						if (Types.is_empty(attrs))
							return Promise.create(attrs);
					}
					var wasNew = this.isNew();
					var promise = this.isNew() ? this.__table.store().insert(attrs) : this.__table.store().update(this.id(), attrs);
					return promise.mapCallback(function (err, result) {
						if (err)
							return Exceptions.ensure(this.validation_exception_conversion(err));
						this.__silent++;
						this.setAll(result);
						this.__silent--;
						this._properties_changed = {};
						this.trigger("save");
						if (wasNew) {
							this.__options.newModel = false;
							this._registerEvents();
						}
						return result;
					}, this);
				}, this);
			},
			
			remove: function () {
				if (this.isNew() || this.isRemoved())
					return Promise.create(true);
				return this.__table.store().remove(this.id()).mapSuccess(function (result) {
					this.trigger("remove");		
					this.__options.removed = true;
					return result;
				}, this);
			}	
	
  		};
  	});
});
Scoped.define("module:Modelling.SchemedProperties", [
          "base:Properties.Properties",
          "base:Types",
          "base:Promise",
          "base:Objs",
          "module:Stores.RemoteStoreException",
          "base:Net.HttpHeader",
          "module:Modelling.ModelInvalidException"
  	], function (Properties, Types, Promise, Objs, RemoteStoreException, HttpHeader, ModelInvalidException, scoped) {
  	return Properties.extend({scoped: scoped}, function (inherited) {			
  		return {

			constructor: function (attributes) {
				inherited.constructor.call(this);
				var scheme = this.cls.scheme();
				this._properties_changed = {};
				this.__errors = {};
				for (var key in scheme) {
					if ("def" in scheme[key]) 
						this.set(key, Types.is_function(scheme[key].def) ? scheme[key].def() : scheme[key].def);
					else if (scheme[key].auto_create)
						this.set(key, scheme[key].auto_create(this));
					else
						this.set(key, null);
				}
				this._properties_changed = {};
				this.__errors = {};
				for (key in attributes)
					this.set(key, attributes[key]);
			},
			
			_unsetChanged: function (key) {
				delete this._properties_changed[key];
			},
			
			_beforeSet: function (key, value) {
				var scheme = this.cls.scheme();
				if (!(key in scheme))
					return value;
				var sch = scheme[key];
				if (sch.type)
					value = Types.parseType(value, sch.type);
				if (sch.transform)
					value = sch.transform.apply(this, [value]);
				return value;
			},
			
			_afterSet: function (key, value) {
				var scheme = this.cls.scheme();
				if (!(key in scheme))
					return;
				this._properties_changed[key] = value;
				delete this.__errors[key];
				if (scheme[key].after_set) {
					var f = Types.is_string(scheme[key].after_set) ? this[scheme[key].after_set] : scheme[key].after_set;
					f.apply(this, [value]);
				}
			},
			
			isChanged: function () {
				return !Types.is_empty(this._properties_changed);
			},
		
			properties_changed: function () {
				return this._properties_changed;
			},
			
			get_all_properties: function () {
				var result = {};
				var scheme = this.cls.scheme();
				for (var key in scheme)
					result[key] = this.get(key);
				return result;
			},
			
			validate: function () {
				this.trigger("validate");
				var promises = [];
				for (var key in this.cls.scheme())
					promises.push(this._validateAttr(key));
				promises.push(Promise.box(this._customValidate, this));
				return Promise.and(promises).end().mapSuccess(function (arr) {
					var valid = true;
					Objs.iter(arr, function (entry) {
						valid = valid && entry;
					});
					return valid;
				});
			},
			
			_customValidate: function () {
				return true;
			},
			
			_validateAttr: function (attr) {
				delete this.__errors[attr];
				var scheme = this.cls.scheme();
				var entry = scheme[attr];
				var validate = entry["validate"];
				if (!validate)
					return Promise.value(true);
				if (!Types.is_array(validate))
					validate = [validate];
				var value = this.get(attr);
				var promises = [];
				Objs.iter(validate, function (validator) {
					promises.push(Promise.box(validator.validate, validator, [value, this]));
				}, this);
				return Promise.and(promises).end().mapSuccess(function (arr) {
					var valid = true;
					Objs.iter(arr, function (entry) {
						if (entry !== null) {
							valid = false;
							this.__errors[attr] = entry;
						}
					}, this);
					this.trigger("validate:" + attr, valid, this.__errors[attr]);
					return valid;
				}, this);
			},
			
			setError: function (attr, error) {
				this.__errors[attr] = error;
				this.trigger("validate:" + attr, !(attr in this.__errors), this.__errors[attr]);
			},
			
			errors: function () {
				return this.__errors;
			},
			
			getError: function (attr) {
				return this.__errors[attr];
			},
			
			asRecord: function (tags) {
				var rec = {};
				var scheme = this.cls.scheme();
				var props = this.get_all_properties();
				tags = tags || {};
				for (var key in props) {
					if (key in scheme) {
						var target = scheme[key]["tags"] || [];
						var tarobj = {};
						Objs.iter(target, function (value) {
							tarobj[value] = true;
						});
						var success = true;
						Objs.iter(tags, function (x) {
							success = success && x in tarobj;
						}, this);
						if (success)
							rec[key] = props[key];
					}
				}
				return rec;		
			},
			
			setByTags: function (data, tags) {
				var scheme = this.cls.scheme();
				tags = tags || {};
				for (var key in data)  {
					if (key in scheme) {
						var target = scheme[key]["tags"] || [];
						var tarobj = {};
						Objs.iter(target, function (value) {
							tarobj[value] = true;
						});
						var success = true;
						Objs.iter(tags, function (x) {
							success = success && x in tarobj;
						}, this);
						if (success)
							this.set(key, data[key]);
					}
				}
			},
			
			validation_exception_conversion: function (e) {
				var source = e;
				if ("instance_of" in e && e.instance_of(RemoteStoreException))
					source = e.source();
				else if (!("status_code" in source && "data" in source))
					return e;
				if (source.status_code() == HttpHeader.HTTP_STATUS_PRECONDITION_FAILED && source.data()) {
					Objs.iter(source.data(), function (value, key) {
						this.setError(key, value);
					}, this);
					e = new ModelInvalidException(this);
				}
				return e;		
			}
			
  		};
	}, {
	
		_initializeScheme: function () {
			return {};
		},
		
		asRecords: function (arr, tags) {
			return arr.map(function (item) {
				return item.asRecord(tags);
			});
		},
		
		filterPersistent: function (obj) {
			var result = {};
			var scheme = this.scheme();
			for (var key in obj) {
				if ((!Types.is_defined(scheme[key].persistent) || scheme[key].persistent) && (Types.is_defined(obj[key])))
					result[key] = obj[key];
			}
			return result;
		}
		
	}, {
		
		scheme: function () {
			this.__scheme = this.__scheme || this._initializeScheme();
			return this.__scheme;
		}
		
	});
});


Scoped.define("module:Modelling.AssociatedProperties", [
         "module:Modelling.SchemedProperties"
 	], function (SchemedProperties, scoped) {
 	return SchemedProperties.extend({scoped: scoped}, function (inherited) {			
 		return {
			
			constructor: function (attributes) {
				inherited.constructor.call(this, attributes);
				this.assocs = this._initializeAssociations();
				for (var key in this.assocs)
					this.__addAssoc(key, this.assocs[key]);
			},
			
			__addAssoc: function (key, obj) {
				this[key] = function () {
					return obj.yield.apply(obj, arguments);
				};
			},
			
			_initializeAssociations: function () {
				return {};
			},
			
			destroy: function () {
				for (var key in this.assocs)
					this.assocs[key].destroy();
				inherited.destroy.call(this);
			},
		
			id: function () {
				return this.get(this.cls.primary_key());
			},
			
			hasId: function () {
				return this.has(this.cls.primary_key());
			}
			
		};
		
 	}, {
	
		primary_key: function () {
			return "id";
		},
		
		_initializeScheme: function () {
			var s = {};
			s[this.primary_key()] = {
				type: "id",
				tags: ["read"],
				
				after_set: null,
				persistent: true
			};
			return s;
		}
		
 	});
});
Scoped.define("module:Modelling.Table", [
          "base:Class",
          "base:Events.EventsMixin",
          "base:Objs",
          "base:Types",
          "base:Iterators.MappedIterator"
  	], function (Class, EventsMixin, Objs, Types, MappedIterator, scoped) {
  	return Class.extend({scoped: scoped}, [EventsMixin, function (inherited) {			
  		return {
		
			constructor: function (store, model_type, options) {
				inherited.constructor.call(this);
				this.__store = store;
				this.__model_type = model_type;
				this.__options = Objs.extend({
					// Attribute that describes the type
					type_column: null,
					// Creation options
					auto_create: false,
					// Update options
					auto_update: true,
					// Save invalid
					save_invalid: false
				}, options || {});
				this.__store.on("insert", function (obj) {
					this.trigger("create", obj, this.materializer(obj));
				}, this);
				this.__store.on("update", function (row, data) {
					var id = row[this.primary_key()];
					this.trigger("update", id, data, row);
					this.trigger("update:" + id, data);
				}, this);
				this.__store.on("remove", function (id) {
					this.trigger("remove", id);
					this.trigger("remove:" + id);
				}, this);
			},
			
			modelClass: function (cls) {
				cls = cls || this.__model_type;
				return Types.is_string(cls) ? Scoped.getGlobal(cls) : cls;
			},
			
			newModel: function (attributes, cls) {
				cls = this.modelClass(cls);
				var model = new cls(attributes, this);
				if (this.__options.auto_create)
					model.save();
				return model;
			},
			
			materialize: function (obj) {
				if (!obj)
					return null;
				var cls = this.modelClass(this.__options.type_column && obj[this.__options.type_column] ? this.__options.type_column : null);
				return new cls(obj, this, {newModel: false});
			},
			
			options: function () {
				return this.__options;
			},
			
			store: function () {
				return this.__store;
			},
			
			findById: function (id) {
				return this.__store.get(id).mapSuccess(this.materialize, this);
			},
		
			findBy: function (query) {
				return this.allBy(query, {limit: 1}).mapSuccess(function (iter) {
					return iter.next();
				});
			},
		
			allBy: function (query, options) {
				return this.__store.query(query, options).mapSuccess(function (iterator) {
					return new MappedIterator(iterator, function (obj) {
						return this.materialize(obj);
					}, this);
				}, this);
			},
			
			primary_key: function () {
				return (Types.is_string(this.__model_type) ? Scoped.getGlobal(this.__model_type) : this.__model_type).primary_key();
			},
			
			all: function (options) {
				return this.allBy({}, options);
			},
			
			query: function () {
				// Alias
				return this.allBy.apply(this, arguments);
			},
		
			scheme: function () {
				return this.__model_type.scheme();
			},
			
			ensure_indices: function () {
				if (!("ensure_index" in this.__store))
					return false;
				var scheme = this.scheme();
				for (var key in scheme) {
					if (scheme[key].index)
						this.__store.ensure_index(key);
				}
				return true;
			},
			
			materializer: function (obj) {
				var self = this;
				return function () {
					return self.materialize(obj);
				};
			}
			
  		};
  	}]);
});
Scoped.define("module:Modelling.Associations.Association", [
        "base:Class",
        "base:Promise",
        "base:Iterators"
    ], function (Class, Promise, Iterators, scoped) {
    return Class.extend({scoped: scoped}, function (inherited) {
		return {
		
		  	constructor: function (model, options) {
		  		inherited.constructor.call(this);
		  		this._model = model;
		  		this._options = options || {};
		  		if (options["delete_cascade"]) {
		  			model.on("remove", function () {
		  				this.__delete_cascade();
		  			}, this);
		  		}
		  	},
		  	
		  	__delete_cascade: function () {
		  		this.yield().success(function (iter) {
					iter = Iterators.ensure(iter);
					while (iter.hasNext())
						iter.next().remove({});
		  		}, this);
		  	},
		  	
		  	yield: function () {
		  		if ("__cache" in this)
		  			return Promise.create(this.__cache);
		  		var promise = this._yield();
		  		if (this._options["cached"]) {
		  			promise.callback(function (error, value) {
		  				this.__cache = error ? null : value;
		  			}, this);
		  		}
		  		return promise;
		  	},
		  	
		  	invalidate: function () {
		  		delete this.__cache;
		  	}

		};
    });
});
Scoped.define("module:Modelling.Associations.BelongsToAssociation", [
        "module:Modelling.Associations.TableAssociation",
        "base:Promise",
        "base:Objs"
    ], function (TableAssociation, Promise, Objs, scoped) {
    return TableAssociation.extend({scoped: scoped}, function (inherited) {
		return {
			
			_yield: function () {
				var value = this._model.get(this._foreign_key);
				if (!value)
					return Promise.value(null);
				return this._primary_key ?
					this._foreign_table.findBy(Objs.objectBy(this._primary_key, value)) :
					this._foreign_table.findById(value);
			}
	
		};
    });
});
Scoped.define("module:Modelling.Associations.ConditionalAssociation", [
        "module:Modelling.Associations.Associations",
        "base:Objs"
    ], function (Associations, Objs, scoped) {
    return Associations.extend({scoped: scoped}, function (inherited) {
		return {
		
		  	constructor: function (model, options) {
		  		inherited.constructor.call(this, model, Objs.extend({
		  			conditional: function () { return true; }
		  		}, options));
		  	},
	
			_yield: function () {
				var assoc = this.assoc();
				return assoc.yield.apply(assoc, arguments);
			},
			
			assoc: function () {
				return this._model.assocs[this._options.conditional(this._model)];
			}
		
		};
    });
});
Scoped.define("module:Modelling.Associations.HasManyAssociation", [
        "module:Modelling.Associations.TableAssociation",
        "base:Objs",
        "base:Iterators.ArrayIterator"
    ], function (TableAssociation, Objs, ArrayIterator, scoped) {
    return TableAssociation.extend({scoped: scoped}, function (inherited) {
		return {
		
			_id: function () {
				return this._primary_key ? this._model.get(this._primary_key) : this._model.id();
			},
		
			_yield: function () {
				return this.allBy();
			},
		
			yield: function () {
				return inherited.yield.call(this).mapSuccess(function (items) {
					return new ArrayIterator(items);
				});
			},
			
			findBy: function (query) {
				return this._foreign_table.findBy(Objs.objectBy(this._foreign_key, this._id()));
			},
		
			allBy: function (query, id) {
				return this._foreign_table.allBy(Objs.extend(Objs.objectBy(this._foreign_key, id ? id : this._id(), query)));
			}

		};
    });
});
Scoped.define("module:Modelling.Associations.HasManyThroughArrayAssociation", [
        "module:Modelling.Associations.HasManyAssociation",
        "base:Promise",
        "base:Objs"
    ], function (HasManyAssociation, Promise, Objs, scoped) {
    return HasManyAssociation.extend({scoped: scoped}, {
		
		_yield: function () {
			var returnPromise = Promise.create();
			var promises = Promise.and();
			Objs.iter(this._model.get(this._foreign_key), function (id) {
				promises = promises.and(this._foreign_table.findById(id));
			}, this);
			promises.forwardError(returnPromise).success(function (result) {
				returnPromise.asyncSuccess(Objs.filter(result, function (item) {
					return !!item;
				}));
			});
			return returnPromise;
		}

    });
});
Scoped.define("module:Modelling.Associations.HasManyViaAssociation", [
        "module:Modelling.Associations.HasManyAssociation",
        "base:Objs",
        "base:Promise"
    ], function (HasManyAssociation, Objs, Promise, scoped) {
    return HasManyAssociation.extend({scoped: scoped}, function (inherited) {
		return {
			
			constructor: function (model, intermediate_table, intermediate_key, foreign_table, foreign_key, options) {
				inherited.constructor.call(this, model, foreign_table, foreign_key, options);
				this._intermediate_table = intermediate_table;
				this._intermediate_key = intermediate_key;
			},
		
			findBy: function (query) {
				var returnPromise = Promise.create();
				var intermediateQuery = Objs.objectBy(this._intermediate_key, this._id());
				this._intermediate_table.findBy(intermediateQuery).forwardError(returnPromise).success(function (intermediate) {
					if (intermediate) {
						var full_query = Objs.extend(
							Objs.clone(query, 1),
							Objs.objectBy(this._foreign_table.primary_key(), intermediate.get(this._foreign_key)));
						this._foreign_table.findBy(full_query).forwardCallback(returnPromise);
					} else
						returnPromise.asyncSuccess(null);
				}, this);
				return returnPromise;
			},
		
			allBy: function (query, id) {
				var returnPromise = Promise.create();
				var intermediateQuery = Objs.objectBy(this._intermediate_key, id ? id : this._id());
				this._intermediate_table.allBy(intermediateQuery).forwardError(returnPromise).success(function (intermediates) {
					var promises = Promise.and();
					while (intermediates.hasNext()) {
						var intermediate = intermediates.next();
						var full_query = Objs.extend(
							Objs.clone(query, 1),
							Objs.objectBy(this._foreign_table.primary_key(), intermediate.get(this._foreign_key)));
						promises = promises.and(this._foreign_table.allBy(full_query));
					}
					promises.forwardError(returnPromise).success(function (foreignss) {
						var results = [];
						Objs.iter(foreignss, function (foreigns) {
							while (foreigns.hasNext())
								results.push(foreigns.next());
						});
						returnPromise.asyncSuccess(results);
					}, this);
				}, this);
				return returnPromise;
			}

		};
    });
});
Scoped.define("module:Modelling.Associations.HasOneAssociation", [
        "module:Modelling.Associations.TableAssociation",
        "base:Objs"
    ], function (TableAssociation, Objs, scoped) {
    return TableAssociation.extend({scoped: scoped}, {
	
		_yield: function (id) {
			var value = id ? id : (this._primary_key ? this._model.get(this._primary_key) : this._model.id());
			return this._foreign_table.findBy(Objs.objectBy(this._foreign_key, value));
		}

    });
});
Scoped.define("module:Modelling.Associations.PolymorphicHasOneAssociation", [
        "module:Modelling.Associations.Association",
        "base:Objs"
    ], function (Association, Objs, scoped) {
    return Association.extend({scoped: scoped}, function (inherited) {
		return {
			
			constructor: function (model, foreign_table_key, foreign_key, options) {
				inherited.constructor.call(this, model, options);
				this._foreign_table_key = foreign_table_key;
				this._foreign_key = foreign_key;
				if (options["primary_key"])
					this._primary_key = options.primary_key;
			},

			_yield: function (id) {
				var value = id ? id : (this._primary_key ? this._model.get(this._primary_key) : this._model.id());
				var foreign_table = Scoped.getGlobal(this._model.get(this._foreign_table_key));
				return foreign_table.findBy(Objs.objectBy(this._foreign_key, value));
			}

		};
    });
});

Scoped.define("module:Modelling.Associations.TableAssociation", [
        "module:Modelling.Associations.Association"
    ], function (Association, scoped) {
    return Association.extend({scoped: scoped}, function (inherited) {
		return {
			
			constructor: function (model, foreign_table, foreign_key, options) {
				inherited.constructor.call(this, model, options);
				this._foreign_table = foreign_table;
				this._foreign_key = foreign_key;
			}

		};
    });
});
Scoped.define("module:Modelling.Validators.ConditionalValidator", [
        "module:Modelling.Validators.Validator",
        "base:Types"
    ], function (Validator, Types, scoped) {
    return Validator.extend({scoped: scoped}, function (inherited) {
		return {
			
			constructor: function (condition, validator) {
				inherited.constructor.call(this);
				this.__condition = condition;
				this.__validator = Types.is_array(validator) ? validator : [validator];
			},
		
			validate: function (value, context) {
				if (!this.__condition(value, context))
					return null;
				for (var i = 0; i < this.__validator.length; ++i) {
					var result = this.__validator[i].validate(value, context);
					if (result !== null)
						return result;
				}
				return null;
			}

		};
    });
});
Scoped.define("module:Modelling.Validators.EmailValidator", [
        "module:Modelling.Validators.Validator",
        "base:Strings"
    ], function (Validator, Strings, scoped) {
    return Validator.extend({scoped: scoped}, function (inherited) {
		return {

			constructor: function (error_string) {
				inherited.constructor.call(this);
				this.__error_string = error_string ? error_string : "Not a valid email address";
			},
		
			validate: function (value, context) {
				return Strings.is_email_address(value) ? null : this.__error_string;
			}

		};
    });
});
Scoped.define("module:Modelling.Validators.LengthValidator", [
        "module:Modelling.Validators.Validator",
        "base:Types",
        "base:Objs"
    ], function (Validator, Types, Objs, scoped) {
    return Validator.extend({scoped: scoped}, function (inherited) {
		return {
			
			constructor: function (options) {
				inherited.constructor.call(this);
				options = Objs.extend({
					min_length: null,
					max_length: null,
					error_string: null
				}, options);
				this.__min_length = options.min_length;
				this.__max_length = options.max_length;
				this.__error_string = options.error_string;
				if (!this.__error_string) {
					if (this.__min_length !== null) {
						if (this.__max_length !== null)
							this.__error_string = "Between " + this.__min_length + " and " + this.__max_length + " characters";
						else
							this.__error_string = "At least " + this.__min_length + " characters";
					} else if (this.__max_length !== null)
						this.__error_string = "At most " + this.__max_length + " characters";
				}
			},
		
			validate: function (value, context) {
				if (this.__min_length !== null && (!value || value.length < this.__min_length))
					return this.__error_string;
				if (this.__max_length !== null && value.length > this.__max_length)
					return this.__error_string;
				return null;
			}

		};
    });
});
Scoped.define("module:Modelling.Validators.PresentValidator", [
        "module:Modelling.Validators.Validator",
        "base:Types"
    ], function (Validator, Types, scoped) {
    return Validator.extend({scoped: scoped}, function (inherited) {
		return {
			
			constructor: function (error_string) {
				inherited.constructor.call(this);
				this.__error_string = error_string ? error_string : "Field is required";
			},
		
			validate: function (value, context) {
				return Types.is_null(value) || value === "" ? this.__error_string : null;
			}

		};
    });
});
Scoped.define("module:Modelling.Validators.UniqueValidator", [
        "module:Modelling.Validators.Validator"
    ], function (Validator, scoped) {
    return Validator.extend({scoped: scoped}, function (inherited) {
		return {
			
			constructor: function (key, error_string) {
				inherited.constructor.call(this);
				this.__key = key;
				this.__error_string = error_string ? error_string : "Key already present";
			},
		
			validate: function (value, context) {
				var query = {};
				query[this.__key] = value;
				return context.table().findBy(query).mapSuccess(function (item) {
					return (!item || (!context.isNew() && context.id() == item.id())) ? null : this.__error_string;
				}, this);		
			}

		};
    });
});
Scoped.define("module:Modelling.Validators.Validator", [
        "base:Class"
    ], function (Class, scoped) {
    return Class.extend({scoped: scoped}, {
		
		validate: function (value, context) {
			return null;
		}

    });
});
}).call(Scoped);