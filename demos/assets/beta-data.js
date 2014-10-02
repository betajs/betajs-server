/*!
betajs-data - v1.0.0 - 2014-10-02
Copyright (c) Oliver Friedmann
MIT Software License.
*/
BetaJS.Queries = {

	/*
	 * Syntax:
	 *
	 * queries :== [query, ...]
	 * simples :== [simple, ...]
	 * query :== {pair, ...}
	 * pair :== string: value | $or : queries | $and: queries
	 * value :== simple | {condition, ...}  
	 * condition :== $in: simples | $gt: simple | $lt: simple | $sw: simple | $gtic: simple | $ltic: simple | $swic: simple
	 *
	 */
	
	subsumizes: function (query, query2) {
		// This is very simple at this point
		if (!BetaJS.Types.is_object(query) || !BetaJS.Types.is_object)
			return query == query2;
		for (var key in query) {
			if (!(key in query2) || !this.subsumizes(query[key], query2[key]))
				return false;
		}
		return true;
	},
	
	normalize: function (query) {
		return BetaJS.Sort.deep_sort(query);
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
		BetaJS.Objs.iter(queries, function (query) {
			dep = this.__dependencies_query(query, dep);
		}, this);
		return dep;
	},
	
	__dependencies_query: function (query, dep) {
		for (key in query)
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
		if (BetaJS.Types.is_object(value)) {
			var result = true;
			BetaJS.Objs.iter(value, function (tar, op) {
				if (op == "$in")
					result = result && BetaJS.Objs.contains_value(tar, object_value);
				if (op == "$gt")
					result = result && object_value >= tar;
				if (op == "$gtic")
					result = result && object_value.toLowerCase() >= tar.toLowerCase();
				if (op == "$lt")
					result = result && object_value <= tar;
				if (op == "$ltic")
					result = result && object_value.toLowerCase() <= tar.toLowerCase();
				if (op == "$sw")
					result = result && object_value.indexOf(tar) === 0;
				if (op == "$swic")
					result = result && object_value.toLowerCase().indexOf(tar.toLowerCase()) === 0;
			}, this);
			return result;
		}
		return value == object_value;
	},
	
	__evaluate_or: function (arr, object) {
		BetaJS.Objs.iter(arr, function (query) {
			if (this.__evaluate_query(query, object))
				return true;
		}, this);
		return false;
	},
	
	__evaluate_and: function (arr, object) {
		BetaJS.Objs.iter(arr, function (query) {
			if (!this.__evaluate_query(query, object))
				return false;
		}, this);
		return true;
	},
	
	format: function (query) {
		if (BetaJS.Class.is_class_instance(query))
			return query.format();
		return JSON.stringify(query);
	},
	
	overloaded_evaluate: function (query, object) {
		if (BetaJS.Class.is_class_instance(query))
			return query.evaluate(object);
		if (BetaJS.Types.is_function(query))
			return query(object);
		return this.evaluate(query, object);
	},
	
	evaluate : function(query, object) {
		return this.__evaluate_query(query, object);
	},
/*
	__compile : function(query) {
		if (BetaJS.Types.is_array(query)) {
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
				var right = BetaJS.Types.is_string(value) ? "'" + value + "'" : value;
				return left + " " + op + " " + right;
			}
		} else if (BetaJS.Types.is_object(query)) {
			var s = "true";
			for (key in query)
				s += " && (object['" + key + "'] == " + (BetaJS.Types.is_string(query[key]) ? "'" + query[key] + "'" : query[key]) + ")";
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
			iter = BetaJS.Iterators.ArrayIterator([]);
		else if (BetaJS.Types.is_array(raw))
			iter = BetaJS.Iterators.ArrayIterator(raw);		
		return new BetaJS.Iterators.FilteredIterator(iter, function(row) {
			return BetaJS.Queries.evaluate(query, row);
		});
	}	
	
}; 
BetaJS.Queries.Constrained = {
	
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
		instance.query = BetaJS.Queries.format(query);
		var result = JSON.stringify(instance);
		instance.query = query;
		return result;
	},
	
	normalize: function (constrained_query) {
		return {
			query: "query" in constrained_query ? BetaJS.Queries.normalize(constrained_query.query) : {},
			options: {
				skip: "options" in constrained_query && "skip" in constrained_query.options ? constrained_query.options.skip : null,
				limit: "limit" in constrained_query && "limit" in constrained_query.options ? constrained_query.options.limit : null,
				sort: "sort" in constrained_query && "sort" in constrained_query.options ? constrained_query.options.sort : {}
			}
		};
	},
	
	emulate: function (constrained_query, query_capabilities, query_function, query_context, callbacks) {
		var query = constrained_query.query || {};
		var options = constrained_query.options || {};
		var execute_query = {};
		var execute_options = {};
		if ("sort" in options && "sort" in query_capabilities)
			execute_options.sort = options.sort;
		// Test
		execute_query = query;
		if ("query" in query_capabilities || BetaJS.Types.is_empty(query)) {
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
		var params = [execute_query, execute_options];
		if (callbacks)
			params.push(callbacks);
		var success_call = function (raw) {
			var iter = raw;
			if (raw === null)
				iter = new BetaJS.Iterators.ArrayIterator([]);
			else if (BetaJS.Types.is_array(raw))
				iter = new BetaJS.Iterators.ArrayIterator(raw);		
			if (!("query" in query_capabilities || BetaJS.Types.is_empty(query)))
				iter = new BetaJS.Iterators.FilteredIterator(iter, function(row) {
					return BetaJS.Queries.evaluate(query, row);
				});
			if ("sort" in options && !("sort" in execute_options))
				iter = new BetaJS.Iterators.SortedIterator(iter, BetaJS.Comparators.byObject(options.sort));
			if ("skip" in options && !("skip" in execute_options))
				iter = new BetaJS.Iterators.SkipIterator(iter, options["skip"]);
			if ("limit" in options && !("limit" in execute_options))
				iter = new BetaJS.Iterators.LimitIterator(iter, options["limit"]);
			if (callbacks && callbacks.success)
				BetaJS.SyncAsync.callback(callbacks, "success", iter);
			return iter;
		};
		var exception_call = function (e) {
			if (callbacks && callbacks.exception)
				BetaJS.SyncAsync.callback(callbacks, "exception", e);
			else
				throw e;
		};
		if (callbacks) 
			query_function.apply(query_context || this, [execute_query, execute_options, {
				success: success_call,
				exception: exception_call,
				sync: callbacks.sync,
				context: callbacks.context || this
			}]);
		else
			try {
				var raw = query_function.apply(query_context || this, [execute_query, execute_options]);
				return success_call(raw);
			} catch (e) {
				exception_call(e);
			}
		return true;	
	},
	
	subsumizes: function (query, query2) {
		qopt = query.options || {};
		qopt2 = query2.options || {};
		qskip = qopt.skip || 0;
		qskip2 = qopt2.skip || 0;
		qlimit = qopt.limit || null;
		qlimit2 = qopt2.limit || null;
		qsort = qopt.sort;
		qsort2 = qopt2.sort;
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
		return BetaJS.Queries.subsumizes(query.query, query2.query);
	},
	
	serialize: function (query) {
		return JSON.stringify(this.normalize(query));
	},
	
	unserialize: function (query) {
		return JSON.parse(query);
	},
	
	mergeable: function (query, query2) {
		if (BetaJS.Queries.serialize(query.query) != BetaJS.Queries.serialize(query2.query))
			return false;
		var qots = query.options || {};
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
		var qots = query.options || {};
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

BetaJS.Class.extend("BetaJS.Queries.AbstractQueryModel", {
	
	register: function (query) {
	},
	
	executable: function (query) {
	}
	
});


BetaJS.Queries.AbstractQueryModel.extend("BetaJS.Queries.DefaultQueryModel", {

	constructor: function () {
		this._inherited(BetaJS.Queries.DefaultQueryModel, "constructor");
        this.__queries = {};    
	},
	
	_insert: function (query) {
		this.__queries[BetaJS.Queries.Constrained.serialize(query)] = query;
	},
	
	_remove: function (query) {
		delete this.__queries[BetaJS.Queries.Constrained.serialize(query)];
	},
	
	exists: function (query) {
		return BetaJS.Queries.Constrained.serialize(query) in this.__queries;
	},
	
	subsumizer_of: function (query) {
        if (this.exists(query))
            return query;
        var result = null;
        BetaJS.Objs.iter(this.__queries, function (query2) {
            if (BetaJS.Queries.Constrained.subsumizes(query2, query))
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
			BetaJS.Objs.iter(this.__queries, function (query2) {
				if (BetaJS.Queries.Constrained.subsumizes(query, query2)) {
					this._remove(query2);
					changed = true;
				}/* else if (BetaJS.Queries.Constrained.mergable(query, query2)) {
					this._remove(query2);
					changed = true;
					query = BetaJS.Queries.Constrained.merge(query, query2);
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
	
});


BetaJS.Queries.DefaultQueryModel.extend("BetaJS.Queries.StoreQueryModel", {
	
	constructor: function (store) {
        this.__store = store;
		this._inherited(BetaJS.Queries.StoreQueryModel, "constructor");
	},
	
	initialize: function (callbacks) {
		this.__store.query({}, {}, {
		    context: this,
			success: function (result) {
				while (result.hasNext()) {
					var query = result.next();
					delete query["id"];
                    this._insert(query);
				}
				BetaJS.SyncAsync.callback(callbacks, "success");
			}, exception: function (err) {
			    BetaJS.SyncAsync.callback(callbacks, "exception", err);
			}
		});
	},
	
	_insert: function (query) {
		this._inherited(BetaJS.Queries.StoreQueryModel, "_insert", query);
		this.__store.insert(query, {});
	},
	
	_remove: function (query) {
		delete this.__queries[BetaJS.Queries.Constrained.serialize(query)];
		this.__store.query({query: query}, {}, {
		    context: this,
			success: function (result) {
				while (result.hasNext())
					this.__store.remove(result.next().id, {});
			}
		});
	}

});

BetaJS.Collections.Collection.extend("BetaJS.Collections.QueryCollection", {
	
	constructor: function (source, query, options, callbacks) {
		this._source = source;
		this._inherited(BetaJS.Collections.QueryCollection, "constructor", options);
		this._options = BetaJS.Objs.extend({
			forward_steps: null,
			backward_steps: null,
			range: null
		}, options);
		if (query !== null)
			this.set_query(query, callbacks);
	},
	
	query: function () {
		return this._query;
	},
	
	set_query: function (query, callbacks) {
		if (callbacks)
			callbacks.context = callbacks.context || this;
		this._query = BetaJS.Objs.extend({
			query: {},
			options: {}
		}, query);
		this._query.options.skip = this._query.options.skip || 0;
		this._query.options.limit = this._query.options.limit || null;
		this._query.options.sort = this._query.options.sort || {};  
		this._count = 0;
		this.__execute_query(this._query.options.skip, this._query.options.limit, true, callbacks);
	},
	
	__sub_query: function (options, callbacks) {
		this._source.query(this._query.query, options, callbacks);
	},
	
	__execute_query: function (skip, limit, clear_before, callbacks) {
		skip = Math.max(skip, 0);
		var q = {};
		if (this._query.options.sort && !BetaJS.Types.is_empty(this._query.options.sort))
			q.sort = this._query.options.sort;
		if (clear_before) {
			if (skip > 0)
				q.skip = skip;
			if (limit !== null)
				q.limit = limit;
			this.__sub_query(q, {
				context: this,
				success: function (iter) {
					var objs = iter.asArray();
					this._query.options.skip = skip;
					this._query.options.limit = limit;
					this._count = !limit || objs.length < limit ? skip + objs.length : null;
					this.clear();
					this.add_objects(objs);
					BetaJS.SyncAsync.callback(callbacks, "success");
				}
			});
		} else if (skip < this._query.options.skip) {
			limit = this._query.options.skip - skip;
			if (skip > 0)
				q.skip = skip;
			q.limit = limit;
			this.__sub_query(q, {
				context: this,
				success: function (iter) {
					var objs = iter.asArray();
					this._query.options.skip = skip;
					var added = this.add_objects(objs);
					this._query.options.limit = this._query.options.limit === null ? null : this._query.options.limit + added;
					BetaJS.SyncAsync.callback(callbacks, "success");
				}
			});
		} else if (skip >= this._query.options.skip) {
			if (this._query.options.limit !== null && (!limit || skip + limit > this._query.options.skip + this._query.options.limit)) {
				limit = (skip + limit) - (this._query.options.skip + this._query.options.limit);
				skip = this._query.options.skip + this._query.options.limit;
				if (skip > 0)
					q.skip = skip;
				if (limit)
					q.limit = limit;
				this.__sub_query(q, {
					context: this,
					success: function (iter) {
						var objs = iter.asArray();
						var added = this.add_objects(objs);
						this._query.options.limit = this._query.options.limit + added;
						if (limit > objs.length)
							this._count = skip + added;
						BetaJS.SyncAsync.callback(callbacks, "success");
					}
				});
			}
		}
	},
	
	increase_forwards: function (steps, callbacks) {
		steps = !steps ? this._options.forward_steps : steps;
		if (!steps || this._query.options.limit === null)
			return;
		this.__execute_query(this._query.options.skip + this._query.options.limit, steps, false, callbacks);
	},
	
	increase_backwards: function (steps) {
		steps = !steps ? this._options.backward_steps : steps;
		if (steps && this._query.options.skip > 0) {
			steps = Math.min(steps, this._query.options.skip);
			this.__execute_query(this._query.options.skip - steps, steps, false);
		}
	},
	
	paginate: function (index) {
		this.__execute_query(this._options.range * index, this._options.range, true);
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
			return;
		var paginate_count = this.paginate_count();
		if (!paginate_count || paginate_index < this.paginate_count() - 1)
			this.paginate(paginate_index + 1);
	},
	
	prev: function () {
		var paginate_index = this.paginate_index();
		if (!paginate_index)
			return;
		if (paginate_index > 0)
			this.paginate(paginate_index - 1);
	},
	
	isComplete: function () {
		return this._count !== null;
	}
	
});



BetaJS.Collections.QueryCollection.extend("BetaJS.Collections.ActiveQueryCollection", {
	
	constructor: function (source, query, options, callbacks) {
		this._inherited(BetaJS.Collections.ActiveQueryCollection, "constructor", source, query, options, callbacks);
		source.on("create", this.__active_create, this);
		source.on("remove", this.__active_remove, this);
		source.on("update", this.__active_update, this);
	},
	
	destroy: function () {
		this._source.off(null, null, this);
		this._inherited(BetaJS.Collections.ActiveQueryCollection, "destroy");
	},
	
	is_valid: function (object) {
		return BetaJS.Queries.evaluate(this.query().query, object.getAll());
	},
	
	__active_create: function (object) {
		if (!this.is_valid(object) || this.exists(object))
			return;
		this.add(object);
		this._count = this._count + 1;
		if (this._query.options.limit !== null)
			this._query.options.limit = this._query.options.limit + 1;
	},
	
	__active_remove: function (object) {
		if (!this.exists(object))
			return;
		this.remove(object);
		this._count = this._count - 1;
		if (this._query.options.limit !== null)
			this._query.options.limit = this._query.options.limit - 1;
	},
	
	__active_update: function (object) {
		if (!this.is_valid(object))
			this.__active_remove(object);
		else
			this.__active_create(object);
	}
	
});

BetaJS.Exceptions.Exception.extend("BetaJS.Stores.StoreException");

BetaJS.Class.extend("BetaJS.Stores.ListenerStore", [
	BetaJS.Events.EventsMixin,
	{
		
	constructor: function (options) {
		this._inherited(BetaJS.Stores.ListenerStore, "constructor");
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
		
}]);



/** @class */
BetaJS.Stores.BaseStore = BetaJS.Stores.ListenerStore.extend("BetaJS.Stores.BaseStore", [
	BetaJS.SyncAsync.SyncAsyncMixin,
	/** @lends BetaJS.Stores.BaseStore.prototype */
	{
		
	constructor: function (options) {
		this._inherited(BetaJS.Stores.BaseStore, "constructor", options);
		options = options || {};
		this._id_key = options.id_key || "id";
		this._create_ids = options.create_ids || false;
		this._last_id = 1;
		this._supportsSync = true;
		this._supportsAsync = true;
		this._query_model = "query_model" in options ? options.query_model : null;
	},
	
    query_model: function () {
        if (arguments.length > 0)
            this._query_model = arguments[0];
        return this._query_model;
    },
    
	/** Insert data to store. Return inserted data with id.
	 * 
 	 * @param data data to be inserted
 	 * @return data that has been inserted with id.
 	 * @exception if it fails
	 */
	_insert: function (data, callbacks) {
		throw new BetaJS.Stores.StoreException("unsupported: insert");
	},
	
	/** Remove data from store. Return removed data.
	 * 
 	 * @param id data id
 	 * @exception if it fails
	 */
	_remove: function (id, callbacks) {
		throw new BetaJS.Stores.StoreException("unsupported: remove");
	},
	
	/** Get data from store by id.
	 * 
	 * @param id data id
	 * @return data
	 * @exception if it fails
	 */
	_get: function (id, callbacks) {
		throw new BetaJS.Stores.StoreException("unsupported: get");
	},
	
	/** Update data by id.
	 * 
	 * @param id data id
	 * @param data updated data
	 * @return data from store
	 * @exception if it fails
	 */
	_update: function (id, data, callbacks) {
		throw new BetaJS.Stores.StoreException("unsupported: update");
	},
	
	_query_capabilities: function () {
		return {};
	},
	
	/*
	 * @exception if it fails
	 */
	_query: function (query, options, callbacks) {
		throw new BetaJS.Stores.StoreException("unsupported: query");
	},
	
	insert: function (data, callbacks) {
		var event_data = null;
		if (BetaJS.Types.is_array(data)) {
			event_data = data[1];
			data = data[0];
		}			
		if (this._create_ids && !(this._id_key in data && data[this._id_key])) {
			while (this.get(this._last_id))
				this._last_id++;
			data[this._id_key] = this._last_id;
		}
		return this.then(this._insert, [data], callbacks, function (row, callbacks) {
			this._inserted(row, event_data);
			BetaJS.SyncAsync.callback(callbacks, "success", row);
		});
	},
	
	insert_all: function (data, callbacks, query) {
		var event_data = null;
		if (arguments.length > 3)
			event_data = arguments[3];
		if (query && this._query_model) {
			this.trigger("query_register", query);
			this._query_model.register(query);
		}
		if (callbacks) {
			var self = this;
			var f = function (i) {
				if (i >= data.length) {
					BetaJS.SyncAsync.callback(callbacks, "success");
					return;
				}
				this.insert(event_data ? [data[i], event_data] : data[i], BetaJS.SyncAsync.mapSuccess(callbacks, function () {
					f.call(self, i + 1);
				}));
			};
			f.call(this, 0);
		} else {
			for (var i = 0; i < data.length; ++i)
				this.insert(event_data ? [data[i], event_data] : data[i]);
		}
	},

	remove: function (id, callbacks) {
		var event_data = null;
		if (BetaJS.Types.is_array(id)) {
			event_data = id[1];
			id = id[0];
		}			
		return this.then(this._remove, [id], callbacks, function (result, callbacks) {
			this._removed(id, event_data);
			BetaJS.SyncAsync.callback(callbacks, "success", id);
		});
	},
	
	get: function (id, callbacks) {
		return this.delegate(this._get, [id], callbacks);
	},
	
	update: function (id, data, callbacks) {
		var event_data = null;
		if (BetaJS.Types.is_array(data)) {
			event_data = data[1];
			data = data[0];
		}			
		return this.then(this._update, [id, data], callbacks, function (row, callbacks) {
			this._updated(row, data, event_data);
			BetaJS.SyncAsync.callback(callbacks, "success", row, data);
		});
	},
	
	query: function (query, options, callbacks) {
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
    			var e = new BetaJS.Stores.StoreException("Cannot execute query");
    			if (callbacks)
    			    BetaJS.SyncAsync.callback(callbacks, "exception", e);
    			else
    				throw e;
    			return null;
    		} else
    		    this.trigger("query_hit", {query: query, options: options}, subsumizer);
		}
		var q = function (callbacks) {
			return BetaJS.Queries.Constrained.emulate(
				BetaJS.Queries.Constrained.make(query, options || {}),
				this._query_capabilities(),
				this._query,
				this,
				callbacks);			
		};
		return this.either(callbacks, q, q);
	},
	
	_query_applies_to_id: function (query, id) {
		var row = this.get(id);
		return row && BetaJS.Queries.overloaded_evaluate(query, row);
	},
	
	clear: function (callbacks) {
		return this.then(this.query, [{}, {}], callbacks, function (iter, callbacks) {
			var promises = [];
			while (iter.hasNext())
				promises.push(this.remove, [iter.next().id]);
			return this.join(promises, callbacks);
		});
	},
	
	_ensure_index: function (key) {
	},
	
	ensure_index: function (key) {
		this._ensure_index(key);
	},
	
	perform: function (commit, callbacks) {
		var action = BetaJS.Objs.keyByIndex(commit);
		var data = BetaJS.Objs.valueByIndex(commit);
		if (action == "insert")
			this.insert(data, callbacks);
		else if (action == "remove")
			this.remove(data, callbacks);
		else if (action == "update")
			this.update(BetaJS.Objs.keyByIndex(data), BetaJS.Objs.valueByIndex(data), callbacks);
		else
			throw new BetaJS.Stores.StoreException("unsupported: perform " + action);
	},
	
	bulk: function (commits, optimistic, callbacks) {
		var result = [];
		if (callbacks) {
			var helper = function () {
				if (result.length < commits.length) {
					this.perform(commits[result.length], {
						context: this,
						success: function () {
							result.push(true);
							helper.apply(this);
						},
						exception: function (e) {
							result.push(false);
							if (optimistic)
								helper.apply(this);
							else
								callbacks.exception.apply(callbacks.context || this, e);
						}
					});
				} else
					callbacks.success.call(callbacks.context || this, result);
			};
			helper.apply(this);
		} else {
			for (var i = 0; i < commits.length; ++i) {
				try {
					this.perform(commits[i]);
					result.push(true);
				} catch (e) {
					result.push(false);
					if (!optimistic)
						throw e;
				}
			}
		}
		return result;
	}	

}]);

