/*!
betajs-data - v1.0.0 - 2014-12-09
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
	 * condition :== $in: simples | $gt: simple | $lt: simple | $gte: simple | $le: simple | $sw: simple | $gtic: simple | $ltic: simple | $geic: simple | $leic: simple | $swic: simple | $ct: simple | $ctic: simple
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
		BetaJS.Objs.iter(arr, function (query) {
			if (this.__evaluate_query(query, object)) {
				result = true;
				return false;
			}
		}, this);
		return result;
	},
	
	__evaluate_and: function (arr, object) {
		var result = true;
		BetaJS.Objs.iter(arr, function (query) {
			if (!this.__evaluate_query(query, object)) {
				result = false;
				return false;
			}
		}, this);
		return result;
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
	
	emulate: function (constrained_query, query_capabilities, query_function, query_context) {
		var query = constrained_query.query || {};
		var options = constrained_query.options || {};
		var execute_query = {};
		var execute_options = {};
		if ("sort" in options && "sort" in query_capabilities)
			execute_options.sort = options.sort;
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
		return query_function.call(query_context || this, execute_query, execute_options).mapSuccess(function (raw) {
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
			return iter;
		});
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
		this._inherited(BetaJS.Queries.StoreQueryModel, "_insert", query);
		this.__store.insert(query);
	},
	
	_remove: function (query) {
		delete this.__queries[BetaJS.Queries.Constrained.serialize(query)];
		this.__store.query({query: query}).success(function (result) {
			while (result.hasNext())
				this.__store.remove(result.next().id);
		}, this);
	}

});

BetaJS.Collections.Collection.extend("BetaJS.Collections.QueryCollection", {
	
	constructor: function (source, query, options) {
		this._source = source;
		this._inherited(BetaJS.Collections.QueryCollection, "constructor", options);
		this._options = BetaJS.Objs.extend({
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
		this._query = BetaJS.Objs.extend({
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
		if (this._query.options.sort && !BetaJS.Types.is_empty(this._query.options.sort))
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
				return BetaJS.Promise.create(true);
		}
	},
	
	increase_forwards: function (steps) {
		steps = !steps ? this._options.forward_steps : steps;
		if (!steps || this._query.options.limit === null)
			return BetaJS.Promise.create(true);
		return this.__execute_query(this._query.options.skip + this._query.options.limit, steps, false);
	},
	
	increase_backwards: function (steps) {
		steps = !steps ? this._options.backward_steps : steps;
		if (steps && this._query.options.skip > 0) {
			steps = Math.min(steps, this._query.options.skip);
			return this.__execute_query(this._query.options.skip - steps, steps, false);
		} else
			return BetaJS.Promise.create(true);
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
			return BetaJS.Promise.create(true);
		var paginate_count = this.paginate_count();
		if (!paginate_count || paginate_index < this.paginate_count() - 1)
			return this.paginate(paginate_index + 1);
		return BetaJS.Promise.create(true);
	},
	
	prev: function () {
		var paginate_index = this.paginate_index();
		if (!paginate_index)
			return BetaJS.Promise.create(true);
		if (paginate_index > 0)
			this.paginate(paginate_index - 1);
		return BetaJS.Promise.create(true);
	},
	
	isComplete: function () {
		return this._count !== null;
	}
	
});



BetaJS.Collections.QueryCollection.extend("BetaJS.Collections.ActiveQueryCollection", {
	
	constructor: function (source, query, options) {
		this._inherited(BetaJS.Collections.ActiveQueryCollection, "constructor", source, query, options);
		source.on("create", this.__active_create, this);
		source.on("remove", this.__active_remove, this);
		source.on("update", this.__active_update, this);
	},
	
	destroy: function () {
		this._source.off(null, null, this);
		this._inherited(BetaJS.Collections.ActiveQueryCollection, "destroy");
	},
	
	get_ident: function (obj) {
		return obj.id();
	},
	
	is_valid: function (data) {
		return BetaJS.Queries.evaluate(this.query().query, data);
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
		var merged = BetaJS.Objs.extend(row, data);
		if (!object)
			this.__active_create(merged, this._source.materializer(merged));
		else if (!this.is_valid(merged))
			this.__active_remove(id);
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



BetaJS.Stores.BaseStore = BetaJS.Stores.ListenerStore.extend("BetaJS.Stores.BaseStore", {
		
	constructor: function (options) {
		this._inherited(BetaJS.Stores.BaseStore, "constructor", options);
		options = options || {};
		this._id_key = options.id_key || "id";
		this._create_ids = options.create_ids || false;
		if (this._create_ids)
			this._id_generator = options.id_generator || this._auto_destroy(new BetaJS.Classes.TimedIdGenerator());
		this._query_model = "query_model" in options ? options.query_model : null;
	},
	
    query_model: function () {
        if (arguments.length > 0)
            this._query_model = arguments[0];
        return this._query_model;
    },
    
	_insert: function (data) {
		return BetaJS.Promise.create(null, new BetaJS.Stores.StoreException("unsupported: insert"));
	},
	
	_remove: function (id) {
		return BetaJS.Promise.create(null, new BetaJS.Stores.StoreException("unsupported: remove"));
	},
	
	_get: function (id) {
		return BetaJS.Promise.create(null, new BetaJS.Stores.StoreException("unsupported: get"));
	},
	
	_update: function (id, data) {
		return BetaJS.Promise.create(null, new BetaJS.Stores.StoreException("unsupported: update"));
	},
	
	_query_capabilities: function () {
		return {};
	},
	
	_query: function (query, options) {
		return BetaJS.Promise.create(null, new BetaJS.Stores.StoreException("unsupported: query"));
	},
	
	insert: function (data) {
		var event_data = null;
		if (BetaJS.Types.is_array(data)) {
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
		var promise = BetaJS.Promise.and();
		for (var i = 0; i < data.length; ++i)
			and = promise.and(this.insert(event_data ? [data[i], event_data] : data[i]));
		return and.end();
	},

	remove: function (id) {
		var event_data = null;
		if (BetaJS.Types.is_array(id)) {
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
		if (BetaJS.Types.is_array(data)) {
			event_data = data[1];
			data = data[0];
		}			
		return this._update(id, data).success(function (row) {
			this._updated(row, data, event_data);
		}, this);
	},
	
	query: function (query, options) {
		query = BetaJS.Objs.clone(query, -1);
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
    			return BetaJS.Promise.error(new BetaJS.Stores.StoreException("Cannot execute query"));
    		}
    		this.trigger("query_hit", {query: query, options: options}, subsumizer);
		}
		return BetaJS.Queries.Constrained.emulate(
				BetaJS.Queries.Constrained.make(query, options || {}),
				this._query_capabilities(),
				this._query,
				this);
	},
	
	_query_applies_to_id: function (query, id) {
		var row = this.get(id);
		return row && BetaJS.Queries.overloaded_evaluate(query, row);
	},
	
	_ensure_index: function (key) {
	},
	
	ensure_index: function (key) {
		return this._ensure_index(key);
	},
	
	clear: function () {
		return this.query().mapSuccess(function (iter) {
			var promise = BetaJS.Promise.and();
			while (iter.hasNext()) {
				var obj = iter.next();
				promise = promise.and(this.remove(obj[this._id_key]));
			}
			return promise;
		}, this);
	},
	
	perform: function (commit) {
		var action = BetaJS.Objs.keyByIndex(commit);
		var data = BetaJS.Objs.valueByIndex(commit);
		if (action == "insert")
			return this.insert(data);
		else if (action == "remove")
			return this.remove(data);
		else if (action == "update")
			return this.update(BetaJS.Objs.keyByIndex(data), BetaJS.Objs.valueByIndex(data));
		else
			return BetaJS.Promise.error(new BetaJS.Stores.StoreException("unsupported: perform " + action));
	}

});

BetaJS.Stores.BaseStore.extend("BetaJS.Stores.AssocStore", {
	
	_read_key: function (key) {},
	_write_key: function (key, value) {},
	_remove_key: function (key) {},
	_iterate: function () {},
	
	constructor: function (options) {
		options = options || {};
		options.create_ids = true;
		this._inherited(BetaJS.Stores.AssocStore, "constructor", options);
	},
	
	_insert: function (data) {
		return BetaJS.Promise.tryCatch(function () {
			this._write_key(data[this._id_key], data);
			return data;
		}, this);
	},
	
	_remove: function (id) {
		return BetaJS.Promise.tryCatch(function () {
			var row = this._read_key(id);
			if (row && !this._remove_key(id))
				return null;
			return row;
		}, this);
	},
	
	_get: function (id) {
		return BetaJS.Promise.tryCatch(function () {
			return this._read_key(id);
		}, this);
	},
	
	_update: function (id, data) {
		return BetaJS.Promise.tryCatch(function () {
			var row = this._read_key(id);
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
		}, this);
	},
	
	_query: function (query, options) {
		return BetaJS.Promise.tryCatch(function () {
			return this._iterate();
		}, this);
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
	},

	_insert: function (data) {
		return BetaJS.Promise.tryCatch(function () {
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
		return BetaJS.Promise.tryCatch(function () {
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
		return BetaJS.Promise.tryCatch(function () {
			return this._read_item(id);
		}, this);
	},
	
	_update: function (id, data) {
		return BetaJS.Promise.tryCatch(function () {
			var row = this._get(id);
			if (row) {
				delete data[this._id_key];
				BetaJS.Objs.extend(row, data);
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
		return BetaJS.Promise.tryCatch(function () {
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
		}, this);
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
								return new BetaJS.Iterators.ArrayIterator(arr);
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
							return new BetaJS.Iterators.ArrayIterator(arr);
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
	               BetaJS.Async.eventually(function () {
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
		return BetaJS.Objs.extend(result, this.__projection);
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
			return new BetaJS.Iterators.MappedIterator(result, this.decode_object, this);
		}, this);
	}		

});

BetaJS.Stores.BaseStore.extend("BetaJS.Stores.PassthroughStore", {
	
	constructor: function (store, options) {
		this.__store = store;
		options = options || {};
		options.id_key = store.id_key();
		this._projection = options.projection || {};
		this._inherited(BetaJS.Stores.PassthroughStore, "constructor", options);
        if (options.destroy_store)
            this._auto_destroy(store);
	},
	
	_query_capabilities: function () {
		return this.__store._query_capabilities();
	},

	_insert: function (data) {
		return this.__store.insert(BetaJS.Objs.extend(data, this._projection));
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
		return this.__store.query(BetaJS.Objs.extend(query, this._projection), options);
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
		var promise = BetaJS.Promise.create();
		this.__ajax.asyncCall(options, promise.asCallback());
		return promise.mapCallback(function (e, result) {
			if (e)
				return new BetaJS.Stores.RemoteStoreException(e);
			if (parse_json && BetaJS.Types.is_string(result)) {
				try {
					result = JSON.parse(result);
				} catch (e) {}
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
		var copy = BetaJS.Objs.clone(data, 1);
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
	
	constructor: function (attributes) {
		this._inherited(BetaJS.Modelling.SchemedProperties, "constructor");
		var scheme = this.cls.scheme();
		this._properties_changed = {};
		this.__errors = {};
		this.__unvalidated = {};
		for (var key in scheme) {
			if ("def" in scheme[key]) 
				this.set(key, BetaJS.Types.is_function(scheme[key].def) ? scheme[key].def() : scheme[key].def);
			else if (scheme[key].auto_create)
				this.set(key, scheme[key].auto_create(this));
			else
				this.set(key, null);
		}
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
		if (sch.type)
			value = BetaJS.Types.parseType(value, sch.type);
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
	
	isChanged: function () {
		return !BetaJS.Types.is_empty(this._properties_changed);
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
		if ("instance_of" in e && e.instance_of(BetaJS.Stores.RemoteStoreException))
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
			if ((!BetaJS.Types.is_defined(scheme[key].persistent) || scheme[key].persistent) && (BetaJS.Types.is_defined(obj[key])))
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
	
	constructor: function (attributes) {
		this._inherited(BetaJS.Modelling.AssociatedProperties, "constructor", attributes);
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
			type: "id",
			tags: ["read"]
		};
		return s;
	}

});
BetaJS.Modelling.AssociatedProperties.extend("BetaJS.Modelling.Model", {
	
	constructor: function (attributes, table, options) {
		this.__table = table;
		this.__options = BetaJS.Objs.extend({
			newModel: true,
			removed: false
		}, options);
		this.__silent = 1;
		this._inherited(BetaJS.Modelling.Model, "constructor", attributes);
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
		this._inherited(BetaJS.Modelling.Model, "destroy");
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
		return this.isNew() ? BetaJS.Promise.create(true) : this.save();
	},

	_afterSet: function (key, value, old_value, options) {
		this._inherited(BetaJS.Modelling.Model, "_afterSet", key, value, old_value, options);
		var scheme = this.cls.scheme();
		if (!(key in scheme) || this.__silent > 0)
			return;
		if (this.option("auto_update") && !this.isNew())
			this.save();
	},
	
	save: function () {
		if (this.isRemoved())
			return BetaJS.Promise.create({});
		if (!this.validate() && !this.options("save_invalid")) 
			return BetaJS.Promise.create(null, new BetaJS.Modelling.ModelInvalidException(this));
		var attrs;
		if (this.isNew()) {
			attrs = this.cls.filterPersistent(this.get_all_properties());
			if (this.__options.type_column)
				attrs[this.__options.type_column] = model.cls.classname;
		} else {
			attrs = this.cls.filterPersistent(this.properties_changed());
			if (BetaJS.Types.is_empty(attrs))
				return BetaJS.Promise.create(attrs);
		}
		var wasNew = this.isNew();
		var promise = this.isNew() ? this.__table.store().insert(attrs) : this.__table.store().update(this.id(), attrs);
		return promise.mapCallback(function (err, result) {
			if (err)
				return BetaJS.Exceptions.ensure(this.validation_exception_conversion(err));
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
	},
	
	remove: function () {
		if (this.isNew() || this.isRemoved())
			return BetaJS.Promise.create(true);
		return this.__table.store().remove(this.id()).mapSuccess(function (result) {
			this.trigger("remove");		
			this.__options.removed = true;
			return result;
		}, this);
	}	
		
});
BetaJS.Class.extend("BetaJS.Modelling.Table", [
	BetaJS.Events.EventsMixin,
	{

	constructor: function (store, model_type, options) {
		this._inherited(BetaJS.Modelling.Table, "constructor");
		this.__store = store;
		this.__model_type = model_type;
		this.__options = BetaJS.Objs.extend({
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
		return cls ? (BetaJS.Types.is_string(cls) ? BetaJS.Scopes.resolve(cls) : cls) : BetaJS.Scopes.resolve(this.__model_type);
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
			return new BetaJS.Iterators.MappedIterator(iterator, function (obj) {
				return this.materialize(obj);
			}, this);
		}, this);
	},
	
	primary_key: function () {
		return BetaJS.Scopes.resolve(this.__model_type).primary_key();
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
	
}]);
BetaJS.Class.extend("BetaJS.Modelling.Associations.Association", {

  	constructor: function (model, options) {
  		this._inherited(BetaJS.Modelling.Associations.Association, "constructor");
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
			iter = BetaJS.Iterators.ensure(iter).toArray();
			while (iter.hasNext())
				iter.next().remove({});
  		}, this);
  	},
  	
  	yield: function () {
  		if ("__cache" in this)
  			return BetaJS.Promise.create(this.__cache);
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

});
BetaJS.Modelling.Associations.Association.extend("BetaJS.Modelling.Associations.TableAssociation", {

	constructor: function (model, foreign_table, foreign_key, options) {
		this._inherited(BetaJS.Modelling.Associations.TableAssociation, "constructor", model, options);
		this._foreign_table = foreign_table;
		this._foreign_key = foreign_key;
	}
	
});
BetaJS.Modelling.Associations.TableAssociation.extend("BetaJS.Modelling.Associations.HasManyAssociation", {

	_id: function () {
		return this._primary_key ? this._model.get(this._primary_key) : this._model.id();
	},

	_yield: function () {
		return this.allBy();
	},

	yield: function () {
		return this._inherited(BetaJS.Modelling.Associations.HasManyAssociation, "yield").mapSuccess(function (items) {
			return new BetaJS.Iterators.ArrayIterator(items);
		});
	},
	
	findBy: function (query) {
		return this._foreign_table.findBy(BetaJS.Objs.objectBy(this._foreign_key, this._id()));
	},

	allBy: function (query, id) {
		return this._foreign_table.allBy(BetaJS.Objs.extend(BetaJS.Objs.objectBy(this._foreign_key, id ? id : this._id(), query)));
	}

});
BetaJS.Modelling.Associations.HasManyAssociation.extend("BetaJS.Modelling.Associations.HasManyThroughArrayAssociation", {

	_yield: function () {
		var returnPromise = BetaJS.Promise.create();
		var promises = BetaJS.Promise.and();
		BetaJS.Objs.iter(this._model.get(this._foreign_key), function (id) {
			promises = promises.and(this._foreign_table.findById(id));
		}, this);
		promises.forwardError(returnPromise).success(function (result) {
			returnPromise.asyncSuccess(BetaJS.Objs.filter(result, function (item) {
				return !!item;
			}));
		});
		return returnPromise;
	}

});
BetaJS.Modelling.Associations.TableAssociation.extend("BetaJS.Modelling.Associations.HasOneAssociation", {

	_yield: function (id) {
		var value = id ? id : (this._primary_key ? this._model.get(this._primary_key) : this._model.id());
		return this._foreign_table.findBy(BetaJS.Objs.objectBy(this._foreign_key, value));
	}

});
BetaJS.Modelling.Associations.TableAssociation.extend("BetaJS.Modelling.Associations.BelongsToAssociation", {
	
	_yield: function () {
		return this._primary_key ?
			this._foreign_table.findBy(BetaJS.Objs.objectBy(this._primary_key, this._model.get(this._foreign_key))) :
			this._foreign_table.findById(this._model.get(this._foreign_key));
	}
	
});
BetaJS.Modelling.Associations.Association.extend("BetaJS.Modelling.Associations.ConditionalAssociation", {

	_yield: function () {
		var assoc = this.assoc();
		return assoc.yield.apply(assoc, arguments);
	},
	
	assoc: function () {
		return this._model.assocs[this._options.conditional(this._model)];
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

	_yield: function (id) {
		var value = id ? id : (this._primary_key ? this._model.get(this._primary_key) : this._model.id());
		var foreign_table = BetaJS.Scopes.resolve(this._model.get(this._foreign_table_key));
		return foreign_table.findBy(BetaJS.Objs.objectBy(this._foreign_key, value));
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