BetaJS.Stores.BaseStore.extend("BetaJS.Stores.AssocStore", {
	
	_read_key: function (key) {},
	_write_key: function (key, value) {},
	_remove_key: function (key) {},
	_iterate: function () {},
	
	constructor: function (options) {
		options = options || {};
		options.create_ids = true;
		this._inherited(BetaJS.Stores.AssocStore, "constructor", options);
		this._supportsAsync = false;
	},
	
	_insert: function (data) {
		this._write_key(data[this._id_key], data);
		return data;
	},
	
	_remove: function (id) {
		var row = this._read_key(id);
		if (row && !this._remove_key(id))
			return null;
		return row;
	},
	
	_get: function (id) {
		return this._read_key(id);
	},
	
	_update: function (id, data) {
		var row = this._get(id);
		if (row) {
		    if (this._id_key in data) {
		        this._remove_key(id);
                id = data[this._id_key];
                delete data[this._id_key];
		    }
			BetaJS.Objs.extend(row, data);
			this._write_key(id, row);
		}
		return row;
	},
	
	_query: function (query, options) {
		return this._iterate();
	}

});

// Stores everything temporarily in the browser's memory

BetaJS.Stores.AssocStore.extend("BetaJS.Stores.MemoryStore", {
	
	constructor: function (options) {
		this._inherited(BetaJS.Stores.MemoryStore, "constructor", options);
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
		return new BetaJS.Iterators.ObjectValuesIterator(this.__data);
	}
	
});

BetaJS.Stores.BaseStore.extend("BetaJS.Stores.DumbStore", {
	
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
		this._inherited(BetaJS.Stores.DumbStore, "constructor", options);
		this._supportsAsync = false;
	},

	_insert: function (data) {
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
	},
	
	_remove: function (id) {
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
	},
	
	_get: function (id) {
		return this._read_item(id);
	},
	
	_update: function (id, data) {
		var row = this._get(id);
		if (row) {
			delete data[this._id_key];
			BetaJS.Objs.extend(row, data);
			this._write_item(id, row);
		}
		return row;
	},
	
	_query_capabilities: function () {
		return {
			query: true
		};
	},

	_query: function (query, options) {
		var iter = new BetaJS.Iterators.Iterator();
		var store = this;
		var fid = this._read_first_id();
		BetaJS.Objs.extend(iter, {
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
	}	
	
});

BetaJS.Stores.DumbStore.extend("BetaJS.Stores.AssocDumbStore", {
	
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

// Stores everything permanently in the browser's local storage

BetaJS.Stores.AssocDumbStore.extend("BetaJS.Stores.LocalStore", {
	
	constructor: function (options) {
		this._inherited(BetaJS.Stores.LocalStore, "constructor", options);
		this.__prefix = options.prefix;
	},
	
	__key: function (key) {
		return this.__prefix + key;
	},
	
	_read_key: function (key) {
		var prfkey = this.__key(key);
		return prfkey in localStorage ? JSON.parse(localStorage[prfkey]) : null;
	},
	
	_write_key: function (key, value) {
		localStorage[this.__key(key)] = JSON.stringify(value);
	},
	
	_remove_key: function (key) {
		delete localStorage[this.__key(key)];
	}
	
});

BetaJS.Stores.BaseStore.extend("BetaJS.Stores.DualStore", {
	
	constructor: function (first, second, options) {
		options = BetaJS.Objs.extend({
			create_options: {},
			update_options: {},
			delete_options: {},
			get_options: {},
			query_options: {}
		}, options || {});
		options.id_key = first._id_key;
		this.__first = first;
		this.__second = second;
		this._inherited(BetaJS.Stores.DualStore, "constructor", options);
		this._supportsSync = first.supportsSync() && second.supportsSync();
		this._supportsAsync = first.supportsAsync() || second.supportsAsync();
		this.__create_options = BetaJS.Objs.extend({
			start: "first", // "second"
			strategy: "then", // "or", "single"
			auto_replicate: "first" // "first", "second", "both", "none"
		}, options.create_options);
		this.__update_options = BetaJS.Objs.extend({
			start: "first", // "second"
			strategy: "then", // "or", "single"
			auto_replicate: "first" // "first", "second", "both", "none"
		}, options.update_options);
		this.__remove_options = BetaJS.Objs.extend({
			start: "first", // "second"
			strategy: "then", // "or", "single",
			auto_replicate: "first" // "first", "second", "both", "none"
		}, options.delete_options);
		this.__get_options = BetaJS.Objs.extend({
			start: "first", // "second"
			strategy: "or", // "single"
			clone: true, // false
			clone_second: false,
			or_on_null: true // false
		}, options.get_options);
		this.__query_options = BetaJS.Objs.extend({
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
			this.__second.insert([row, {dual_insert: true}], {});
		this._inserted(row);
	},
	
	__inserted_second: function (row, event_data) {
		if (event_data && event_data.dual_insert)
			return;
		if (this.__create_options.auto_replicate == "second" || this.__create_options.auto_replicate == "both")
			this.__first.insert([row, {dual_insert: true}], {});
		this._inserted(row);
	},

	__updated_first: function (row, update, event_data) {
		if (event_data && event_data.dual_update)
			return;
		if (this.__update_options.auto_replicate == "first" || this.__update_options.auto_replicate == "both")
			this.__second.update(row[this.id_key()], [update, {dual_update: true}], {});
		this._updated(row, update);
	},
	
	__updated_second: function (row, update, event_data) {
		if (event_data && event_data.dual_update)
			return;
		if (this.__update_options.auto_replicate == "second" || this.__update_options.auto_replicate == "both")
			this.__first.update(row[this.id_key()], [update, {dual_update: true}], {});
		this._updated(row, update);
	},

	__removed_first: function (id, event_data) {
		if (event_data && event_data.dual_remove)
			return;
		if (this.__remove_options.auto_replicate == "first" || this.__remove_options.auto_replicate == "both")
			this.__second.remove([id, {dual_remove: true}], {});
		this._removed(id);
	},
	
	__removed_second: function (id, event_data) {
		if (event_data && event_data.dual_remove)
			return;
		if (this.__remove_options.auto_replicate == "second" || this.__remove_options.auto_replicate == "both")
			this.__first.remove([id, {dual_remove: true}], {});
		this._removed(id);
	},

	first: function () {
		return this.__first;
	},
	
	second: function () {
		return this.__second;
	},

	_insert: function (data, callbacks) {
		var first = this.__first;
		var second = this.__second;
		if (this.__create_options.start != "first") {
			first = this.__second;
			second = this.__first;
		}
		var strategy = this.__create_options.strategy;
		if (callbacks) {
			if (strategy == "then")
				first.insert([data, {dual_insert: true}], {
					success: function (row) {
						second.insert([row, {dual_insert: true}], callbacks);
					},
					exception: callbacks.exception
				});
			else if (strategy == "or")
				return first.insert([data, {dual_insert: true}], {
					success: callbacks.success,
					exception: function () {
						second.insert([data, {dual_insert: true}], callbacks);
					}
				});
			else
				first.insert([data, {dual_insert: true}], callbacks);
		} else {
			if (strategy == "then")
				return second.insert([first.insert([data, {dual_insert: true}]), {dual_insert: true}]);
			else if (strategy == "or")
				try {
					return first.insert([data, {dual_insert: true}]);
				} catch (e) {
					return second.insert([data, {dual_insert: true}]);
				}
			else
				return first.insert([data, {dual_insert: true}]);
		}
		return true;
	},

	_update: function (id, data, callbacks) {
		var first = this.__first;
		var second = this.__second;
		if (this.__update_options.start != "first") {
			first = this.__second;
			second = this.__first;
		}
		var strategy = this.__update_options.strategy;
		if (callbacks) {
			if (strategy == "then")
				first.update(id, [data, {dual_update: true}], {
					success: function (row) {
						second.update(id, [row, {dual_update: true}], callbacks);
					},
					exception: callbacks.exception
				});
			else if (strategy == "or")
				return first.update(id, [data, {dual_update: true}], {
					success: callbacks.success,
					exception: function () {
						second.update(id, [data, {dual_update: true}], callbacks);
					}
				});
			else
				first.update(id, [data, {dual_update: true}], callbacks);
		} else {
			if (strategy == "then")
				return second.update(id, [first.update(id, [data, {dual_update: true}]), {dual_update: true}]);
			else if (strategy == "or")
				try {
					return first.update(id, [data, {dual_update: true}]);
				} catch (e) {
					return second.update(id, [data, {dual_update: true}]);
				}
			else
				return first.update(id, [data, {dual_update: true}]);
		}
		return true;
	},

	_remove: function (id, callbacks) {
		var first = this.__first;
		var second = this.__second;
		if (this.__remove_options.start != "first") {
			first = this.__second;
			second = this.__first;
		}
		var strategy = this.__remove_options.strategy;
		if (callbacks) {
			if (strategy == "then")
				first.remove([id, {dual_remove: true}], {
					success: function () {
						second.remove([id, {dual_remove: true}], callbacks);
					},
					exception: callbacks.exception
				});
			else if (strategy == "or")
				first.remove([id, {dual_remove: true}], {
					success: callbacks.success,
					exception: function () {
						second.remove([id, {dual_remove: true}], callbacks);
					}
				});
			else
				first.remove(id, callbacks);
		} else {
			if (strategy == "then") {
				first.remove([id, {dual_remove: true}]);
				second.remove([id, {dual_remove: true}]);
			}
			else if (strategy == "or")
				try {
					first.remove([id, {dual_remove: true}]);
				} catch (e) {
					second.remove([id, {dual_remove: true}]);
				}
			else
				first.remove([id, {dual_remove: true}]);
		}
	},

	_query_capabilities: function () {
		return {
			"query": true,
			"sort": true,
			"limit": true,
			"skip": true
		};
	},

	_get: function (id, callbacks) {
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
			var fallback = function (callbacks) {
				second.get(id, BetaJS.SyncAsync.mapSuccess(callbacks, function (result) {
					if (result && clone)
						first.delegate(first.insert, [result], callbacks);
					else
						this.callback(callbacks, "success", result);
				}));
			};
			return first.then(first.get, [id], callbacks, function (result, callbacks) {
				if (!result && or_on_null) {
					fallback(callbacks);
					return;
				}
				if (clone_second) {
					second.get(id, {
						success: function (row) {
							if (row)
								this.callback(callbacks, "success", result);
							else
								second.insert(result, callbacks);
						},
						exception: function () {
							second.insert(result, callbacks);
						}
					});
				} else
					this.callback(callbacks, "success", result);
			}, function (error, callbacks) {
				fallback(callbacks);
			});
		} else
			return first.get(id, callbacks);
	},

	_query: function (query, options, callbacks) {
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
			var fallback = function (callbacks) {
				this.trigger("query_second", query, options);
				second.query(query, options, BetaJS.SyncAsync.mapSuccess(callbacks, function (result) {
					if (result && clone) {
						arr = result.asArray();
						result = new BetaJS.Iterators.ArrayIterator(arr);
						var cb = BetaJS.SyncAsync.mapSuccess(callbacks, function () {
							BetaJS.SyncAsync.callback(callbacks, "success", result);
						});
						first.insert_all(arr, cb, {query: query, options: options}, {dual_insert: true});				
					} else
						BetaJS.SyncAsync.callback(callbacks, "success", result);
				}));
				return result;
			};
			var insert_second = function (result, callbacks) {
				arr = result.asArray();
				result = new BetaJS.Iterators.ArrayIterator(arr);
				var cb = BetaJS.SyncAsync.mapSuccess(callbacks, function () {
					BetaJS.SyncAsync.callback(callbacks, "success", result);
				});
				second.insert_all(arr, cb, {query: query, options: options}, {dual_insert: true});				
			};
			this.trigger("query_first", query, options);
			return this.then(first, first.query, [query, options], callbacks, function (result, callbacks) {
				if (!result && or_on_null) {
					fallback.call(this, callbacks);
					return;
				}
				if (clone_second) {
					this.trigger("query_second", query, options);
					second.query(query, options, {
						success: function (result2) {
							if (result2) 
								this.callback(callbacks, "success", result);
							else
								insert_second(result, callbacks);
						}, exception: function () {
							insert_second(result, callbacks);
						}
					});
				} else {
					this.callback(callbacks, "success", result);
				}
			}, function (error, callbacks) {
				fallback.call(this, callbacks);
			});
		} else {
			this.trigger("query_first", query, options);
			return first.query(query, options, callbacks);
		}
	}

});

BetaJS.Stores.DualStore.extend("BetaJS.Stores.CachedStore", {
	constructor: function (parent, options) {
		options = options || {};
		var cache_store = options.cache_store;
		if (!("cache_store" in options)) {
		    cache_store = this._auto_destroy(new BetaJS.Stores.MemoryStore({
                id_key: parent.id_key()
            }));
        }
        if (!cache_store.query_model())
            cache_store.query_model(options.cache_query_model ? options.cache_query_model : this._auto_destroy(new BetaJS.Queries.DefaultQueryModel()));
        this.__invalidation_options = options.invalidation || {};
		this._inherited(BetaJS.Stores.CachedStore, "constructor",
			parent,
			cache_store,
			BetaJS.Objs.extend({
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
	           var s = BetaJS.Queries.Constrained.serialize(subsumizer);
	           if (!this.__queries[s]) {
	               this.__queries[s] = true;
	               BetaJS.SyncAsync.eventually(function () {
	                   this.invalidate_query(subsumizer, true);	                   
	               }, [], this);
	           }
	       }, this);
           this.cache().on("query_miss", function (query) {
               var s = BetaJS.Queries.Constrained.serialize(query);
               this.__queries[s] = true;
           }, this);
	   }
	},
	
	destroy: function () {
	    this.cache().off(null, null, this);
	    this._inherited(BetaJS.Stores.CachedStore, "destroy");    
	},
	
	invalidate_query: function (query, reload) {
	    this.cache().query_model().invalidate(query);
	    if (reload) {
	        if (this.supportsAsync())
	           this.query(query.query, query.options, {});
	        else
	           this.query(query.query, query.options);
	    }
        this.trigger("invalidate_query", query, reload);
	},
	
	cache: function () {
		return this.second();
	},
	
	store: function () {
		return this.first();
	}
});
BetaJS.Stores.BaseStore.extend("BetaJS.Stores.ConversionStore", {
	
	constructor: function (store, options) {
		options = options || {};
		options.id_key = store._id_key;
		this._inherited(BetaJS.Stores.ConversionStore, "constructor", options);
		this.__store = store;
		this.__key_encoding = options["key_encoding"] || {};
		this.__key_decoding = options["key_decoding"] || {};
		this.__value_encoding = options["value_encoding"] || {};
		this.__value_decoding = options["value_decoding"] || {};
	},
	
	encode_object: function (obj) {
		var result = {};
		for (var key in obj) {
		    var encoded_key = this.encode_key(key);
		    if (encoded_key)
			    result[encoded_key] = this.encode_value(key, obj[key]);
		}
		return result;
	},
	
	decode_object: function (obj) {
		var result = {};
		for (var key in obj) {
		    var decoded_key = this.decode_key(key);
		    if (decoded_key)
			    result[decoded_key] = this.decode_value(key, obj[key]);
	    }
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
	
	_insert: function (data, callbacks) {
		return this.then(this.__store, this.__store.insert, [this.encode_object(data)], callbacks, function (result, callbacks) {
			callbacks.success(this.decode_object(result));
		});
	},
	
	_remove: function (id, callbacks) {
		return this.delegate(this.__store, this.__store.remove, [this.encode_value(this._id_key, id)], callbacks);
	},

	_get: function (id, callbacks) {
		return this.then(this.__store, this.__store.get, [this.encode_value(this._id_key, id)], callbacks, function (result, callbacks) {
			callbacks.success(this.decode_object(result));
		});
	},
	
	_update: function (id, data, callbacks) {
		return this.then(this.__store, this.__store.update, [this.encode_value(this._id_key, id), this.encode_object(data)], callbacks, function (result, callbacks) {
			callbacks.success(this.decode_object(result));
		});
	},
	
	_query: function (query, options, callbacks) {
		return this.then(this.__store, this.__store.query, [this.encode_object(query), options], callbacks, function (result, callbacks) {
			var mapped = new BetaJS.Iterators.MappedIterator(result, function (row) {
				return this.decode_object(row);
			}, this);
			callbacks.success(mapped);
		});
	}		

});

BetaJS.Stores.BaseStore.extend("BetaJS.Stores.PassthroughStore", {
	
	constructor: function (store, options) {
		this.__store = store;
		options = options || {};
		options.id_key = store.id_key();
		this._projection = options.projection || {};
		this._inherited(BetaJS.Stores.PassthroughStore, "constructor", options);
		this._supportsAsync = store.supportsAsync();
		this._supportsSync = store.supportsSync();
        if (options.destroy_store)
            this._auto_destroy(store);
	},
	
	_query_capabilities: function () {
		return this.__store._query_capabilities();
	},

	_insert: function (data, callbacks) {
		return this.__store.insert(BetaJS.Objs.extend(data, this._projection), callbacks);
	},
	
	_remove: function (id, callbacks) {
		return this.__store.remove(id, callbacks);
	},
	
	_get: function (id, callbacks) {
		return this.__store.get(id, callbacks);
	},
	
	_update: function (id, data, callbacks) {
		return this.__store.update(id, data, callbacks);
	},
	
	_query: function (query, options, callbacks) {
		return this.__store.query(BetaJS.Objs.extend(query, this._projection), options, callbacks);
	},
	
	_ensure_index: function (key) {
		return this.__store.ensure_index(key);
	},
	
	_store: function () {
		return this.__store;
	}

});



BetaJS.Stores.PassthroughStore.extend("BetaJS.Stores.ActiveStore", {
	
	constructor: function (store, listener, options) {
		this._inherited(BetaJS.Stores.ActiveStore, "constructor", store, options);
		this.__listener = listener;
		this.delegateEvents(null, listener);
	}
	
});

BetaJS.Stores.BaseStore.extend("BetaJS.Stores.SocketStore", {
	
	constructor: function (options, socket, prefix) {
		this._inherited(BetaJS.Stores.SocketStore, "constructor", options);
		this.__socket = socket;
		this.__prefix = prefix;
		this._supportsAsync = false;
	},
	
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
		this.__send("update", BetaJS.Objs.objectBy(id, data));
	},
	
	bulk: function (commits, optimistic, callbacks) {
		this.__send("bulk", commits);
	}	
	
});


BetaJS.Stores.ListenerStore.extend("BetaJS.Stores.SocketListenerStore", {

	constructor: function (options, socket, prefix) {
		this._inherited(BetaJS.Stores.SocketListenerStore, "constructor", options);
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
				self._perform(BetaJS.Objs.keyByIndex(commits[i]), BetaJS.Objs.valueByIndex(commits[i]));
		});
	},
	
	_perform: function (action, data) {
		if (action == "insert")
			this._inserted(data);
		else if (action == "remove")
			this._removed(data);
		else if (action == "update")
			this._updated(BetaJS.Objs.objectBy(this.id_key(), BetaJS.Objs.keyByIndex(data)), BetaJS.Objs.valueByIndex(data));
		else
			throw new BetaJS.Stores.StoreException("unsupported: perform " + action);
	}

});
BetaJS.Stores.StoreException.extend("BetaJS.Stores.RemoteStoreException", {
	
	constructor: function (source) {
		source = BetaJS.Net.AjaxException.ensure(source);
		this._inherited(BetaJS.Stores.RemoteStoreException, "constructor", source.toString());
		this.__source = source;
	},
	
	source: function () {
		return this.__source;
	}
	
});

BetaJS.Stores.BaseStore.extend("BetaJS.Stores.RemoteStore", {

	constructor : function(uri, ajax, options) {
		this._inherited(BetaJS.Stores.RemoteStore, "constructor", options);
		this._uri = uri;
		this.__ajax = ajax;
		this.__options = BetaJS.Objs.extend({
			"update_method": "PUT",
			"uri_mappings": {},
			"bulk_method": "POST",
			"supports_bulk": false
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
	
	__invoke: function (options, callbacks, parse_json) {
		if (callbacks) {
			return this.__ajax.asyncCall(options, {
				success: function (result) {
					if (parse_json && BetaJS.Types.is_string(result)) {
						try {
							result = JSON.parse(result);
						} catch (e) {}
					}
					BetaJS.SyncAsync.callback(callbacks, "success", result);
				}, exception: function (e) {
					BetaJS.SyncAsync.callback(callbacks, "exception", new BetaJS.Stores.RemoteStoreException(e));					
				}
			});
		} else {
			try {
				var result = this.__ajax.syncCall(options);
				if (parse_json && BetaJS.Types.is_string(result)) {
					try {
						return JSON.parse(result);
					} catch (e) {}
				}
				return result;
			} catch (e) {
				throw new BetaJS.Stores.RemoteStoreException(e); 			
			}
			return false;
		}
	},
	
	_insert : function(data, callbacks) {
		return this.__invoke({
			method: "POST",
			uri: this.prepare_uri("insert", data),
			data: data
		}, callbacks, true);
	},

	_get : function(id, callbacks) {
		var data = {};
		data[this._id_key] = id;
		return this.__invoke({
			uri: this.prepare_uri("get", data)
		}, callbacks);
	},

	_update : function(id, data, callbacks) {
		var copy = BetaJS.Objs.clone(data, 1);
		copy[this._id_key] = id;
		return this.__invoke({
			method: this.__options.update_method,
			uri: this.prepare_uri("update", copy),
			data: data
		}, callbacks);
	},
	
	_remove : function(id, callbacks) {
		var data = {};
		data[this._id_key] = id;
		return this.__invoke({
			method: "DELETE",
			uri: this.prepare_uri("remove", data)
		}, callbacks);
	},

	_query : function(query, options, callbacks) {
		return this.__invoke(this._encode_query(query, options), callbacks, true);
	},
	
	bulk: function (commits, optimistic, callbacks) {
		if (!this.__options["supports_bulk"]) 
			return this._inherited(BetaJS.Stores.RemoteStore, "bulk", commits, optimistic);
		return this.__invoke({
			method: this.__options["bulk_method"],
			uri: this.prepare_uri("bulk"),
			data: commits
		});
	}	
	
});


BetaJS.Stores.RemoteStore.extend("BetaJS.Stores.QueryGetParamsRemoteStore", {

	constructor : function(uri, ajax, capability_params, options) {
		this._inherited(BetaJS.Stores.QueryGetParamsRemoteStore, "constructor", uri, ajax, options);
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

});
BetaJS.Class.extend("BetaJS.Stores.StoresMonitor", [
	BetaJS.Events.EventsMixin,
{
	attach: function (ident, store) {
		store.on("insert", function (row) {
			this.trigger("insert", ident, store, row);
			this.trigger("write", "insert", ident, store, row);
		}, this);
		store.on("remove", function (id) {
			this.trigger("remove", ident, store, id);
			this.trigger("write", "remove", ident, store, id);
		}, this);
		store.on("update", function (row, data) {
			this.trigger("update", ident, store, row, data);
			this.trigger("write", "update", ident, store, row, data);
		}, this);
	}
		
}]);

BetaJS.Class.extend("BetaJS.Stores.StoreHistory", [
	BetaJS.Events.EventsMixin,
	{
	
	constructor: function (store, options) {
		this._inherited(BetaJS.Stores.StoreHistory, "constructor");
		options = options || {};
		this._combine_update_update = options.combine_update_update || false;
		this._combine_insert_update = options.combine_insert_update || false;
		this._combine_insert_remove = options.combine_insert_remove || false;
		this._combine_update_remove = options.combine_update_remove || false;
		this._commits = {};
		this._revision_id = null;
		this._store = store;
		this._item_commits = {};
		this._store.on("insert", function (data) {
			this.__add_commit({action: "insert", id: data[this._store.id_key()], data: data});
		}, this);
		this._store.on("remove", function (id) {
			this.__add_commit({action: "remove", id: id});
		}, this);
		this._store.on("update", function (id, data) {
			this.__add_commit({action: "update", id: id, data: data});
		}, this);
	},
	
	__remove_commit: function (revision_id) {
		this.trigger("remove", this._commits[revision_id]);
		var id = this._commits[revision_id].id;
		delete this._commits[revision_id];
		delete this._item_commits[id];
		if (BetaJS.Objs.is_empty(this._item_commits[id]))
			delete this._item_commits[id];
	},
	
	__add_commit: function (object) {
		object.revision_id = this._new_revision_id();
		var has_insert = false;
		var has_update = false;
		var last_rev_id = null;
		for (var rev_id in this._item_commits[object.id]) {
			var obj = this._commits[rev_id];
			has_insert = has_insert || obj.action == "insert";
			has_update = has_update || obj.action == "update";
			last_rev_id = rev_id;
		}	
		this._revision_id = object.revision_id;
		this._commits[this._revision_id] = object;
		this._item_commits[object.id] = this._item_commits[object.id] || {};
		this._item_commits[object.id][object.revision_id] = true;
		this.trigger("commit", object);
		if (object.action == "update") {
			if ((this._combine_insert_update && !has_update && has_insert) || (this._combine_update_update && has_update)) {
				this.__remove_commit(object.revision_id);
				this._commits[last_rev_id].data = BetaJS.Objs.extend(this._commits[last_rev_id].data, object.data);
			}
		} else if (object.action == "remove") {
			for (rev_id in this._item_commits[object.id]) {
				obj = this._commits[rev_id];
				if ((has_insert && this._combine_insert_remove) || (obj.action == "update" && this._combine_update_remove))
					this.__remove_commit(rev_id);
			}
		}
	},
	
	flush: function (revision_id) {
		revision_id = revision_id || this._revision_id;
		for (var id in this._commits) {
			if (id > revision_id)
				break;
			this.__remove_commit(id);
		}
	},
	
	serialize: function (revision_id) {
		var commit = this._commits[revision_id];
		if (commin.action == "insert")
			return {
				"insert": commit.data
			};
		else if (commit.action == "remove")
			return {
				"remove": commit.id
			};
		else if (commit == "update")
			return {
				"update": BetaJS.Objs.objectBy(commit.id, commit.data) 
			};
		return null;
	},
	
	serialize_bulk: function (revision_id) {
		revision_id = revision_id || this._revision_id;
		var result = [];
		for (var id in this._commits) {
			if (id > revision_id)
				break;
			result.push(this.serialize(id));
		}
		return result;
	},
	
	revision_id: function () {
		return this._revision_id;
	},
	
	_new_revision_id: function () {
		return this.cls.__revision_id + 1;
	}
	
}], {
	
	__revision_id: 0
	
});
BetaJS.Exceptions.Exception.extend("BetaJS.Modelling.ModelException", {
	
	constructor: function (model, message) {
		this._inherited(BetaJS.Modelling.ModelException, "constructor", message);
		this.__model = model;
	},
	
	model: function () {
		return this.__model;
	}
	
});


BetaJS.Modelling.ModelException.extend("BetaJS.Modelling.ModelMissingIdException", {
	
	constructor: function (model) {
		this._inherited(BetaJS.Modelling.ModelMissingIdException, "constructor", model, "No id given.");
	}

});


BetaJS.Modelling.ModelException.extend("BetaJS.Modelling.ModelInvalidException", {
	
	constructor: function (model) {
		var message = BetaJS.Objs.values(model.errors()).join("\n");
		this._inherited(BetaJS.Modelling.ModelInvalidException, "constructor", model, message);
	}

});

BetaJS.Properties.Properties.extend("BetaJS.Modelling.SchemedProperties", {
	
	constructor: function (attributes, options) {
		this._inherited(BetaJS.Modelling.SchemedProperties, "constructor");
		var scheme = this.cls.scheme();
		this._properties_changed = {};
		this.__errors = {};
		this.__unvalidated = {};
		for (var key in scheme) {
			if ("def" in scheme[key]) 
				this.set(key, scheme[key].def);
			else if (scheme[key].auto_create)
				this.set(key, scheme[key].auto_create(this));
			else
				this.set(key, null);
		}
		options = options || {};
		this._properties_changed = {};
		this.__errors = {};
		//this.__unvalidated = {};
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
		if (sch.type == "boolean")
			return BetaJS.Types.parseBool(value);
		if (sch.transform)
			value = sch.transform.apply(this, [value]);
		return value;
	},
	
	_afterSet: function (key, value) {
		var scheme = this.cls.scheme();
		if (!(key in scheme))
			return;
		this._properties_changed[key] = value;
		this.__unvalidated[key] = true;
		delete this.__errors[key];
		if (scheme[key].after_set) {
			var f = BetaJS.Types.is_string(scheme[key].after_set) ? this[scheme[key].after_set] : scheme[key].after_set;
			f.apply(this, [value]);
		}
	},

	properties_changed: function (filter_valid) {
		if (!BetaJS.Types.is_boolean(filter_valid))
			return this._properties_changed;
		return BetaJS.Objs.filter(this._properties_changed, function (value, key) {
			return this.validateAttr(key) == filter_valid;
		}, this);
	},
	
	get_all_properties: function () {
		var result = {};
		var scheme = this.cls.scheme();
		for (var key in scheme)
			result[key] = this.get(key);
		return result;
	},
	
	properties_by: function (filter_valid) {
		if (!BetaJS.Types.is_boolean(filter_valid))
			return this.get_all_properties();
		return BetaJS.Objs.filter(this.get_all_properties(), function (value, key) {
			return this.validateAttr(key) == filter_valid;
		}, this);
	},
	
	validate: function () {
		this.trigger("validate");
		for (var key in this.__unvalidated)
			this.validateAttr(key);
		this._customValidate();
		return BetaJS.Types.is_empty(this.__errors);
	},
	
	_customValidate: function () {},
	
	validateAttr: function (attr) {
		if (attr in this.__unvalidated) {
			delete this.__unvalidated[attr];
			delete this.__errors[attr];
			var scheme = this.cls.scheme();
			var entry = scheme[attr];
			if ("validate" in entry) {
				var validate = entry["validate"];
				if (!BetaJS.Types.is_array(validate))
					validate = [validate];
				var value = this.get(attr);
				BetaJS.Objs.iter(validate, function (validator) {
					var result = validator.validate(value, this);
					if (result)
						this.__errors[attr] = result;
					return result === null;
				}, this);
			}
			this.trigger("validate:" + attr, !(attr in this.__errors), this.__errors[attr]);
		}
		return !(attr in this.__errors);
	},
	
	setError: function (attr, error) {
		delete this.__unvalidated[attr];
		this.__errors[attr] = error;
		this.trigger("validate:" + attr, !(attr in this.__errors), this.__errors[attr]);
	},
	
	revalidate: function () {
		this.__errors = {};
		this.__unvalidated = this.keys(true);
		return this.validate();
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
				BetaJS.Objs.iter(target, function (value) {
					tarobj[value] = true;
				});
				var success = true;
				BetaJS.Objs.iter(tags, function (x) {
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
				BetaJS.Objs.iter(target, function (value) {
					tarobj[value] = true;
				});
				var success = true;
				BetaJS.Objs.iter(tags, function (x) {
					success = success && x in tarobj;
				}, this);
				if (success)
					this.set(key, data[key]);
			}
		}
	},
	
	validation_exception_conversion: function (e) {
		var source = e;
		if (e.instance_of(BetaJS.Stores.RemoteStoreException))
			source = e.source();
		else if (!("status_code" in source && "data" in source))
			return e;
		if (source.status_code() == BetaJS.Net.HttpHeader.HTTP_STATUS_PRECONDITION_FAILED && source.data()) {
			BetaJS.Objs.iter(source.data(), function (value, key) {
				this.setError(key, value);
			}, this);
			e = new BetaJS.Modelling.ModelInvalidException(model);
		}
		return e;		
	}
	
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
			if (!BetaJS.Types.is_defined(scheme[key].persistent) || scheme[key].persistent)
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



BetaJS.Modelling.SchemedProperties.extend("BetaJS.Modelling.AssociatedProperties", {
	
	constructor: function (attributes, options) {
		this._inherited(BetaJS.Modelling.AssociatedProperties, "constructor", attributes, options);
		this.assocs = this._initializeAssociations();
		for (var key in this.assocs)
			this.__addAssoc(key, this.assocs[key]);
		this.on("change:" + this.cls.primary_key(), function (new_id, old_id) {
			this._change_id(new_id, old_id);
			this.trigger("change_id", new_id, old_id);
		}, this);
	},
	
	_change_id: function (new_id, old_id) {
	},

	__addAssoc: function (key, obj) {
		this[key] = function () {
			return obj.yield();
		};
	},
	
	_initializeAssociations: function () {
		return {};
	},
	
	destroy: function () {
		for (var key in this.assocs)
			this.assocs[key].destroy();
		this._inherited(BetaJS.Modelling.AssociatedProperties, "destroy");
	},

	id: function () {
		return this.get(this.cls.primary_key());
	},
	
	hasId: function () {
		return this.has(this.cls.primary_key());
	}
	
}, {

	primary_key: function () {
		return "id";
	},
	
	_initializeScheme: function () {
		var s = this._inherited(BetaJS.Modelling.AssociatedProperties, "_initializeScheme");
		s[this.primary_key()] = {
			type: "id"
		};
		return s;
	}

});
BetaJS.Modelling.AssociatedProperties.extend("BetaJS.Modelling.Model", [
	BetaJS.SyncAsync.SyncAsyncMixin,
	{
	
	constructor: function (attributes, options) {
		options = options || {};
		this._inherited(BetaJS.Modelling.Model, "constructor", attributes, options);
		this.__saved = "saved" in options ? options["saved"] : false;
		this.__new = "new" in options ? options["new"] : true;
		this.__removed = false;
		if (this.__saved)
			this._properties_changed = {};
		this.__table = options["table"] || this.cls.defaultTable();
		this.__table._model_register(this);
		this.__destroying = false;
		this._supportsAsync = this.__table.supportsAsync();
		this._supportsSync = this.__table.supportsSync();
	},
	
	destroy: function () {
		if (this.__destroying || !this.__table)
			return;
		this.__destroying = true;
		this.__table._model_unregister(this);
		this.trigger("destroy");
		this._inherited(BetaJS.Modelling.Model, "destroy");
	},

	isSaved: function () {
		return this.__saved;
	},
	
	isNew: function () {
		return this.__new;
	},
	
	isRemoved: function () {
		return this.__removed;
	},

	update: function (data, options, callbacks) {
		this.setAll(data, {silent: true});
		this.save(callbacks);
	},

	_afterSet: function (key, value, old_value, options) {
		this._inherited(BetaJS.Modelling.Model, "_afterSet", key, value, old_value, options);
		var scheme = this.cls.scheme();
		if (!(key in scheme))
			return;
		if (options && options.no_change)
			this._unsetChanged(key);
		else
			this.__saved = false;
		if (options && options.silent)
			return;
		if (this.__table)
			this.__table._model_set_value(this, key, value, options);
	},
	
	_after_create: function () {
	},
	
	_before_create: function () {
	},
	
	save: function (callbacks) {
		if (this.__new)
			this._before_create();
		return this.then(this.__table, this.__table._model_save, [this], callbacks, function (result, callbacks) {
			this.trigger("save");
			this.__saved = true;
			var was_new = this.__new;
			this.__new = false;
			if (was_new)
				this._after_create();
			this.callback(callbacks, "success", result);
		});
	},
	
	remove: function (callbacks) {
		return this.then(this.__table, this.__table._model_remove, [this], callbacks, function (result, callbacks) {
			this.trigger("remove");		
			this.__removed = true;
			this.callback(callbacks, "success", result);
		});
	},
	
	table: function () {
		return this.__table;
	}
	
}], {
	
	defaultTable: function () {
		if (!this.table)
			this.table = new BetaJS.Modelling.Table(new BetaJS.Stores.MemoryStore(), this);
		return this.table;
	}
	
});
BetaJS.Class.extend("BetaJS.Modelling.Table", [
	BetaJS.Events.EventsMixin,
	BetaJS.SyncAsync.SyncAsyncMixin,
	{

	constructor: function (store, model_type, options) {
		this._inherited(BetaJS.Modelling.Table, "constructor");
		this.__store = store;
		this.__model_type = model_type;
		this.__models_by_id = {};
		this.__models_changed = {};
		this.__options = BetaJS.Objs.extend({
			// Cache Size
			model_cache_size: null,
			// Attribute that describes the type
			type_column: null,
			// Creation options
			auto_create: false,
			// Validation options
			store_validation_conversion: true,
			// Update options
			auto_update: true,
			// Include new inserts automagically
			auto_materialize: false
		}, options || {});
		this.__models_by_cid = new BetaJS.Classes.ObjectCache({ size: this.__options.model_cache_size });
		this._auto_destroy(this.__models_by_cid);
		this.__models_by_cid.on("release", function (model) {
			if (model.hasId())
				delete this.__models_by_id[model.id()];
		}, this);
		if (this.__options.auto_materialize) {
			this.__store.on("insert", function (obj, event_data) {
				if (this.__models_by_id[obj[this.primary_key()]] || (event_data && event_data.model_create))
					return;
				var model = this.__materialize(obj);
				this.trigger("create", model);				
			}, this);
		}
		this.__store.on("update", function (row, data, event_data) {
			if (!this.__models_by_id[row[this.primary_key()]] || (event_data && event_data.model_update))
				return;
			var model = this.__models_by_id[row[this.primary_key()]];
			model.setAll(data, {silent: true});
			this.trigger("update", model);
		}, this);
		this.__store.on("remove", function (id, event_data) {
			if (!this.__models_by_id[id] || (event_data && event_data.model_remove))
				return;
			var model = this.__models_by_id[id];
			this.trigger("remove", model);
			model.destroy();
		}, this);
		this._supportsAsync = true;
		this._supportsSync = store.supportsSync();
	},
	
	_model_register: function (model) {
		if (this.hasModel(model))
			return;
		this.trigger("register", model);
		this.__models_by_cid.add(model);
		if (model.hasId())
			this.__models_by_id[model.id()] = model;
		if (model.isNew() && this.__options.auto_create)
			this._model_create(model);
	},
	
	_model_unregister: function (model) {
		if (!this.hasModel(model))
			return;
		model.save();
		this.__models_by_cid.remove(model);
		if (model.hasId())
			delete this.__models_by_id[model.id()];
		this.trigger("unregister", model);
	},
	
	hasModel: function (model) {
		return this.__models_by_cid.get(model) !== null;
	},

	_model_remove: function (model, callbacks) {
		if (!this.hasModel(model))
			return false;
		return this.then(this.__store, this.__store.remove, [[model.id(), {model_remove: true}]], callbacks, function (result, callbacks) {
			this.trigger("remove", model);
			model.destroy();
			this.callback(callbacks, "success", true);
		}, function (error, callbacks) {
			this.callback(callbacks, "exception", error);
		});
	},

	_model_save: function (model, callbacks) {
		return model.isNew() ? this._model_create(model, callbacks) : this._model_update(model, callbacks);
	},
	
	__exception_conversion: function (model, e) {
		return this.__options.store_validation_conversion ? model.validation_exception_conversion(e) : e;
	},
	
	_model_create: function (model, callbacks) {
		if (!this.hasModel(model) || !model.isNew())
			return false;
		if (!model.validate()) {
		 	var e = new BetaJS.Modelling.ModelInvalidException(model);
		 	if (callbacks)
		 		this.callback(callbacks, "exception", e);
		 	else
		 		throw e;
		}
		var attrs = BetaJS.Scopes.resolve(this.__model_type).filterPersistent(model.get_all_properties());
		if (this.__options.type_column)
			attrs[this.__options.type_column] = model.cls.classname;
		return this.then(this.__store, this.__store.insert, [[attrs, {model_create: true}]], callbacks, function (confirmed, callbacks) {
			if (!(model.cls.primary_key() in confirmed))
				return this.callback(callbacks, "exception", new BetaJS.Modelling.ModelMissingIdException(model));
			this.__models_by_id[confirmed[model.cls.primary_key()]] = model;
			model.setAll(confirmed, {no_change: true, silent: true});
			delete this.__models_changed[model.cid()];
			this.trigger("create", model);
			this.trigger("save", model);
			this.callback(callbacks, "success", model);
			return true;		
		}, function (e, callbacks) {
			e = BetaJS.Exceptions.ensure(e);
			e = this.__exception_conversion(model, e);
			this.callback(callbacks, "exception", e);
		});
	},

	_model_update: function (model, callbacks) {
		if (!this.hasModel(model) || model.isNew())
			return false;
		if (!model.validate()) {
		 	var e = new BetaJS.Modelling.ModelInvalidException(model);
		 	if (callbacks)
		 		this.callback(callbacks, "exception", e);
		 	else
		 		throw e;
		}
		var attrs = BetaJS.Scopes.resolve(this.__model_type).filterPersistent(model.properties_changed());
		if (BetaJS.Types.is_empty(attrs)) {
			if (callbacks)
				this.callback(callbacks, "success", attrs);
			return attrs;
		}
		return this.then(this.__store, this.__store.update, [model.id(), [attrs, {model_update: true}]], callbacks, function (confirmed, callbacks) {
			model.setAll(confirmed, {no_change: true, silent: true});
			delete this.__models_changed[model.cid()];
			this.trigger("update", model);
			this.trigger("save", model);
			this.callback(callbacks, "success", confirmed);
			return confirmed;		
		}, function (e, callbacks) {
			e = BetaJS.Exceptions.ensure(e);
			e = this.__exception_conversion(model, e);
			this.callback(callbacks, "exception", e);
			return false;
		});
	},

	_model_set_value: function (model, key, value, callbacks) {
		this.__models_changed[model.cid()] = model;
		this.trigger("change", model, key, value);
		this.trigger("change:" + key, model, value);
		if (this.__options.auto_update)
			return model.save(callbacks);
	},
	
	save: function (callbacks) {
		if (callbacks) {
			var promises = [];
			BetaJS.Objs.iter(this.__models_changed, function (obj) {
				promises.push(obj.promise(obj.save));
			}, this);
			return this.join(promises, callbacks);
		} else {
			var result = true;
			BetaJS.Objs.iter(this.__models_changed, function (obj, id) {
				result = obj.save() && result;
			});
			return result;
		}
	},
	
	primary_key: function () {
		return BetaJS.Scopes.resolve(this.__model_type).primary_key();
	},
	
	__materialize: function (obj) {
		if (!obj)
			return null;
		var type = this.__model_type;
		if (this.__options.type_column && obj[this.__options.type_column])
			type = obj[this.__options.type_column];
		var cls = BetaJS.Scopes.resolve(type);
		if (this.__models_by_id[obj[this.primary_key()]])
			return this.__models_by_id[obj[this.primary_key()]];
		var model = new cls(obj, {
			table: this,
			saved: true,
			"new": false
		});
		return model;
	},
	
	findById: function (id, callbacks) {
		if (this.__models_by_id[id]) {
			if (callbacks)
				this.callback(callbacks, "success", this.__models_by_id[id]);
			return this.__models_by_id[id];
		} else
			return this.then(this.__store, this.__store.get, [id], callbacks, function (attrs, callbacks) {
				this.callback(callbacks, "success", this.__materialize(this.__store.get(id)));
			});
	},

	findBy: function (query, callbacks) {
		return this.then(this, this.allBy, [query, {limit: 1}], callbacks, function (iterator, callbacks) {
			this.callback(callbacks, "success", iterator.next());
		});
	},

	all: function (options, callbacks) {
		return this.allBy({}, options, callbacks);
	},
	
	allBy: function (query, options, callbacks) {
		var self = this;
		return this.__store.then(this.__store.query, [query, options], callbacks, function (iterator, callbacks) {
			var mapped_iterator = new BetaJS.Iterators.MappedIterator(iterator, function (obj) {
				return this.__materialize(obj);
			}, self);
			self.callback(callbacks, "success", mapped_iterator);
		});
	},
	
	query: function () {
		// Alias
		return this.allBy.apply(this, arguments);
	},
	/*
	active_query_engine: function () {
		if (!this._active_query_engine) {
			var self = this;
			this._active_query_engine = new BetaJS.Queries.ActiveQueryEngine();
			this._active_query_engine._query = function (query, callbacks) {
				return self.allBy(query.query || {}, query.options || {}, callbacks);
			};
			this.on("create", function (object) {
				this._active_query_engine.insert(object);
			});
			this.on("remove", function (object) {
				this._active_query_engine.remove(object);
			});
			this.on("change", function (object) {
				this._active_query_engine.update(object);
			});
		}
		return this._active_query_engine;
	},
	*/
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
	}
	
}]);
BetaJS.Class.extend("BetaJS.Modelling.Associations.Association", [
	BetaJS.SyncAsync.SyncAsyncMixin,
	{

	constructor: function (model, options) {
		this._inherited(BetaJS.Modelling.Associations.Association, "constructor");
		this._model = model;
		this._options = options || {};
		this.__cache = null;
		if (options["delete_cascade"])
			model.on("remove", function () {
				this.__delete_cascade();
			}, this);
		if (!options["ignore_change_id"])
			model.on("change_id", function (new_id, old_id) {
				this._change_id(new_id, old_id);
			}, this);
	},
	
	_change_id: function () {},
	
	__delete_cascade: function () {
		this.yield({
			success: function (iter) {
				iter = BetaJS.Iterators.ensure(iter).toArray();
				var promises = [];
				while (iter.hasNext()) {
					var obj = iter.next();
					promises.push(obj.promise(obj.remove));
				}
				this.join(promises, {success: function () {}});
			}
		});
	},
	
	yield: function (callbacks) {
		if (this._options["cached"])
			return this.eitherFactory("__cache", callbacks, this._yield, this._yield);
		else
			return this._yield(callbacks);
	},
	
	invalidate: function () {
		delete this["__cache"];
	}

}]);
BetaJS.Modelling.Associations.Association.extend("BetaJS.Modelling.Associations.TableAssociation", {

	constructor: function (model, foreign_table, foreign_key, options) {
		this._inherited(BetaJS.Modelling.Associations.TableAssociation, "constructor", model, options);
		this._foreign_table = foreign_table;
		this._foreign_key = foreign_key;
		// TODO: Active Query would be better
		if (options["primary_key"])
			this._primary_key = options.primary_key;
		if (this._options["cached"]) 
			this._foreign_table.on("create update remove", function () {
				this.invalidate();
			}, this);
	},
	
	destroy: function () {
		this._foreign_table.off(null, null, this);
		this._inherited(BetaJS.Modelling.Associations.TableAssociation, "destroy");
	}
	
});
BetaJS.Modelling.Associations.TableAssociation.extend("BetaJS.Modelling.Associations.HasManyAssociation", {

	_id: function () {
		return this._primary_key ? this._model.get(this._primary_key) : this._model.id();
	},

	_yield: function (callbacks) {
		return this.allBy({}, callbacks);
	},

	yield: function (callbacks) {
		if (!this._options["cached"])
			return this._yield(callbacks);
		if (this.__cache) {
			var iter = new BetaJS.Iterators.ArrayIterator(this.__cache);
			if (callbacks)
				this.callback(callbacks, "success", iter);
			return iter;
		} else {
			return this.then(this._yield, callbacks, function (result, callbacks) {
				this.__cache = result.asArray();
				BetaJS.Objs.iter(this.__cache, function (model) {
					model.on("destroy", function () {
						this.invalidate();
					}, this);
				}, this);
				this.callback(callbacks, "success", new BetaJS.Iterators.ArrayIterator(this.__cache));
			});
		}
	},
	
	invalidate: function () {
		BetaJS.Objs.iter(this.__cache, function (model) {
			model.off(null, null, this);
		}, this);
		this._inherited(BetaJS.Modelling.Associations.HasManyAssociation, "invalidate");
	},

	findBy: function (query, callbacks) {
		query[this._foreign_key] = this._id();
		return this._foreign_table.findBy(query, callbacks);
	},

	allBy: function (query, callbacks, id) {
		query[this._foreign_key] = id ? id : this._id();
		return this._foreign_table.allBy(query, {}, callbacks);
	},

	_change_id: function (new_id, old_id) {
		this.allBy({}, {
			content: this,
			success: function (objects) {
				while (objects.hasNext()) {
					var object = objects.next();
					object.set(this._foreign_key, new_id);
					object.save();
				}
			}
		}, old_id);
	}

});
BetaJS.Modelling.Associations.HasManyAssociation.extend("BetaJS.Modelling.Associations.HasManyThroughArrayAssociation", {

	_yield: function (callbacks) {
		if (callbacks) {
			var promises = [];		
			BetaJS.Objs.iter(this._model.get(this._foreign_key), function (id) {
				promises.push(this._foreign_table.promise(this._foreign_table.findById, [id]));
			}, this);
			return this.join(promises, BetaJS.SyncAsync.mapSuccess(callbacks, function (result) {
				this.callback(callbacks, "success", BetaJS.Objs.filter(result, function (item) {
					return !!item;
				}));
			}));
		} else {
			var result = [];		
			BetaJS.Objs.iter(this._model.get(this._foreign_key), function (id) {
				var item = this._foreign_table.findById(id);
				if (item)
					result.push(item);
			}, this);
			return result;
		}
	},

	yield: function (callbacks) {
		if (!this._options["cached"])
			return new BetaJS.Iterators.ArrayIterator(this._yield(callbacks));
		if (this.__cache) {
			var iter = new BetaJS.Iterators.ArrayIterator(this.__cache);
			if (callbacks)
				this.callback(callbacks, "success", iter);
			return iter;
		} else {
			return this.then(this._yield, callbacks, function (result, callbacks) {
				this.__cache = result;
				BetaJS.Objs.iter(this.__cache, function (model) {
					model.on("destroy", function () {
						this.invalidate();
					}, this);
				}, this);
				this.callback(callbacks, "success", new BetaJS.Iterators.ArrayIterator(this.__cache));
			});
		}
	}

});
BetaJS.Modelling.Associations.TableAssociation.extend("BetaJS.Modelling.Associations.HasOneAssociation", {

	_yield: function (callbacks, id) {
		var query = {};
		if (id)
			query[this._foreign_key] = id;
		else if (this._primary_key) 
			query[this._foreign_key] = this._model.get(this._primary_key);
		else
			query[this._foreign_key] = this._model.id();
		return this.then(this._foreign_table, this._foreign_table.findBy, [query], callbacks, function (model, callbacks) {
			if (model)
				model.on("destroy", function () {
					this.invalidate();
				}, this);
			this.callback(callbacks, "success", model);
		});
	},
	
	_change_id: function (new_id, old_id) {
		this._yield({
			context: this,
			success: function (object) {
				if (object) {
					object.set(this._foreign_key, new_id);
					object.save();
				}
			}
		}, old_id);
	}

});
BetaJS.Modelling.Associations.TableAssociation.extend("BetaJS.Modelling.Associations.BelongsToAssociation", {
	
	_yield: function (callbacks) {
		var success = function (model, callbacks) {
			if (model)
				model.on("destroy", function () {
					this.invalidate();
				}, this);
			this.callback(callbacks, "success", model);
		};
		if (!this._primary_key)
			return this.then(this._foreign_table, this._foreign_table.findById, [this._model.get(this._foreign_key)], callbacks, success);
		var obj = {};
		obj[this._primary_key] = this._model.get(this._foreign_key);
		return this.then(this._foreign_table, this._foreign_table.findBy, [obj], callbacks, success);
	}
	
});
BetaJS.Modelling.Associations.Association.extend("BetaJS.Modelling.Associations.ConditionalAssociation", {

	constructor: function (model, options) {
		this._inherited(BetaJS.Modelling.Associations.ConditionalAssociation, "constructor");
		this._model = model;
		this._options = options || {};
		this.__cache = null;
		if (options["delete_cascade"])
			model.on("remove", function () {
				this.__delete_cascade();
			}, this);
		if (!options["ignore_change_id"])
			model.on("change_id", function (new_id, old_id) {
				this._change_id(new_id, old_id);
			}, this);
	},
	
	_yield: function (callbacks) {
		return this._model.assocs[this._options.conditional(this._model)].yield(callbacks);
	}

});
BetaJS.Modelling.Associations.Association.extend("BetaJS.Modelling.Associations.PolymorphicHasOneAssociation", {

	constructor: function (model, foreign_table_key, foreign_key, options) {
		this._inherited(BetaJS.Modelling.Associations.PolymorphicHasOneAssociation, "constructor", model, options);
		this._foreign_table_key = foreign_table_key;
		this._foreign_key = foreign_key;
		if (options["primary_key"])
			this._primary_key = options.primary_key;
	},

	_yield: function (callbacks, id) {
		var query = {};
		if (id)
			query[this._foreign_key] = id;
		else if (this._primary_key) 
			query[this._foreign_key] = this._model.get(this._primary_key);
		else
			query[this._foreign_key] = this._model.id();
		var foreign_table = BetaJS.Scopes.resolve(this._model.get(this._foreign_table_key));
		return this.then(foreign_table, foreign_table.findBy, [query], callbacks, function (model, callbacks) {
			if (model)
				model.on("destroy", function () {
					this.invalidate();
				}, this);
			this.callback(callbacks, "success", model);
		});
	},
	
	_change_id: function (new_id, old_id) {
		this._yield({
			success: function (object) {
				if (object) {
					object.set(this._foreign_key, new_id);
					object.save();
				}
			}
		}, old_id);
	}

});
BetaJS.Class.extend("BetaJS.Modelling.Validators.Validator", {
	
	validate: function (value, context) {
		return null;
	}

});
BetaJS.Modelling.Validators.Validator.extend("BetaJS.Modelling.Validators.PresentValidator", {
	
	constructor: function (error_string) {
		this._inherited(BetaJS.Modelling.Validators.PresentValidator, "constructor");
		this.__error_string = error_string ? error_string : "Field is required";
	},

	validate: function (value, context) {
		return BetaJS.Types.is_null(value) || value === "" ? this.__error_string : null;
	}

});
BetaJS.Modelling.Validators.Validator.extend("BetaJS.Modelling.Validators.EmailValidator", {
	
	constructor: function (error_string) {
		this._inherited(BetaJS.Modelling.Validators.EmailValidator, "constructor");
		this.__error_string = error_string ? error_string : "Not a valid email address";
	},

	validate: function (value, context) {
		return BetaJS.Strings.is_email_address(value) ? null : this.__error_string;
	}

});
BetaJS.Modelling.Validators.Validator.extend("BetaJS.Modelling.Validators.LengthValidator", {
	
	constructor: function (options) {
		this._inherited(BetaJS.Modelling.Validators.LengthValidator, "constructor");
		this.__min_length = BetaJS.Types.is_defined(options.min_length) ? options.min_length : null;
		this.__max_length = BetaJS.Types.is_defined(options.max_length) ? options.max_length : null;
		this.__error_string = BetaJS.Types.is_defined(options.error_string) ? options.error_string : null;
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

});
BetaJS.Modelling.Validators.Validator.extend("BetaJS.Modelling.Validators.UniqueValidator", {
	
	constructor: function (key, error_string) {
		this._inherited(BetaJS.Modelling.Validators.UniqueValidator, "constructor");
		this.__key = key;
		this.__error_string = error_string ? error_string : "Key already present";
	},

	validate: function (value, context) {
		var query = {};
		query[this.__key] = value;
		var item = context.table().findBy(query);
		return (!item || (!context.isNew() && context.id() == item.id())) ? null : this.__error_string;
	}

});
BetaJS.Modelling.Validators.Validator.extend("BetaJS.Modelling.Validators.ConditionalValidator", {
	
	constructor: function (condition, validator) {
		this._inherited(BetaJS.Modelling.Validators.ConditionalValidator, "constructor");
		this.__condition = condition;
		this.__validator = BetaJS.Types.is_array(validator) ? validator : [validator];
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

});