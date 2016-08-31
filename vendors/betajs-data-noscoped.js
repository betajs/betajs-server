/*!
betajs-data - v1.0.38 - 2016-08-04
Copyright (c) Oliver Friedmann
Apache-2.0 Software License.
*/

(function () {
var Scoped = this.subScope();
Scoped.binding('module', 'global:BetaJS.Data');
Scoped.binding('base', 'global:BetaJS');
Scoped.define("module:", function () {
	return {
    "guid": "70ed7146-bb6d-4da4-97dc-5a8e2d23a23f",
    "version": "89.1470287577683"
};
});
Scoped.assumeVersion('base:version', 526);
/**
 * @class AbstractQueryCollection
 *
 * A base class for querying collections. Subclasses specify the expected type
 * of data store and specify whether the query collection is active.
 */
Scoped.define("module:Collections.AbstractQueryCollection", [      
                                                     "base:Collections.Collection",
                                                     "base:Objs",
                                                     "base:Types",
                                                     "base:Comparators",
                                                     "base:Promise",
                                                     "base:Class",
                                                     "module:Queries.Constrained",
                                                     "module:Queries"
                                                     ], function (Collection, Objs, Types, Comparators, Promise, Class, Constrained, Queries, scoped) {
	return Collection.extend({scoped: scoped}, function (inherited) {
		return {

			/**
		       * @method constructor
		       *
		       * @param {object} source The source object
		       * can either be an instance of a Table
		       * or a Store. A Table should be used if validations and other data
		       * processing methods are desired. A Store is sufficient if just
		       * performing simple queries and returning the results with little
		       * manipulation.
		       *
		       * @param {object} query The query object contains keys specifying query
		       * parameters and values specifying their respective values. This query
		       * object can be updated later with the `set_query` method.
		       *
		       * @param {object} options The options object contains keys specifying
		       * option parameters and values specifying their respective values.
		       *
		       * @return {QueryCollection} A new instance of QueryCollection.
		       */
			constructor: function (source, query, options) {
				inherited.constructor.call(this, {
					release_references: true
				});
				options = options || {};
				this._id_key = this._id_key || options.id_key || "id";
				this._source = source;
				this._complete = false;
				this._active = options.active || false;
				this._incremental = "incremental" in options ? options.incremental : true; 
				this._active_bounds = "active_bounds" in options ? options.active_bounds : true;
				this._enabled = false;
				this._range = options.range || null;
				this._forward_steps = options.forward_steps || null;
				this._backward_steps = options.backward_steps || null;
				this._async = options.async || false;
				if (this._active) {
					this.on("add", function (object) {
						this._watchItem(object.get(this._id_key));
					}, this);
					this.on("remove", function (object) {
						this._unwatchItem(object.get(this._id_key));
					}, this);
				}
				this._query = {
					query: {},
					options: {
						skip: 0,
						limit: null,
						sort: null
					}
				};
				this.update(Objs.tree_extend({
					query: {},
					options: {
						skip: options.skip || 0,
						limit: options.limit || options.range || null,
						sort: options.sort || null
					}
				}, query ? (query.query || query.options ? query : {query: query}) : {}));
				if (options.auto)
					this.enable();
			},

			destroy: function () {
				this.disable();
				if (this._watcher()) {
					this._watcher().unwatchInsert(null, this);
					this._watcher().unwatchItem(null, this);
				}
				inherited.destroy.call(this);
			},

			
		      /**
		       * @method paginate
		       *
		       * Paginate to a specific page.
		       *
		       * @param {int} index The page to paginate to.
		       *
		       * @return {Promise} Promise from query execution.
		       */
			
			paginate: function (index) {
				return this.update({options: {
					skip: index * this._range,
					limit: this._range
				}});
			},
			
		      /**
		       * @method paginate_index
		       *
		       * @return {int} Current pagination page.
		       */
			paginate_index: function () {
				return Math.floor(this.getSkip() / this._range);
			},
			
		      /**
		       * @method paginate_next
		       *
		       * Update the query to paginate to the next page.
		       *
		       * @return {Promise} Promise of the query.
		       */
			paginate_next: function () {
				return this.isComplete() ? Promise.create(true) : this.paginate(this.paginate_index() + 1);
			},
			
	      /**
	       * @method paginate_prev
	       *
	       * Update the query to paginate to the previous page.
	       *
	       * @return {Promise} Promise of the query.
	       */
			paginate_prev: function () {
				return this.paginate_index() > 0 ? this.paginate(this.paginate_index() - 1) : Promise.create(true);
			},		
			
			increase_forwards: function (steps) {
				steps = steps || this._forward_steps;
				return this.isComplete() ? Promise.create(true) : this.update({options: {
					limit: this.getLimit() + steps
				}});
			},

			increase_backwards: function (steps) {
				steps = steps || this._backward_steps;
				return !this.getSkip() ? Promise.create(true) : this.update({options: {
					skip: Math.max(this.getSkip() - steps, 0),
					limit: this.getLimit() ? this.getLimit() + this.getSkip() - Math.max(this.getSkip() - steps, 0) : null  
				}});
			},
			

			get_ident: function (obj) {
				return Class.is_class_instance(obj) ? obj.get(this._id_key) : obj[this._id_key];
			},

			getQuery: function () {
				return this._query;
			},

			getSkip: function () {
				return this._query.options.skip || 0;
			},

			getLimit: function () {
				return this._query.options.limit || null;
			},

		      /**
		       * @method update
		       *
		       * Update the collection with a new query. Setting the query not only
		       * updates the query field, but also updates the data with the results of
		       * the new query.
		       *
		       * @param {object} constrainedQuery The new query for this collection.
		       *
		       * @example
		       * // Updates the query dictating the collection contents.
		       * collectionQuery.update({query: {'queryField': 'queryValue'}, options: {skip: 10}});
		       */
			update: function (constrainedQuery) {
				var hasQuery = !!constrainedQuery.query;
				constrainedQuery = Constrained.rectify(constrainedQuery);
				var currentSkip = this._query.options.skip || 0;
				var currentLimit = this._query.options.limit || null;
				if (constrainedQuery.query)
					this._query.query = constrainedQuery.query;
				this._query.options = Objs.extend(this._query.options, constrainedQuery.options);
				if (!this._enabled)
					return Promise.create(true);
				if (hasQuery || "sort" in constrainedQuery.options || !this._incremental)					
					return this.refresh(true);
				var nextSkip = "skip" in constrainedQuery.options ? constrainedQuery.options.skip || 0 : currentSkip;
				var nextLimit = "limit" in constrainedQuery.options ? constrainedQuery.options.limit || null : currentLimit;
				if (nextSkip === currentSkip && nextLimit === currentLimit)
					return Promise.create(true);
				// No overlap
				if ((nextLimit && nextSkip + nextLimit <= currentSkip) || (currentLimit && currentSkip + currentLimit <= nextSkip))
					return this.refresh(true);
				// Make sure that currentSkip >= nextSkip
				while (currentSkip < nextSkip && (currentLimit === null || currentLimit > 0)) {
					this.remove(this.getByIndex(0));
					currentSkip++;
					currentLimit--;
				}
				var promise = Promise.create(true);
				// Make sure that nextSkip === currentSkip
				if (nextSkip < currentSkip) {
					var leftLimit = currentSkip - nextSkip;
					if (nextLimit !== null)
						leftLimit = Math.min(leftLimit, nextLimit);
					promise = this._execute(Objs.tree_extend(Objs.clone(this._query, 2), {options: {
						skip: nextSkip,
						limit: leftLimit    
					}}, 2), true);
					nextSkip += leftLimit;
					if (nextLimit !== null)
						nextLimit -= leftLimit;
				}
				if (!currentLimit || (nextLimit && nextLimit <= currentLimit)) {
					if (nextLimit)
						while (this.count() > nextLimit)
							this.remove(this.getByIndex(this.count() - 1));
					return promise;
				}
				return promise.and(this._execute(Objs.tree_extend(Objs.clone(this._query, 2), {
					options: {
						skip: currentSkip + currentLimit,
						limit: !nextLimit ? null : nextLimit - currentLimit
					}
				}, 2), true));
			},

			enable: function () {
				if (this._enabled)
					return;
				this._enabled = true;
				this.refresh();
			},

			disable: function () {
				if (!this._enabled)
					return;
				this._enabled = false;
				this.clear();
				this._unwatchInsert();
			},

			refresh: function (clear) {
				if (clear && !this._incremental)
					this.clear();
				if (this._query.options.sort && !Types.is_empty(this._query.options.sort)) {
					this.set_compare(Comparators.byObject(this._query.options.sort));
				} else {
					this.set_compare(null);
				}
				this._unwatchInsert();
				if (this._active)
					this._watchInsert(this._query);
				return this._execute(this._query, !(clear && this._incremental));
			},

			isEnabled: function () {
				return this._enabled;
			},

		      /**
		       * @method _execute
		       *
		       * Execute a constrained query. This method is called whenever a new query is set.
		       * Doesn't override previous reults.
		       *
		       * @protected
		       *
		       * @param {constrainedQuery} constrainedQuery The constrained query that should be executed
		       *
		       * @return {Promise} Promise from executing query.
		       */
			_execute: function (constrainedQuery, keep_others) {
				if (this.__executePromise) {
					return this.__executePromise.mapCallback(function () {
						return this._execute(constrainedQuery, keep_others);
					}, this);
				}
				return this._subExecute(constrainedQuery.query, constrainedQuery.options).mapSuccess(function (iter) {
					if (!iter.hasNext()) {
						this._complete = true;
						return true;
					}
					if (!keep_others || !this._async) {
						this.replace_objects(iter.asArray(), keep_others);
						return true;
					}
					this.__executePromise = iter.asyncIterate(this.replace_object, this);
					this.__executePromise.callback(function () {
						this.__executePromise = null;
					}, this);
					return true;
				}, this);
			},

		      /**
		       * @method _sub_execute
		       *
		       * Run the specified query on the data source.
		       *
		       * @private
		       *
		       * @param {object} options The options for the subquery.
		       *
		       * @return {object} Iteratable object containing query results.
		       */
			_subExecute: function (query, options) {
				return this._source.query(query, options);
			},

		      /**
		       * @method isComplete
		       *
		       * @return {boolean} Return value indicates if the query has finished/if
		       * data has been returned.
		       */
			isComplete: function () {
				return this._complete;
			},
			
			isValid: function (data) {
				return Queries.evaluate(this._query.query, data);
			},

			_materialize: function (data) {
				return data;
			},

			_activeCreate: function (data) {
				if (!this._active || !this._enabled)
					return;
				if (!this.isValid(data))
					return;
				this.add(this._materialize(data));
				if (this._query.options.limit && this.count() > this._query.options.limit) {
					if (this._active_bounds)
						this._query.options.limit++;
					else
						this.remove(this.getByIndex(this.count() - 1));
				}
			},

			_activeRemove: function (id) {
				if (!this._active || !this._enabled)
					return;
				var object = this.getById(id);
				if (!object)
					return;
				this.remove(object);
				if (this._query.options.limit !== null) {
					if (this._active_bounds)
						this._query.options.limit--;
				}
			},

			_activeUpdate: function (id, data, row) {
				if (!this._active || !this._enabled)
					return;
				var object = this.getById(id);
				var merged = Objs.extend(row, data);
				if (!object)
					this._activeCreate(merged);
				else if (!this.isValid(merged))
					this._activeRemove(id);
				else
					object.setAll(data);
			},

			_watcher: function () {
				return null;
			},
			
			_watchInsert: function (query) {
				if (this._watcher())
					this._watcher().watchInsert(query, this);
			},

			_unwatchInsert: function () {
				if (this._watcher())
					this._watcher().unwatchInsert(null, this);
			},
			
			_watchItem: function (id) {
				if (this._watcher())
					this._watcher().watchItem(id, this);
			},
			
			_unwatchItem: function (id) {
				if (this._watcher())
					this._watcher().unwatchItem(id, this);
			}			

		};
	});
});




Scoped.define("module:Collections.StoreQueryCollection", [      
                                                          "module:Collections.AbstractQueryCollection",
                                                          "base:Objs"
                                                          ], function (QueryCollection, Objs, scoped) {
	return QueryCollection.extend({scoped: scoped}, function (inherited) {
		return {

			constructor: function (source, query, options) {
				inherited.constructor.call(this, source, query, Objs.extend({
					id_key: source.id_key()
				}, options));
				this._source = source;
				source.on("insert", this._activeCreate, this);
				source.on("remove", this._activeRemove, this);
				source.on("update", function (row, data) {
					this._activeUpdate(source.id_of(row), data, row);
				}, this);
			},

			destroy: function () {
				this._source.off(null, null, this);
				inherited.destroy.call(this);
			},

			get_ident: function (obj) {
				return obj.get(this._source.id_key());
			},
			
			_watcher: function () {
				return this._source.watcher();
			}

		};
	});
});

Scoped.define("module:Collections.TableQueryCollection", [      
                                                          "module:Collections.AbstractQueryCollection",
                                                          "base:Objs"
                                                          ], function (QueryCollection, Objs, scoped) {
	return QueryCollection.extend({scoped: scoped}, function (inherited) {
		return {

			constructor: function (source, query, options) {
				inherited.constructor.call(this, source, query, Objs.extend({
					id_key: source.primary_key()
				}, options));
				source.on("create", this._activeCreate, this);
				source.on("remove", this._activeRemove, this);
				source.on("update", this._activeUpdate, this);
			},

			destroy: function () {
				this._source.off(null, null, this);
				inherited.destroy.call(this);
			},

			_materialize: function (data) {
				return this._source.materialize(data);
			},
			
			_watcher: function () {
				return this._source.store().watcher();
			}

		};
	});
});



Scoped.define("module:Stores.AbstractIndex", [
                                              "base:Class",
                                              "base:Comparators",
                                              "base:Objs",
                                              "base:Functions"
                                              ], function (Class, Comparators, Objs, Functions, scoped) {
	return Class.extend({scoped: scoped}, function (inherited) {
		return {

			constructor: function (store, key, compare, options) {
				inherited.constructor.call(this);
				this._options = Objs.extend({
					exact: true,
					ignoreCase: false
				}, options);
				this._compare = compare || Comparators.byValue;
				this._store = store;
				this.__row_count = 0;
				this._initialize();
				var id_key = store.id_key();
				store.query({}).value().iterate(function (row) {
					this.__row_count++;
					this._insert(row[id_key], row[key]);
				}, this);
				store.on("insert", function (row) {
					this.__row_count++;
					this._insert(row[id_key], row[key]);
				}, this);
				store.on("remove", function (id) {
					this.__row_count--;
					this._remove(id);
				}, this);
				store.on("update", function (id, data) {
					if (key in data)
						this._update(id, data[key]);
				}, this);
			},

			_initialize: function () {},

			destroy: function () {
				this._store.off(null, null, this);
				inherited.destroy.call(this);
			},

			compare: function () {
				return this._compare.apply(arguments);
			},

			comparator: function () {
				return Functions.as_method(this, this._compare);
			},

			info: function () {
				return {
					row_count: this.__row_count,
					key_count: this._key_count(),
					key_count_ic: this._key_count_ic()
				};
			},

			options: function () {
				return this._options;
			},

			iterate: function (key, direction, callback, context) {
				this._iterate(key, direction, callback, context);
			},

			itemIterate: function (key, direction, callback, context) {
				this.iterate(key, direction, function (iterKey, id) {
					return callback.call(context, iterKey, this._store.get(id).value());
				}, this); 
			},

			iterate_ic: function (key, direction, callback, context) {
				this._iterate_ic(key, direction, callback, context);
			},

			itemIterateIc: function (key, direction, callback, context) {
				this.iterate_ic(key, direction, function (iterKey, id) {
					return callback.call(context, iterKey, this._store.get(id).value());
				}, this); 
			},

			_iterate: function (key, direction, callback, context) {},

			_iterate_ic: function (key, direction, callback, context) {},

			_insert: function (id, key) {},

			_remove: function (id) {},

			_update: function (id, key) {},

			_key_count: function () {},

			_key_count_ic: function () {},

			key_count_left_ic: function (key) {},
			key_count_right_ic: function (key) {},
			key_count_distance_ic: function (leftKey, rightKey) {},
			key_count_left: function (key) {},
			key_count_right: function (key) {},
			key_count_distance: function (leftKey, rightKey) {}

		};
	});
});

Scoped.define("module:Stores.MemoryIndex", [
                                            "module:Stores.AbstractIndex",
                                            "base:Structures.TreeMap",
                                            "base:Objs",
                                            "base:Types"
                                            ], function (AbstractIndex, TreeMap, Objs, Types, scoped) {
	return AbstractIndex.extend({scoped: scoped}, function (inherited) {
		return {

			_initialize: function () {
				if (this._options.exact)
					this._exactMap = TreeMap.empty(this._compare);
				if (this._options.ignoreCase)
					this._ignoreCaseMap = TreeMap.empty(this._compare);
				this._idToKey = {};
			},

			__insert: function (id, key, map) {
				var value = TreeMap.find(key, map);
				if (value)
					value[id] = true;
				else 
					map = TreeMap.add(key, Objs.objectBy(id, true), map);
				return map;
			},

			_insert: function (id, key) {
				this._idToKey[id] = key;
				if (this._options.exact)
					this._exactMap = this.__insert(id, key, this._exactMap);
				if (this._options.ignoreCase)
					this._ignoreCaseMap = this.__insert(id, key, this._ignoreCaseMap);
			},

			__remove: function (key, map, id) {
				var value = TreeMap.find(key, map);
				delete value[id];
				if (Types.is_empty(value))
					map = TreeMap.remove(key, map);
				return map;
			},

			_remove: function (id) {
				var key = this._idToKey[id];
				delete this._idToKey[id];
				if (this._options.exact)
					this._exactMap = this.__remove(key, this._exactMap, id);
				if (this._options.ignoreCase)
					this._ignoreCaseMap = this.__remove(key, this._ignoreCaseMap, id);
			},

			_update: function (id, key) {
				var old_key = this._idToKey[id];
				if (old_key == key)
					return;
				this._remove(id);
				this._insert(id, key);
			},

			_iterate: function (key, direction, callback, context) {
				TreeMap.iterate_from(key, this._exactMap, function (iterKey, value) {
					for (var id in value) {
						if (callback.call(context, iterKey, id) === false)
							return false;
					}
					return true;
				}, this, !direction);
			},	

			_iterate_ic: function (key, direction, callback, context) {
				TreeMap.iterate_from(key, this._ignoreCaseMap, function (iterKey, value) {
					for (var id in value) {
						if (callback.call(context, iterKey, id) === false)
							return false;
					}
					return true;
				}, this, !direction);
			},	

			_key_count: function () {
				return this._options.exact ? TreeMap.length(this._exactMap) : 0;
			},

			_key_count_ic: function () {
				return this._options.ignoreCase ? TreeMap.length(this._ignoreCaseMap) : 0;
			},

			key_count_left_ic: function (key) {
				return TreeMap.treeSizeLeft(key, this._ignoreCaseMap);
			},

			key_count_right_ic: function (key) {
				return TreeMap.treeSizeRight(key, this._ignoreCaseMap);
			},

			key_count_distance_ic: function (leftKey, rightKey) {
				return TreeMap.distance(leftKey, rightKey, this._ignoreCaseMap);
			},

			key_count_left: function (key) {
				return TreeMap.treeSizeLeft(key, this._exactMap);
			},

			key_count_right: function (key) {
				return TreeMap.treeSizeRight(key, this._exactMap);
			},

			key_count_distance: function (leftKey, rightKey) {
				return TreeMap.distance(leftKey, rightKey, this._exactMap);
			}

		};
	});
});

Scoped.define("module:Queries.Constrained", [
                                             "module:Queries",
                                             "base:Types",
                                             "base:Objs",
                                             "base:Tokens",
                                             "base:Comparators"
                                             ], function (Queries, Types, Objs, Tokens, Comparators) {
	return {

		/*
		 * 
		 * { query: query, options: options }
		 * 
		 * options:
		 *  limit: int || null
		 *  skip: int || 0
		 *  sort: {
		 *    key1: 1 || -1,
		 *    key2: 1 || -1
		 *  }
		 * 
		 */

		rectify: function (constrainedQuery) {
			var base = ("options" in constrainedQuery || "query" in constrainedQuery) ? constrainedQuery : { query: constrainedQuery};
			return Objs.extend({
				query: {},
				options: {}
			}, base);
		},

		skipValidate: function (options, capabilities) {
			if ("skip" in options) {
				if (capabilities)
					return capabilities.skip;
			}
			return true;
		},

		limitValidate: function (options, capabilities) {
			if ("limit" in options) {
				if (capabilities)
					return capabilities.limit;
			}
			return true;
		},

		sortValidate: function (options, capabilities) {
			if ("sort" in options) {
				if (capabilities && !capabilities.sort)
					return false;
				if (capabilities && Types.is_object(capabilities.sort)) {
					var supported = Objs.all(options.sort, function (dummy, key) {
						return key in capabilities.sort;
					});
					if (!supported)
						return false;
				}
			}
			return true;
		},

		constraintsValidate: function (options, capabilities) {
			return Objs.all(["skip", "limit", "sort"], function (prop) {
				return this[prop + "Validate"].call(this, options, capabilities);
			}, this);
		},

		validate: function (constrainedQuery, capabilities) {
			constrainedQuery = this.rectify(constrainedQuery);
			return this.constraintsValidate(constrainedQuery.options, capabilities) && Queries.validate(constrainedQuery.query, capabilities.query || {});
		},

		fullConstrainedQueryCapabilities: function (queryCapabilties) {
			return {
				query: queryCapabilties || Queries.fullQueryCapabilities(),
				skip: true,
				limit: true,
				sort: true // can also be false OR a non-empty object containing keys which can be ordered by
			};
		},

		normalize: function (constrainedQuery) {
			constrainedQuery = this.rectify(constrainedQuery);
			return {
				query: Queries.normalize(constrainedQuery.query),
				options: constrainedQuery.options
			};
		},

		serialize: function (constrainedQuery) {
			return JSON.stringify(this.rectify(constrainedQuery));
		},

		unserialize: function (constrainedQuery) {
			return JSON.parse(constrainedQuery);
		},

		hash: function (constrainedQuery) {
			return Tokens.simple_hash(this.serialize(constrainedQuery));
		},

		subsumizes: function (constrainedQuery, constrainedQuery2) {
			constrainedQuery = this.rectify(constrainedQuery);
			constrainedQuery2 = this.rectify(constrainedQuery2);
			var qskip = constrainedQuery.options.skip || 0;
			var qskip2 = constrainedQuery2.options.skip || 0;
			var qlimit = constrainedQuery.options.limit || null;
			var qlimit2 = constrainedQuery2.options.limit || null;
			var qsort = constrainedQuery.options.sort;
			var qsort2 = constrainedQuery.options.sort;
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
			return Queries.subsumizes(constrainedQuery.query, constrainedQuery2.query);
		},

		mergeable: function (constrainedQuery, constrainedQuery2) {
			constrainedQuery = this.rectify(constrainedQuery);
			constrainedQuery2 = this.rectify(constrainedQuery2);
			if (Queries.serialize(constrainedQuery.query) != Queries.serialize(constrainedQuery2.query))
				return false;
			var qopts = constrainedQuery.options;
			var qopts2 = constrainedQuery2.options;
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

		merge: function (constrainedQuery, constrainedQuery2) {
			constrainedQuery = this.rectify(constrainedQuery);
			constrainedQuery2 = this.rectify(constrainedQuery2);
			var qopts = constrainedQuery.options;
			var qopts2 = constrainedQuery2.options;
			return {
				query: constrainedQuery.query,
				options: {
					skip: "skip" in qopts ? ("skip" in qopts2 ? Math.min(qopts.skip, qopts2.skip): null) : null,
							limit: "limit" in qopts ? ("limit" in qopts2 ? Math.max(qopts.limit, qopts2.limit): null) : null,
									sort: constrainedQuery.sort
				}
			};
		}


	}; 
});
Scoped.define("module:Queries", [
                                 "base:Types",
                                 "base:Sort",
                                 "base:Objs",
                                 "base:Class",
                                 "base:Tokens",
                                 "base:Iterators.ArrayIterator",
                                 "base:Iterators.FilteredIterator",
                                 "base:Strings",
                                 "base:Comparators"
                                 ], function (Types, Sort, Objs, Class, Tokens, ArrayIterator, FilteredIterator, Strings, Comparators) {

	var SYNTAX_PAIR_KEYS = {
			"$or": {
				evaluate_combine: Objs.exists
			},
			"$and": {
				evaluate_combine: Objs.all
			}
	};

	var SYNTAX_CONDITION_KEYS = {
			"$in": {
				target: "atoms",
				evaluate_combine: Objs.exists,
				evaluate_single: function (object_value, condition_value) {
					return object_value === condition_value;
				}
			}, "$gt": {
				target: "atom",
				evaluate_single: function (object_value, condition_value) {
					return object_value > condition_value;
				}
			}, "$lt": {
				target: "atom",
				evaluate_single: function (object_value, condition_value) {
					return object_value < condition_value;
				}
			}, "$gte": {
				target: "atom",
				evaluate_single: function (object_value, condition_value) {
					return object_value >= condition_value;
				}
			}, "$le": {
				target: "atom",
				evaluate_single: function (object_value, condition_value) {
					return object_value <= condition_value;
				}
			}, "$sw": {
				target: "atom",
				evaluate_single: function (object_value, condition_value) {
					return object_value === condition_value || (Types.is_string(object_value) && object_value.indexOf(condition_value) === 0);
				}
			}, "$ct": {
				target: "atom",
				no_index_support: true,
				evaluate_single: function (object_value, condition_value) {
					return object_value === condition_value || (Types.is_string(object_value) && object_value.indexOf(condition_value) >= 0);
				}
			}, "$eq": {
				target: "atom",
				evaluate_single: function (object_value, condition_value) {
					return object_value === condition_value;
				}
			}
	};

	Objs.iter(Objs.clone(SYNTAX_CONDITION_KEYS, 1), function (value, key) {
		var valueic = Objs.clone(value, 1);
		valueic.evaluate_single = function (object_value, condition_value) {
			return value.evaluate_single(Types.is_string(object_value) ? object_value.toLowerCase() : object_value, Types.is_string(condition_value) ? condition_value.toLowerCase() : condition_value);
		};
		valueic.ignore_case = true;
		SYNTAX_CONDITION_KEYS[key + "ic"] = valueic;
	});


	return {		

		/*
		 * Syntax:
		 *
		 * atoms :== [atom, ...]
		 * atom :== string | int | bool | float
		 * queries :== [query, ...]
		 * query :== {pair, ...}
		 * pair :== key: value | $or : queries | $and: queries
		 * value :== atom | conditions
		 * conditions :== {condition, ...}  
		 * condition :== $in: atoms | $gt: atom | $lt: atom | $gte: atom | $le: atom | $sw: atom | $ct: atom | all with ic
		 *
		 */

		SYNTAX_PAIR_KEYS: SYNTAX_PAIR_KEYS,

		SYNTAX_CONDITION_KEYS: SYNTAX_CONDITION_KEYS,

		validate: function (query, capabilities) {
			return this.validate_query(query, capabilities);
		},

		validate_atoms: function (atoms, capabilities) {
			return Types.is_array(atoms) && Objs.all(atoms, function (atom) {
				return this.validate_atom(atom, capabilities);
			}, this);
		},

		validate_atom: function (atom, capabilities) {
			return !capabilities || !!capabilities.atom; 
		},

		validate_queries: function (queries, capabilities) {
			return Types.is_array(queries) && Objs.all(queries, function (query) {
				return this.validate_query(query, capabilities);
			}, this);
		},

		validate_query: function (query, capabilities) {
			return Types.is_object(query) && Objs.all(query, function (value, key) {
				return this.validate_pair(value, key, capabilities);
			}, this);
		},

		validate_pair: function (value, key, capabilities) {
			if (key in this.SYNTAX_PAIR_KEYS) {
				if (capabilities && (!capabilities.bool || !(key in capabilities.bool)))
					return false;
				return this.validate_queries(value, capabilities);
			}
			return this.validate_value(value, capabilities);
		},

		is_query_atom: function (value) {
			return value === null || !Types.is_object(value) || value.toString() !== "[object Object]" || Objs.all(value, function (v, key) {
				return !(key in this.SYNTAX_CONDITION_KEYS);
			}, this);
		},

		validate_value: function (value, capabilities) {
			return !this.is_query_atom(value) ? this.validate_conditions(value, capabilities) : this.validate_atom(value, capabilities);
		},

		validate_conditions: function (conditions, capabilities) {
			return Types.is_object(conditions) && Objs.all(conditions, function (value, key) {
				return this.validate_condition(value, key, capabilities);
			}, this);
		},

		validate_condition: function (value, key, capabilities) {
			if (capabilities && (!capabilities.conditions || !(key in capabilities.conditions)))
				return false;
			var meta = this.SYNTAX_CONDITION_KEYS[key];
			return meta && (meta.target === "atoms" ? this.validate_atoms(value) : this.validate_atom(value));
		},

		normalize: function (query) {
			return Sort.deep_sort(query);
		},

		serialize: function (query) {
			return JSON.stringify(query);
		},

		unserialize: function (query) {
			return JSON.parse(query);
		},

		hash: function (query) {
			return Tokens.simple_hash(this.serialize(query));
		},

		dependencies: function (query) {
			return Object.keys(this.dependencies_query(query, {}));
		},

		dependencies_queries: function (queries, dep) {
			Objs.iter(queries, function (query) {
				dep = this.dependencies_query(query, dep);
			}, this);
			return dep;
		},

		dependencies_query: function (query, dep) {
			Objs.iter(query, function (value, key) {
				dep = this.dependencies_pair(value, key, dep);
			}, this);
			return dep;
		},

		dependencies_pair: function (value, key, dep) {
			return key in this.SYNTAX_PAIR_KEYS ? this.dependencies_queries(value, dep) : this.dependencies_key(key, dep);
		},

		dependencies_key: function (key, dep) {
			dep[key] = (dep[key] || 0) + 1;
			return dep;
		},

		evaluate : function(query, object) {
			return this.evaluate_query(query, object);
		},

		evaluate_query: function (query, object) {
			return Objs.all(query, function (value, key) {
				return this.evaluate_pair(value, key, object);
			}, this);
		},

		evaluate_pair: function (value, key, object) {
			if (key in this.SYNTAX_PAIR_KEYS) {
				return this.SYNTAX_PAIR_KEYS[key].evaluate_combine.call(Objs, value, function (query) {
					return this.evaluate_query(query, object);
				}, this);
			} else
				return this.evaluate_value(value, object[key]);
		},

		evaluate_value: function (value, object_value) {
			return !this.is_query_atom(value) ? this.evaluate_conditions(value, object_value) : this.evaluate_atom(value, object_value);
		},

		evaluate_atom: function (value, object_value) {
			return value === object_value;
		},

		evaluate_conditions: function (value, object_value) {
			return Objs.all(value, function (condition_value, condition_key) {
				return this.evaluate_condition(condition_value, condition_key, object_value);
			}, this);
		},

		evaluate_condition: function (condition_value, condition_key, object_value) {
			var rec = this.SYNTAX_CONDITION_KEYS[condition_key];
			if (rec.target === "atoms") {
				return rec.evaluate_combine.call(Objs, condition_value, function (condition_single_value) {
					return rec.evaluate_single.call(this, object_value, condition_single_value);
				}, this);
			}
			return rec.evaluate_single.call(this, object_value, condition_value);
		},

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

		fullQueryCapabilities: function () {
			var bool = {};
			Objs.iter(this.SYNTAX_PAIR_KEYS, function (dummy, key) {
				bool[key] = true;
			});
			var conditions = {};
			Objs.iter(this.SYNTAX_CONDITION_KEYS, function (dummy, key) {
				conditions[key] = true;
			});
			return {
				atom: true,
				bool: bool,
				conditions: conditions
			};
		},

		mergeConditions: function (conditions1, conditions2) {
			if (!Types.is_object(conditions1))
				conditions1 = {"$eq": conditions1 };
			if (!Types.is_object(conditions2))
				conditions2 = {"$eq": conditions2 };
			var fail = false;
			var obj = Objs.clone(conditions1, 1);
			Objs.iter(conditions2, function (target, condition) {
				if (fail)
					return false;
				if (condition in obj) {
					var base = obj[condition];
					if (Strings.starts_with(condition, "$eq")) 
						fail = true;
					if (Strings.starts_with(condition, "$in")) {
						base = Objs.objectify(base);
						obj[condition] = [];
						fail = true;
						Objs.iter(target, function (x) {
							if (base[x]) {
								obj[condition].push(x);
								fail = false;
							}
						});
					}
					if (Strings.starts_with(condition, "$sw")) {
						if (Strings.starts_with(base, target))
							obj[condition] = target;
						else if (!Strings.starts_with(target, base))
							fail = true;
					}
					if (Strings.starts_with(condition, "$gt"))
						if (Comparators.byValue(base, target) < 0)
							obj[condition] = target;
					if (Strings.starts_with(condition, "$lt"))
						if (Comparators.byValue(base, target) > 0)
							obj[condition] = target;
				} else
					obj[condition] = target;
			}, this);
			if (fail)
				obj = {"$in": []};
			return obj;
		},

		disjunctiveNormalForm: function (query, mergeKeys) {
			query = Objs.clone(query, 1);
			var factors = [];
			if (query.$or) {
				var factor = [];
				Objs.iter(query.$or, function (q) {
					Objs.iter(this.disjunctiveNormalForm(q, mergeKeys).$or, function (q2) {
						factor.push(q2);
					}, this);
				}, this);
				factors.push(factor);
				delete query.$or;
			}
			if (query.$and) {
				Objs.iter(query.$and, function (q) {
					var factor = [];
					Objs.iter(this.disjunctiveNormalForm(q, mergeKeys).$or, function (q2) {
						factor.push(q2);
					}, this);
					factors.push(factor);
				}, this);
				delete query.$and;
			}
			var result = [];
			var helper = function (base, i) {
				if (i < factors.length) {
					Objs.iter(factors[i], function (factor) {
						var target = Objs.clone(base, 1);
						Objs.iter(factor, function (value, key) {
							if (key in target) {
								if (mergeKeys)
									target[key] = this.mergeConditions(target[key], value);
								else {
									if (!target.$and)
										target.$and = [];
									target.$and.push(Objs.objectBy(key, value));
								}
							} else
								target[key] = value;
						}, this);
						helper(target, i + 1);
					}, this);
				} else
					result.push(base);
			};
			helper(query, 0);
			return {"$or": result};
		},

		simplifyQuery: function (query) {
			var result = {};
			Objs.iter(query, function (value, key) {
				if (key in this.SYNTAX_PAIR_KEYS) {
					var arr = [];
					var had_true = false;
					Objs.iter(value, function (q) {
						var qs = this.simplifyQuery(q);
						if (Types.is_empty(qs))
							had_true = true;
						else
							arr.push(qs);
					}, this);
					if ((key === "$and" && arr.length > 0) || (key === "$or" && !had_true))
						result[key] = arr;
				} else if (Types.is_object(value)) {
					var conds = this.simplifyConditions(value);
					if (!Types.is_empty(conds))
						result[key] = conds;
				} else
					result[key] = value;
			}, this);
			return result;
		},
		
		simplifiedDNF: function (query, mergeKeys) {
			query = this.simplifyQuery(this.disjunctiveNormalForm(query, true));
			return !Types.is_empty(query) ? query : {"$or": [{}]};
		},

		simplifyConditions: function (conditions) {
			var result = {};
			Objs.iter(["", "ic"], function (add) {
				if (conditions["$eq" + add] || conditions["$in" + add]) {
					var filtered = Objs.filter(conditions["$eq" + add] ? [conditions["$eq" + add]] : conditions["$in" + add], function (inkey) {
						return this.evaluate_conditions(conditions, inkey);
					}, this);
					result[(filtered.length === 1 ? "$eq" : "$in") + add] = filtered.length === 1 ? filtered[0] : filtered;
				} else {
					var gt = null;
					var lt = null;
					var lte = false;
					var gte = false;
					var compare = Comparators.byValue;
					if (conditions["$gt" + add])
						gt = conditions["$gt" + add];
					if (conditions["$lt" + add])
						gt = conditions["$lt" + add];
					if (conditions["$gte" + add] && (gt === null || compare(gt, conditions["$gte" + add]) < 0)) {
						gte = true;
						gt = conditions["$gte" + add];
					}
					if (conditions["$lte" + add] && (lt === null || compare(lt, conditions["$lte" + add]) > 0)) {
						lte = true;
						lt = conditions["$lte" + add];
					}
					if (conditions["$sw" + add]) {
						var s = conditions["$sw" + add];
						if (gt === null || compare(gt, s) <= 0) {
							gte = true;
							gt = s;
						}
						var swnext = null;
						if (typeof(s) === 'number')
							swnext = s + 1;
						else if (typeof(s) === 'string' && s.length > 0)
							swnext = s.substring(0, s.length - 1) + String.fromCharCode(s.charCodeAt(s.length - 1) + 1);
						if (swnext !== null && (lt === null || compare(lt, swnext) >= 0)) {
							lte = true;
							lt = swnext;
						}
					}				
					if (lt !== null)
						result[(lte ? "$lte" : "$lt") + add] = lt;
					if (gt !== null)
						result[(gte ? "$gte" : "$gt") + add] = gt;
					if (conditions["$ct" + add])
						result["$ct" + add] = conditions["$ct" + add];
				}
			}, this);
			return result;
		},
		
		mapKeyValue: function (query, callback, context) {
			return this.mapKeyValueQuery(query, callback, context);
		},
		
		mapKeyValueQuery: function (query, callback, context) {
			var result = {};
			Objs.iter(query, function (value, key) {
				result = Objs.extend(result, this.mapKeyValuePair(value, key, callback, context));
			}, this);
			return result;
		},
		
		mapKeyValueQueries: function (queries, callback, context) {
			return Objs.map(queries, function (query) {
				return this.mapKeyValueQuery(query, callback, context);
			}, this);
		},
		
		mapKeyValuePair: function (value, key, callback, context) {
			if (key in this.SYNTAX_PAIR_KEYS)
				return Objs.objectBy(key, this.mapKeyValueQueries(value, callback, context));
			if (this.is_query_atom(value))
				return callback.call(context, key, value);
			var result = {};
			Objs.iter(value, function (condition_value, condition_key) {
				result[condition_key] = this.mapKeyValueCondition(condition_value, key, callback, context);
			}, this);
			return Objs.objectBy(key, result);
		},

		mapKeyValueCondition: function (condition_value, key, callback, context) {
			var is_array = Types.is_array(condition_value);
			if (!is_array)
				condition_value = [condition_value];
			var result = Objs.map(condition_value, function (value) {
				return Objs.peek(callback.call(context, key, value));
			}, this);
			return is_array ? result : result[0];
		},

		queryDeterminedByAttrs: function (query, attributes) {
			return Objs.exists(query, function (value, key) {
				if (key === "$and") {
					return Objs.exists(value, function (q) {
						return this.queryDeterminedByAttrs(q, attributes);
					}, this);
				} else if (key === "$or") {
					return Objs.all(value, function (q) {
						return this.queryDeterminedByAttrs(q, attributes);
					}, this);
				} else
					return attributes[key];
			}, this);
		}
		
	}; 
});
Scoped.define("module:Queries.Engine", [
                                        "module:Queries",
                                        "module:Queries.Constrained",
                                        "base:Strings",
                                        "base:Types",
                                        "base:Objs",
                                        "base:Promise",
                                        "base:Comparators",
                                        "base:Iterators.SkipIterator",
                                        "base:Iterators.LimitIterator",
                                        "base:Iterators.SortedIterator",
                                        "base:Iterators.FilteredIterator",
                                        "base:Iterators.SortedOrIterator",
                                        "base:Iterators.PartiallySortedIterator",
                                        "base:Iterators.ArrayIterator",
                                        "base:Iterators.LazyMultiArrayIterator"
                                        ], function (Queries, Constrained, Strings, Types, Objs, Promise, Comparators, SkipIterator, LimitIterator, SortedIterator, FilteredIterator, SortedOrIterator, PartiallySortedIterator, ArrayIterator, LazyMultiArrayIterator) {
	return {

		indexQueryConditionsSize: function (conds, index, ignoreCase) {
			var add = ignoreCase ? "ic" : "";
			var postfix = ignoreCase ? "_ic" : "";
			var info = index.info();
			var subSize = info.row_count;
			var rows_per_key = info.row_count / Math.max(info["key_count" + postfix], 1);
			if (conds["$eq" + add])
				subSize = rows_per_key;
			else if (conds["$in" + add])
				subSize = rows_per_key * conds["$in" + add].length;
			else {
				var keys = 0;
				var g = null;
				if (conds["$gt" + add] || conds["$gte" + add]) {
					g = conds["$gt" + add] || conds["$gte" + add];
					if (conds["$gt" + add])
						keys--;
				}
				var l = null;
				if (conds["$lt" + add] || conds["$lte" + add]) {
					l = conds["$lt" + add] || conds["$lte" + add];
					if (conds["$lt" + add])
						keys--;
				}
				if (g !== null && l !== null)
					keys += index["key_count_distance" + postfix](g, l);						
				else if (g !== null)
					keys += index["key_count_right" + postfix](g);
				else if (l !== null)
					keys += index["key_count_left" + postfix](l);
				subSize = keys * rows_per_key;
			}
			return subSize;
		},

		indexQuerySize: function (queryDNF, key, index) {
			var acc = 0;
			var info = index.info();
			Objs.iter(queryDNF.$or, function (q) {
				if (!(key in q)) {
					acc = null;
					return false;
				}
				var conds = q[key];
				var findSize = info.row_count;
				if (index.options().exact)
					findSize = Math.min(findSize, this.indexQueryConditionsSize(conds, index, false));
				if (index.options().ignoreCase)
					findSize = Math.min(findSize, this.indexQueryConditionsSize(conds, index, true));
				acc += findSize;
			}, this);
			return acc;
		},

		queryPartially: function (constrainedQuery, constrainedQueryCapabilities) {
			var simplified = {
					query: constrainedQuery.query,
					options: {}
			};
			if (constrainedQuery.options.sort) {
				var first = Objs.ithKey(constrainedQuery.options.sort, 0);
				simplified.options.sort = {};
				simplified.options.sort[first] = constrainedQuery.options.sort[first];
			}
			return Constrained.validate(simplified, constrainedQueryCapabilities);
		},

		compileQuery: function (constrainedQuery, constrainedQueryCapabilities, constrainedQueryFunction, constrainedQueryContext) {
			constrainedQuery = Constrained.rectify(constrainedQuery);
			var sorting_supported = Constrained.sortValidate(constrainedQuery.options, constrainedQueryCapabilities);
			var query_supported = Queries.validate(constrainedQuery.query, constrainedQueryCapabilities.query || {});
			var skip_supported = Constrained.skipValidate(constrainedQuery.options, constrainedQueryCapabilities);
			var limit_supported = Constrained.limitValidate(constrainedQuery.options, constrainedQueryCapabilities);
			var post_actions = {
					skip: null,
					limit: null,
					filter: null,
					sort: null
			};
			if (!query_supported || !sorting_supported || !skip_supported) {
				post_actions.skip = constrainedQuery.options.skip;
				delete constrainedQuery.options.skip;
				if ("limit" in constrainedQuery.options && limit_supported && query_supported && sorting_supported)
					constrainedQuery.options.limit += post_actions.skip;
			}
			if (!query_supported || !sorting_supported || !limit_supported) {
				post_actions.limit = constrainedQuery.options.limit;
				delete constrainedQuery.options.limit;
			}
			if (!sorting_supported) {
				post_actions.sort = constrainedQuery.options.sort;
				delete constrainedQuery.options.sort;
			}
			if (!query_supported) {
				post_actions.filter = constrainedQuery.query;
				constrainedQuery.query = {};
			}
			var query_result = constrainedQueryFunction.call(constrainedQueryContext, constrainedQuery);
			return query_result.mapSuccess(function (iter) {
				iter = this._queryResultRectify(iter, false);
				if (post_actions.filter)
					iter = new FilteredIterator(iter, function(row) {
						return Queries.evaluate(post_actions.filter, row);
					});
				if (post_actions.sort)
					iter = new SortedIterator(iter, Comparators.byObject(post_actions.sort));
				if (post_actions.skip)
					iter = new SkipIterator(iter, post_actions.skip);
				if (post_actions.limit)
					iter = new LimitIterator(iter, post_actions.limit);
				return iter;
			}, this);
		},

		compileIndexQuery: function (constrainedDNFQuery, key, index) {
			var fullQuery = Objs.exists(constrainedDNFQuery.query.$or, function (query) {
				return !(key in query);
			});
			var primaryKeySort = constrainedDNFQuery.options.sort && Objs.ithKey(constrainedDNFQuery.options.sort, 0) === key;
			var primarySortDirection = primaryKeySort ? constrainedDNFQuery.options.sort[key] : 1;
			var iter;
			var ignoreCase = !index.options().exact;
			if (fullQuery) {
				var materialized = [];
				index["itemIterate" + (ignoreCase ? "_ic" : "")](null, primarySortDirection, function (dataKey, data) {
					materialized.push(data);
				});
				iter = new ArrayIterator(materialized);
			} else {
				iter = new SortedOrIterator(Objs.map(constrainedDNFQuery.query.$or, function (query) {
					var conds = query[key];
					if (!primaryKeySort && index.options().ignoreCase && index.options().exact) {
						if (this.indexQueryConditionsSize(conds, index, true) < this.indexQueryConditionsSize(conds, index, false))
							ignoreCase = true;
					}
					var add = ignoreCase ? "ic" : "";
					var postfix = ignoreCase ? "_ic" : "";
					if (conds["$eq" + add] || !Types.is_object(conds)) {
						var materialized = [];
						var value = Types.is_object(conds) ? conds["$eq" + add] : conds;
						index["itemIterate" + postfix](value, primarySortDirection, function (dataKey, data) {
							if (dataKey !== value)
								return false;
							materialized.push(data);
						});
						iter = new ArrayIterator(materialized);
					} else if (conds["$in" + add]) {
						var i = 0;
						iter = new LazyMultiArrayIterator(function () {
							if (i >= conds["$in" + add].length)
								return null;
							var materialized = [];
							index["itemIterate" + postfix](conds["$in" + add][i], primarySortDirection, function (dataKey, data) {
								if (dataKey !== conds["in" + add][i])
									return false;
								materialized.push(data);
							});
							i++;
							return materialized;
						});
					} else {
						var currentKey = null;
						var lastKey = null;
						if (conds["$gt" + add] || conds["$gte" + add])
							currentKey = conds["$gt" + add] || conds["$gte" + add];
						if (conds["$lt" + add] || conds["$lte" + add])
							lastKey = conds["$lt" + add] || conds["$lte" + add];
						if (primarySortDirection < 0) {
							var temp = currentKey;
							currentKey = lastKey;
							lastKey = temp;
						}
						iter = new LazyMultiArrayIterator(function () {
							if (currentKey !== null && lastKey !== null) {
								if (Math.sign((index.comparator())(currentKey, lastKey)) === Math.sign(primarySortDirection))
									return null;
							}
							var materialized = [];
							index["itemIterate" + postfix](currentKey, primarySortDirection, function (dataKey, data) {
								if (currentKey === null)
									currentKey = dataKey;
								if (dataKey !== currentKey) {
									currentKey = dataKey;
									return false;
								}
								materialized.push(data);
							});
							return materialized;
						});
					}
					return iter;
				}, this), index.comparator());
			}
			iter = new FilteredIterator(iter, function (row) {
				return Queries.evaluate(constrainedDNFQuery.query, row);
			});
			if (constrainedDNFQuery.options.sort) {
				if (primaryKeySort)
					iter = new PartiallySortedIterator(iter, Comparators.byObject(constrainedDNFQuery.options.sort), function (first, next) {
						return first[key] === next[key];
					});
				else
					iter = new SortedIterator(iter, Comparators.byObject(constrainedDNFQuery.options.sort));
			}
			if (constrainedDNFQuery.options.skip)
				iter = new SkipIterator(iter, constrainedDNFQuery.options.skip);
			if (constrainedDNFQuery.options.limit)
				iter = new LimitIterator(iter, constrainedDNFQuery.options.limit);
			return Promise.value(iter);
		},

		compileIndexedQuery: function (constrainedQuery, constrainedQueryCapabilities, constrainedQueryFunction, constrainedQueryContext, indices) {
			constrainedQuery = Constrained.rectify(constrainedQuery);
			indices = indices || {};
			if (this.queryPartially(constrainedQuery, constrainedQueryCapabilities) || Types.is_empty(indices))
				return this.compileQuery(constrainedQuery, constrainedQueryCapabilities, constrainedQueryFunction, constrainedQueryContext);
			var dnf = Queries.simplifiedDNF(constrainedQuery.query, true);
			if (constrainedQuery.options.sort) {
				var first = Objs.ithKey(constrainedQuery.options.sort, 0);
				if (indices[first]) {
					return this.compileIndexQuery({
						query: dnf,
						options: constrainedQuery.options
					}, first, indices[first]);
				}
			}
			var smallestSize = null;
			var smallestKey = null;
			Objs.iter(indices, function (index, key) {
				var size = this.indexQuerySize(dnf, key, index);
				if (size !== null && (smallestSize === null || size < smallestSize)) {
					smallestSize = size;
					smallestKey = key;
				}
			}, this);
			if (smallestKey !== null)
				return this.compileIndexQuery({
					query: dnf,
					options: constrainedQuery.options
				}, smallestKey, indices[smallestKey]);
			else
				return this.compileQuery(constrainedQuery, constrainedQueryCapabilities, constrainedQueryFunction, constrainedQueryContext);
		},

		_queryResultRectify: function (result, materialize) {
			result = result || [];
			return Types.is_array(result) == materialize ? result : (materialize ? result.asArray() : new ArrayIterator(result)); 
		}

	}; 
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

//Stores everything temporarily in the browser's memory using map

Scoped.define("module:Stores.MemoryMapStore", [
    "module:Stores.AssocStore",
    "base:Iterators.FilteredIterator",
    "base:Iterators.NativeMapIterator",
    "base:Objs"
], function (AssocStore, FilteredIterator, NativeMapIterator, Objs, scoped) {
	return AssocStore.extend({scoped: scoped}, function (inherited) {			
		return {

			constructor: function (options) {
				inherited.constructor.call(this, options);
				this.__map = new Map();
			},

			_read_key: function (key) {
				return this.__map.get(key + "");
			},

			_write_key: function (key, value) {
				this.__map.set(key + "", value);
			},

			_remove_key: function (key) {
				this.__map['delete'](key + "");
			},

			_iterate: function () {
				return new FilteredIterator(new NativeMapIterator(this.__map), function (item) {
					return !!item;
				});
			},
			
			_count: function (query) {
				return query ? inherited._count.call(this, query) : this.__map.size;
			}						

		};
	});
});

//Stores everything temporarily in the browser's memory

Scoped.define("module:Stores.MemoryStore", [
    "module:Stores.AssocStore",
    //"base:Iterators.ObjectValuesIterator",
    "base:Iterators.FilteredIterator",
    "base:Iterators.ArrayIterator",
    "base:Objs"
], function (AssocStore, FilteredIterator, ArrayIterator, Objs, scoped) {
	return AssocStore.extend({scoped: scoped}, function (inherited) {			
		return {

			constructor: function (options) {
				inherited.constructor.call(this, options);
				// We reserve index 0.
				this.__dataByIndex = [null];
				this.__indexById = {};
				this.__count = 0;
			},

			_read_key: function (key) {
				var i = this.__indexById[key];
				return i ? this.__dataByIndex[i] : undefined;
			},

			_write_key: function (key, value) {
				var i = this.__indexById[key];
				if (!i) {
					i = this.__dataByIndex.length;
					this.__indexById[key] = i;
					this.__count++;
				}
				this.__dataByIndex[i] = value;
			},

			_remove_key: function (key) {
				var i = this.__indexById[key];
				if (i) {
					delete this.__indexById[key];
					delete this.__dataByIndex[i];
					this.__count--;
				}				
			},

			_iterate: function () {
				return new FilteredIterator(new ArrayIterator(this.__dataByIndex), function (item) {
					return !!item;
				});
				//return new ObjectValuesIterator(this.__data);
			},
			
			_count: function (query) {
				return query ? inherited._count.call(this, query) : this.__count;
			}

		};
	});
});

Scoped.define("module:Stores.BaseStore", [
  "base:Class",
  "base:Events.EventsMixin",
  "module:Stores.ReadStoreMixin",
  "module:Stores.WriteStoreMixin",
  "base:Promise",
  "base:Objs",
  "module:Stores.MemoryIndex"
], function (Class, EventsMixin, ReadStoreMixin, WriteStoreMixin, Promise, Objs, MemoryIndex, scoped) {
	return Class.extend({scoped: scoped}, [EventsMixin, ReadStoreMixin, WriteStoreMixin, function (inherited) {			
		return {

			constructor: function (options) {
				inherited.constructor.call(this);
				this._initializeReadStore(options);
				this._initializeWriteStore(options);
			},

			_ensure_index: function (key) {
				if (!(key in this.indices))
					this.indices[key] = new MemoryIndex(this, key);
			},	

			ensure_index: function (key) {
				return this._ensure_index(key);
			},

			getBy: function (key, value, ctx) {
				if (key === this.id_key())
					return this.get(value, ctx);
				return this.query(Objs.objectBy(key, value), {limit: 1}).mapSuccess(function (iter) {
					return iter.next();
				});
			},

			clear: function (ctx) {
				return this.query(null, null, ctx).mapSuccess(function (iter) {
					var promise = Promise.and();
					while (iter.hasNext()) {
						var obj = iter.next();
						promise = promise.and(this.remove(obj[this._id_key], ctx));
					}
					return promise;
				}, this);
			}

		};
	}]);
});

Scoped.define("module:Stores.ReadStoreMixin", [
                                               "module:Queries.Engine",
                                               "module:Stores.StoreException",                                               
                                               "base:Promise",
                                               "base:Objs"
                                               ], function (QueryEngine, StoreException, Promise, Objs) {
	return {

		_initializeReadStore: function (options) {
			options = options || {};
			this.indices = {};
			this._watcher = options.watcher || null;
			this._capabilities = options.capabilities || {};
		},
		
		watcher: function () {
			return this._watcher;
		},

		_get: function (id, ctx) {
			return Promise.create(null, new StoreException("unsupported: get"));
		},

		_query_capabilities: function () {
			return this._capabilities;
		},

		_query: function (query, options, ctx) {
			return Promise.create(null, new StoreException("unsupported: query"));
		},

		get: function (id, ctx) {
			return this._get(id, ctx);
		},
		
		count: function (query, ctx) {
			return this._count(query, ctx);
		},
		
		_count: function (query, ctx) {
			return this.query(query, {}, ctx).mapSuccess(function (iter) {
				return iter.asArray().length;
			});
		},

		query: function (query, options, ctx) {
			query = Objs.clone(query || {}, -1);
			options = Objs.clone(options, -1);
			if (options) {
				if (options.limit)
					options.limit = parseInt(options.limit, 10);
				if (options.skip)
					options.skip = parseInt(options.skip, 10);
			}
			return QueryEngine.compileIndexedQuery(
					{query: query, options: options || {}},
					this._query_capabilities(),
					function (constrainedQuery) {
						return this._query(constrainedQuery.query, constrainedQuery.options, ctx);
					},
					this,
					this.indices);
		},
		
		serialize: function (ctx) {
			return this.query({}, {}, ctx).mapSuccess(function (iter) {
				return iter.asArray();
			});
		}

	};
});


Scoped.define("module:Stores.ReadStore", [
                                          "base:Class",
                                          "module:Stores.ReadStoreMixin"
                                          ], function (Class, ReadStoreMixin, scoped) {
	return Class.extend({scoped: scoped}, [ReadStoreMixin, function (inherited) {			
		return {

			constructor: function (options) {
				inherited.constructor.call(this);
				this._initializeReadStore(options);
			}

		};
	}]);
});


Scoped.define("module:Stores.StoreException", ["base:Exceptions.Exception"], function (Exception, scoped) {
	return Exception.extend({scoped: scoped}, {});
});

Scoped.define("module:Stores.StoreHistory", [
                                             "base:Class",
                                             "base:Objs",
                                             "base:Types",
                                             "module:Stores.MemoryStore"
                                             ], function (Class, Objs, Types, MemoryStore, scoped) {
	return Class.extend({scoped: scoped}, function (inherited) {
		return {

			constructor: function (sourceStore, historyStore, options) {
				inherited.constructor.call(this);
				this._options = Objs.extend({
					combine_update_update: false,
					combine_insert_update: false,
					combine_insert_remove: false,
					combine_update_remove: false,
					source_id_key: sourceStore ? sourceStore.id_key() : "id",
					row_data: {},
					filter_data: {}
				}, options);
				this.historyStore = historyStore || new MemoryStore();
				this.commitId = 1;
				if (sourceStore) {
					sourceStore.on("insert", this.sourceInsert, this);
					sourceStore.on("remove", this.sourceRemove, this);
					sourceStore.on("update", this.sourceUpdate, this);
				}
			},

			sourceInsert: function (data) {
				this.commitId++;
				this.historyStore.insert(Objs.extend({
					row: data,
					type: "insert",
					row_id: data[this._options.source_id_key],
					commit_id: this.commitId
				}, this._options.row_data));
			},

			sourceUpdate: function (row, data) {
				this.commitId++;
				var row_id = Types.is_object(row) ? row[this._options.source_id_key] : row;
				var target_type = "update";
				if (this._options.combine_insert_update || this._options.combine_update_update) {
					var types = [];
					if (this._options.combine_insert_update)
						types.push("insert");
					if (this._options.combine_update_update)
						types.push("update");
					var combined_data = {};
					var delete_ids = [];
					var iter = this.historyStore.query(Objs.extend({
						type: {"$or": types},
						row_id: row_id
					}, this._options.filter_data), {sort: {commit_id: 1}}).value();
					while (iter.hasNext()) {
						var itemData = iter.next();
						if (itemData.type === "insert")
							target_type = "insert";
						combined_data = Objs.extend(combined_data, itemData.row);
						delete_ids.push(this.historyStore.id_of(itemData));
					}
					data = Objs.extend(combined_data, data);
					Objs.iter(delete_ids, this.historyStore.remove, this.historyStore);
				}
				this.historyStore.insert(Objs.extend({
					row: data,
					type: target_type,
					row_id: row_id,
					commit_id: this.commitId
				}, this._options.row_data));
			},

			sourceRemove: function (id, data) {
				this.commitId++;
				if (this._options.combine_insert_remove) {
					if (this.historyStore.query(Objs.extend({
						type: "insert",
						row_id: id
					}, this._options.filter_data)).value().hasNext()) {
						var iter = this.historyStore.query(Objs.extend({
							row_id: id
						}, this._options.filter_data)).value();
						while (iter.hasNext())
							this.historyStore.remove(this.historyStore.id_of(iter.next()));
						return;
					}
				}
				if (this._options.combine_update_remove) {
					var iter2 = this.historyStore.query(Objs.extend({
						type: "update",
						row_id: id
					}, this._options.filter_data)).value();
					while (iter2.hasNext())
						this.historyStore.remove(this.historyStore.id_of(iter2.next()));
				}
				this.historyStore.insert(Objs.extend({
					type: "remove",
					row_id: id,
					row: data,
					commit_id: this.commitId
				}, this._options.row_data));
			}

		};
	});
});

Scoped.define("module:Stores.WriteStoreMixin", [
                                                "module:Stores.StoreException",                                               
                                                "base:Promise",
                                                "base:IdGenerators.TimedIdGenerator",
                                                "base:Types"
                                                ], function (StoreException, Promise, TimedIdGenerator, Types) {
	return {

		_initializeWriteStore: function (options) {
			options = options || {};
			this._id_key = options.id_key || "id";
			this._create_ids = options.create_ids || false;
			if (this._create_ids)
				this._id_generator = options.id_generator || this._auto_destroy(new TimedIdGenerator());
		},

		id_key: function () {
			return this._id_key;
		},

		id_of: function (row) {
			return row[this.id_key()];
		},
		
		id_row: function (id) {
			var result = {};
			result[this._id_key] = id;
			return result;
		},

		_inserted: function (row, ctx) {
			this.trigger("insert", row, ctx);		
			this.trigger("write", "insert", row, ctx);
		},

		_removed: function (id, ctx) {
			this.trigger("remove", id, ctx);
			this.trigger("write", "remove", id, ctx);
		},

		_updated: function (row, data, ctx) {
			this.trigger("update", row, data, ctx);	
			this.trigger("write", "update", row, data, ctx);
		}, 

		insert_all: function (data, ctx) {
			var promise = Promise.and();
			for (var i = 0; i < data.length; ++i)
				promise = promise.and(this.insert(data[i], ctx));
			return promise.end();
		},

		_insert: function (data, ctx) {
			return Promise.create(null, new StoreException("unsupported: insert"));
		},

		_remove: function (id, ctx) {
			return Promise.create(null, new StoreException("unsupported: remove"));
		},

		_update: function (id, data, ctx) {
			return Promise.create(null, new StoreException("unsupported: update"));
		},

		insert: function (data, ctx) {
			if (!data)
				return Promise.create(null, new StoreException("empty insert"));
			if (this._create_ids && !(this._id_key in data && data[this._id_key]))
				data[this._id_key] = this._id_generator.generate();
			return this._insert(data, ctx).success(function (row) {
				this._inserted(row, ctx);
			}, this);
		},

		remove: function (id, ctx) {
			return this._remove(id, ctx).success(function () {
				this._removed(id, ctx);
			}, this);
		},

		update: function (id, data, ctx) {
			return this._update(id, data, ctx).success(function (row) {
				this._updated(row, data, ctx);
			}, this);
		},
		
		unserialize: function (arr, ctx) {
			return this.insert_all(arr, ctx);
		}

	};
});


Scoped.define("module:Stores.WriteStore", [
                                           "base:Class",
                                           "base:Events.EventsMixin",
                                           "module:Stores.WriteStoreMixin"
                                           ], function (Class, EventsMixin, WriteStoreMixin, scoped) {
	return Class.extend({scoped: scoped}, [EventsMixin, WriteStoreMixin, function (inherited) {			
		return {

			constructor: function (options) {
				inherited.constructor.call(this);
				this._initializeWriteStore(options);
			},

			_ensure_index: function (key) {
			},

			ensure_index: function (key) {
				return this._ensure_index(key);
			}

		};
	}]);
});


Scoped.define("module:Stores.AsyncStore", [
                                                 "module:Stores.BaseStore",
                                                 "base:Promise",
                                                 "base:Async"
                                                 ], function (BaseStore, Promise, Async, scoped) {
	return BaseStore.extend({scoped: scoped}, function (inherited) {			
		return {

			constructor: function (store, options) {
				this.__store = store;
				options = options || {};
				options.id_key = store.id_key();
				inherited.constructor.call(this, options);
				this.__time = options.time || 0;
				if (options.destroy_store)
					this._auto_destroy(store);
			},

			_query_capabilities: function () {
				return this.__store._query_capabilities();
			},
			
			__async: function (f, args) {
				var promise = Promise.create();
				Async.eventually(function () {
					f.apply(this.__store, args).forwardCallback(promise);
				}, this, this.__time);
				return promise;
			},

			_insert: function () {
				return this.__async(this.__store.insert, arguments);
			},

			_remove: function () {
				return this.__async(this.__store.remove, arguments);
			},

			_get: function () {
				return this.__async(this.__store.get, arguments);
			},

			_update: function () {
				return this.__async(this.__store.update, arguments);
			},

			_query: function () {
				return this.__async(this.__store.query, arguments);
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


Scoped.define("module:Stores.ContextualizedStore", [
                                                 "module:Stores.BaseStore",
                                                 "base:Iterators.MappedIterator",
                                                 "base:Promise"
                                                 ], function (BaseStore, MappedIterator, Promise, scoped) {
	return BaseStore.extend({scoped: scoped}, function (inherited) {			
		return {

			constructor: function (store, options) {
				this.__store = store;
				options = options || {};
				options.id_key = store.id_key();
				this.__context = options.context || this;
				this.__decode = options.decode;
				this.__encode = options.encode;
				inherited.constructor.call(this, options);
				if (options.destroy_store)
					this._auto_destroy(store);
			},
			
			_decode: function (data) {
				return this.__decode.call(this.__context, data);
			},
			
			_encode: function (data, ctx) {
				return this.__encode.call(this.__context, data, ctx);
			},
			
			_decodeId: function (id) {
				var result = this._decode(this.id_row(id));
				return {
					id: this.id_of(result.data),
					ctx: result.ctx
				};
			},

			_query_capabilities: function () {
				return this.__store._query_capabilities();
			},

			_insert: function (data) {
				var decoded = this._decode(data);
				return this.__store.insert(decoded.data, decoded.ctx).mapSuccess(function (data) {
					return this._encode(data, decoded.ctx);
				}, this);
			},

			_remove: function (id) {
				var decoded = this._decodeId(id);
				return this.__store.remove(decoded.id, decoded.ctx).mapSuccess(function () {
					return id;
				}, this);
			},

			_get: function (id) {
				var decoded = this._decodeId(id);
				return this.__store.get(decoded.id, decoded.ctx).mapSuccess(function (data) {
					return this._encode(data, decoded.ctx);
				}, this);
			},

			_update: function (id, data) {
				var decoded = this._decodeId(id);
				this.__store.update(decoded.id, data, decoded.ctx).mapSuccess(function (row) {
					return row;
				}, this);
			},

			_query: function (query, options) {
				var decoded = this._decode(query);
				return this.__store.query(decoded.data, options, decoded.ctx).mapSuccess(function (results) {
					return new MappedIterator(results, function (row) {
						return this._encode(row, decoded.ctx);
					}, this);
				}, this);
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



Scoped.define("module:Stores.DecontextualizedSelectStore", [
	"module:Stores.BaseStore",
	"base:Iterators.MappedIterator",
	"base:Promise",
	"base:Objs"
], function (BaseStore, MappedIterator, Promise, Objs, scoped) {
   	return BaseStore.extend({scoped: scoped}, function (inherited) {			
   		return {

   			constructor: function (store, options) {
   				this.__store = store;
   				options = options || {};
   				options.id_key = store.id_key();
   				inherited.constructor.call(this, options);
   				if (options.destroy_store)
   					this._auto_destroy(store);
   			},
   			
   			_decode: function (data, ctx) {
   				data = Objs.clone(data, 1);
   				Objs.iter(ctx, function (value, key) {
   					delete data[key];
   				});
   				return data;
   			},
   			
   			_encode: function (data, ctx) {
   				return Objs.extend(Objs.clone(data, 1), ctx);
   			},
   			
   			_query_capabilities: function () {
   				return this.__store._query_capabilities();
   			},

   			_insert: function (data, ctx) {
   				return this.__store.insert(this._encode(data, ctx)).mapSuccess(function (data) {
   					return this._decode(data, ctx);
   				}, this);
   			},

   			_query: function (query, options, ctx) {
   				return this.__store.query(this._encode(query, ctx), options).mapSuccess(function (results) {
   					return new MappedIterator(results, function (row) {
   						return this._decode(row, ctx);
   					}, this);
   				}, this);
   			},

   			_ensure_index: function (key) {
   				return this.__store.ensure_index(key);
   			},

   			_store: function () {
   				return this.__store;
   			},

   			_get: function (id, ctx) {
   				return this.query(this.id_row(id), {limit: 1}, ctx).mapSuccess(function (rows) {
   					if (!rows.hasNext())
   						return null;
   					return this._decode(rows.next(), ctx);
   				}, this);
   			},

   			_remove: function (id, ctx) {
   				return this.query(this.id_row(id), {limit: 1}, ctx).mapSuccess(function (rows) {
   					if (!rows.hasNext())
   						return null;
   					return this.__store.remove(this.__store.id_of(this._decode(rows.next(), ctx)));
   				}, this);
   			},

   			_update: function (id, data, ctx) {
   				return this.query(this.id_row(id), {limit: 1}, ctx).mapSuccess(function (rows) {
   					if (!rows.hasNext())
   						return null;
   					return this.__store.update(this.__store.id_of(this._decode(rows.next(), ctx)), data);
   				}, this);
   			}

   		};
   	});
});


Scoped.define("module:Stores.KeyMapStore", ["module:Stores.TransformationStore", "base:Objs"], function (TransformationStore, Objs, scoped) {
	return TransformationStore.extend({scoped: scoped}, function (inherited) {			
		return {
			
			constructor: function (store, options, map) {
				inherited.constructor.call(this, store, options);
				this.__encodeMap = map;
				this.__decodeMap = Objs.inverseKeyValue(map);
			},
			
			__mapBy: function (data, map) {
				var result = {};
				Objs.iter(data, function (value, key) {
					result[map[key] || key] = value;
				});
				return result;
			},
			
			_encodeData: function (data) {
				return this.__mapBy(data, this.__encodeMap);
			},
			
			_decodeData: function (data) {
				return this.__mapBy(data, this.__decodeMap);
			}

		};
	});
});

Scoped.define("module:Stores.MultiplexerStore", [
                                                 "module:Stores.BaseStore",
                                                 "module:Queries.Constrained",
                                                 "base:Promise"
                                                 ], function (BaseStore, Constrained, Promise, scoped) {
	return BaseStore.extend({scoped: scoped}, function (inherited) {			
		return {

			constructor: function (options) {
				inherited.constructor.call(this, options);
				this.__context = options.context || this;
				this.__acquireStore = options.acquireStore;
				this.__releaseStore = options.releaseStore;
				this.__mapContext = options.mapContext;
			},
			
			_acquireStore: function (ctx) {
				return Promise.value(this.__acquireStore ? this.__acquireStore.call(this.__context, ctx) : ctx);
			},
			
			_releaseStore: function (ctx, store) {
				if (this.__releaseStore)
					this.__releaseStore.call(this.__context, ctx, store);
			},
			
			_mapContext: function (ctx) {
				return this.__mapContext ? this.__mapContext.call(this.__context, ctx) : null;
			},

			_query_capabilities: function () {
				return Constrained.fullConstrainedQueryCapabilities();
			},

			_insert: function (data, ctx) {
				return this._acquireStore(ctx).mapSuccess(function (store) {
					return store.insert(data, this._mapContext(ctx)).callback(function () {
						this._releaseStore(ctx, store);
					}, this);
				}, this);
			},
			
			_remove: function (id, ctx) {
				return this._acquireStore(ctx).mapSuccess(function (store) {
					return store.remove(id, this._mapContext(ctx)).callback(function () {
						this._releaseStore(ctx, store);
					}, this);
				}, this);
			},

			_update: function (id, data, ctx) {
				return this._acquireStore(ctx).mapSuccess(function (store) {
					return store.update(id, data, this._mapContext(ctx)).callback(function () {
						this._releaseStore(ctx, store);
					}, this);
				}, this);
			},

			_get: function (id, ctx) {
				return this._acquireStore(ctx).mapSuccess(function (store) {
					return store.get(id, this._mapContext(ctx)).callback(function () {
						this._releaseStore(ctx, store);
					}, this);
				}, this);
			},
			
			_query: function (query, options, ctx) {
				return this._acquireStore(ctx).mapSuccess(function (store) {
					return store.query(query, options, this._mapContext(ctx)).callback(function () {
						this._releaseStore(ctx, store);
					}, this);
				}, this);
			}

		};
	});
});


Scoped.define("module:Stores.PassthroughStore", [
                                                 "module:Stores.BaseStore",
                                                 "base:Promise"
                                                 ], function (BaseStore, Promise, scoped) {
	return BaseStore.extend({scoped: scoped}, function (inherited) {			
		return {

			constructor: function (store, options) {
				this.__store = store;
				options = options || {};
				options.id_key = options.id_key || store.id_key();
				inherited.constructor.call(this, options);
				if (options.destroy_store)
					this._auto_destroy(store);
				this.delegateEvents(["insert", "update", "remove"], this.__store);
			},

			_query_capabilities: function () {
				return this.__store._query_capabilities();
			},

			_insert: function (data) {
				return this._preInsert(data).mapSuccess(function (data) {
					return this.__store.insert(data).mapSuccess(function (data) {
						return this._postInsert(data);
					}, this);
				}, this);
			},

			_remove: function (id) {
				return this._preRemove(id).mapSuccess(function (id) {
					return this.__store.remove(id).mapSuccess(function () {
						return this._postRemove(id);
					}, this);
				}, this);
			},

			_get: function (id) {
				return this._preGet(id).mapSuccess(function (id) {
					return this.__store.get(id).mapSuccess(function (data) {
						return this._postGet(data);
					}, this);
				}, this);
			},

			_update: function (id, data) {
				return this._preUpdate(id, data).mapSuccess(function (args) {
					return this.__store.update(args.id, args.data).mapSuccess(function (row) {
						return this._postUpdate(row);
					}, this);
				}, this);
			},

			_query: function (query, options) {
				return this._preQuery(query, options).mapSuccess(function (args) {
					return this.__store.query(args.query, args.options).mapSuccess(function (results) {
						return this._postQuery(results);
					}, this);
				}, this);
			},

			unserialize: function (data) {
				return this._preUnserialize(data).mapSuccess(function (data) {
					return this.__store.unserialize(data).mapSuccess(function (data) {
						return this._postUnserialize(data);
					}, this);
				}, this);
			},

			serialize: function (data) {
				return this._preSerialize(data).mapSuccess(function (data) {
					return this.__store.serialize(data).mapSuccess(function (data) {
						return this._postSerialize(data);
					}, this);
				}, this);
			},

			_ensure_index: function (key) {
				return this.__store.ensure_index(key);
			},

			_store: function () {
				return this.__store;
			},

			_preInsert: function (data) {
				return Promise.value(data);
			},
			
			_postInsert: function (data) {
				return Promise.value(data);
			},
			
			_preRemove: function (id) {
				return Promise.value(id);
			},
			
			_postRemove: function (id) {
				return Promise.value(true);
			},
			
			_preGet: function (id) {
				return Promise.value(id);
			},
			
			_postGet: function (data) {
				return Promise.value(data);
			},

			_preUpdate: function (id, data) {
				return Promise.value({id: id, data: data});
			},
			
			_postUpdate: function (row) {
				return Promise.value(row);
			},
			
			_preQuery: function (query, options) {
				return Promise.value({query: query, options: options});
			},
			
			_postQuery: function (results) {
				return Promise.value(results);
			},
			
			_preSerialize: function (data) {
				return Promise.value(data);
			},
			
			_postSerialize: function (data) {
				return Promise.value(data);
			},
			
			_preUnserialize: function (data) {
				return Promise.value(data);
			},
			
			_postUnserialize: function (data) {
				return Promise.value(data);
			},
			
			watcher: function () {
				return this.__store.watcher();
			}

		};
	});
});


Scoped.define("module:Stores.ReadyStore", [
                                               "module:Stores.PassthroughStore",
                                               "base:Promise",
                                               "base:Objs"
                                               ], function (PassthroughStore, Promise, Objs, scoped) {
	return PassthroughStore.extend({scoped: scoped}, function (inherited) {			
		return {
			
			__ready: false,
			
			ready: function () {
				this.__ready = true;
				Objs.iter(this.__promises, function (rec) {
					rec.promise.forwardCallback(rec.stalling);
				});
				delete this.__promises;
			},
			
			__execute: function (promise) {
				if (this.__ready)
					return promise;
				var stalling = Promise.create();
				this.__promises = this.__promises || [];
				this.__promises.push({
					stalling: stalling,
					promise: promise
				});
				return stalling;
			},

			_preInsert: function () {
				return this.__execute(inherited._preInsert.apply(this, arguments));
			},
			
			_preRemove: function () {
				return this.__execute(inherited._preRemove.apply(this, arguments));
			},
			
			_preGet: function () {
				return this.__execute(inherited._preGet.apply(this, arguments));
			},
			
			_preUpdate: function () {
				return this.__execute(inherited._preUpdate.apply(this, arguments));
			},
			
			_preQuery: function () {
				return this.__execute(inherited._preQuery.apply(this, arguments));
			},
			
			_preSerialize: function () {
				return this.__execute(inherited._preSerialize.apply(this, arguments));
			},
			
			_preUnserialize: function () {
				return this.__execute(inherited._preUnserialize.apply(this, arguments));
			}
			
		};
	});
});


Scoped.define("module:Stores.ResilientStore", [
                                                 "module:Stores.BaseStore",
                                                 "base:Promise"
                                                 ], function (BaseStore, Promise, scoped) {
	return BaseStore.extend({scoped: scoped}, function (inherited) {			
		return {

			constructor: function (store, options) {
				this.__store = store;
				options = options || {};
				options.id_key = store.id_key();
				inherited.constructor.call(this, options);
				this._resilience = options.resilience || 10;
				if (options.destroy_store)
					this._auto_destroy(store);
			},

			_query_capabilities: function () {
				return this.__store._query_capabilities();
			},

			_insert: function () {
				return Promise.resilientCall(this._store.insert, this._store, this._resilience, arguments);
			},

			_remove: function () {
				return Promise.resilientCall(this._store.remove, this._store, this._resilience, arguments);
			},

			_get: function () {
				return Promise.resilientCall(this._store.get, this._store, this._resilience, arguments);
			},

			_update: function (id, data) {
				return Promise.resilientCall(this._store.update, this._store, this._resilience, arguments);
			},

			_query: function (query, options) {
				return Promise.resilientCall(this._store.update, this._store, this._resilience, arguments);
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


Scoped.define("module:Stores.SimulatorStore", [
                                               "module:Stores.PassthroughStore",
                                               "base:Promise"
                                               ], function (PassthroughStore, Promise, scoped) {
	return PassthroughStore.extend({scoped: scoped}, function (inherited) {			
		return {
			
			online: true,

			_preInsert: function () {
				return this.online ? inherited._preInsert.apply(this, arguments) : Promise.error("Offline");
			},
			
			_preRemove: function () {
				return this.online ? inherited._preRemove.apply(this, arguments) : Promise.error("Offline");
			},
			
			_preGet: function () {
				return this.online ? inherited._preGet.apply(this, arguments) : Promise.error("Offline");
			},
			
			_preUpdate: function () {
				return this.online ? inherited._preUpdate.apply(this, arguments) : Promise.error("Offline");
			},
			
			_preQuery: function () {
				return this.online ? inherited._preQuery.apply(this, arguments) : Promise.error("Offline");
			}
			
		};
	});
});


Scoped.define("module:Stores.TableStore", [
    "module:Stores.BaseStore",
    "base:Iterators.MappedIterator",
    "module:Queries.Constrained"
], function (BaseStore, MappedIterator, Constrained, scoped) {
	return BaseStore.extend({scoped: scoped}, function (inherited) {			
		return {

			constructor: function (table, options) {
				this.__table = table;
				options = options || {};
				options.id_key = table.primary_key();
				inherited.constructor.call(this, options);
				this.__options = {
					insertTags: options.insertTags || [],
					readTags: options.readTags || [],
					updateTags: options.updateTags || []
				};
			},

			_query_capabilities: function () {
				return Constrained.fullConstrainedQueryCapabilities();
			},

			_insert: function (data, ctx) {
				var model = this.__table.newModel({}, null, ctx);
				model.setByTags(data, this.__options.insertTags);
				return model.save().mapSuccess(function () {
					return model.asRecord(this.__options.readTags);
				}, this);
			},

			_remove: function (id, ctx) {
				return this.__table.findById(id, ctx).mapSuccess(function (model) {
					return model ? model.remove() : model;
				}, this);
			},

			_get: function (id, ctx) {
				return this.__table.findById(id, ctx).mapSuccess(function (model) {
					return model ? model.asRecord(this.__options.readTags) : model;
				}, this);
			},

			_update: function (id, data, ctx) {
				return this.__table.findById(id, ctx).mapSuccess(function (model) {
					if (!model)
						return model;
					model.setByTags(data, this.__options.updateTags);
					return model.save().mapSuccess(function () {
						return model.asRecord(this.__options.readTags);
					}, this);
				}, this);
			},

			_query: function (query, options, ctx) {
				return this.__table.query(query, options, ctx).mapSuccess(function (models) {
					return new MappedIterator(models, function (model) {
						return model.asRecord(this.__options.readTags);
					}, this);
				}, this);
			}

		};
	});
});



Scoped.define("module:Stores.TransformationStore", [
                                                 "module:Stores.PassthroughStore",
                                                 "module:Queries",
                                                 "base:Iterators.MappedIterator",
                                                 "base:Objs",
                                                 "base:Types",
                                                 "base:Promise"
                                                 ], function (PassthroughStore, Queries, MappedIterator, Objs, Types, Promise, scoped) {
	return PassthroughStore.extend({scoped: scoped}, function (inherited) {			
		return {
			
			_encodeData: function (data) {
				return data;
			},
			
			_decodeData: function (data) {
				return data;
			},
			
			_encodeSort: function (sort) {
				return this._encodeData(sort);
			},
			
			_encodeId: function (id) {
				return this.id_of(this._encodeData(Objs.objectBy(this.id_key(), id)));
			},
			
			_decodeId: function (id) {
				return this.id_of(this._decodeData(Objs.objectBy(this.id_key(), id)));
			},
			
			_encodeQuery: function (query, options) {
				var opts = Objs.clone(options);
				if (opts.sort)
					opts.sort = Types.is_object(opts.sort) ? this._encodeSort(opts.sort) : {};
				return {
					query: Queries.mapKeyValue(query, function (key, value) {
						return this._encodeData(Objs.objectBy(key, value)); 
					}, this),
					options: opts
				};
			},

			_preInsert: function (data) {
				return Promise.create(this._encodeData(data));
			},
			
			_postInsert: function (data) {
				return Promise.create(this._decodeData(data));
			},
			
			_preRemove: function (id) {
				return Promise.create(this._encodeId(id));
			},
			
			_postRemove: function (id) {
				return Promise.create(true);
			},
			
			_preGet: function (id) {
				return Promise.create(this._encodeId(id));
			},
			
			_postGet: function (data) {
				return Promise.create(this._decodeData(data));
			},

			_preUpdate: function (id, data) {
				return Promise.create({id: this._encodeId(id), data: this._encodeData(data)});
			},
			
			_postUpdate: function (row) {
				return Promise.create(this._decodeData(row));
			},
			
			_preQuery: function (query, options) {
				return Promise.create(this._encodeQuery(query, options));
			},
			
			_postQuery: function (results) {
				return Promise.create(new MappedIterator(results, function (data) {
					return this._decodeData(data);
				}, this));
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
									return this.__id <= last_id;
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

//Stores everything permanently in the browser's local storage

Scoped.define("module:Stores.LocalStore", ["module:Stores.AssocDumbStore"], function (AssocDumbStore, scoped) {
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

Scoped.define("module:Stores.Invokers.RestInvokeeAjaxInvoker", [
    "base:Class",
    "base:Net.Uri",
    "base:Net.HttpHeader",
    "module:Stores.Invokers.RestInvokee"
], function (Class, Uri, HttpHeader, Invokee, scoped) {
	return Class.extend({scoped: scoped}, [Invokee, function (inherited) {
		return {
			
			constructor: function (ajax) {
				inherited.constructor.call(this);
				this.__ajax = ajax;
			},
			
			restInvoke: function (method, uri, post, get) {
				return this.__ajax.asyncCall({
					method: method,
					data: post,
					uri: Uri.appendUriParams(uri, get)
				}).mapError(function (error) {
					return {
						error: error.status_code(),
						data: error.data(),
						invalid: error.status_code() === HttpHeader.HTTP_STATUS_PRECONDITION_FAILED
					};
				}, this);
			}			
			
		};
	}]);
});
Scoped.define("module:Stores.Invokers.StoreInvokee", [], function () {
	return {
		storeInvoke: function (member, data, context) {}
	};
});


Scoped.define("module:Stores.Invokers.RestInvokee", [], function () {
	return {
		restInvoke: function (method, uri, post, get, ctx) {}
	};
});


Scoped.define("module:Stores.Invokers.RouteredRestInvokee", [], function () {
	return {
		routeredRestInvoke: function (member, uriData, post, get, ctx) {}
	};
});



Scoped.define("module:Stores.Invokers.InvokerStore", [
    "module:Stores.BaseStore",
    "module:Queries.Constrained"
], function (BaseStore, Constrained, scoped) {
	return BaseStore.extend({scoped: scoped}, function (inherited) {			
		return {
			
			constructor: function (storeInvokee, options) {
				inherited.constructor.call(this, options);
				this.__storeInvokee = storeInvokee;
			},
			
			_query_capabilities: function () {
				return Constrained.fullConstrainedQueryCapabilities();
			},
			
			__invoke: function (member, data, context) {
				return this.__storeInvokee.storeInvoke(member, data, context);
			},

			_insert: function (data, ctx) {
				return this.__invoke("insert", data, ctx);
			},

			_remove: function (id, ctx) {
				return this.__invoke("remove", id, ctx);
			},

			_get: function (id, ctx) {
				return this.__invoke("get", id, ctx);
			},

			_update: function (id, data, ctx) {
				return this.__invoke("update", {
					id: id,
					data: data
				}, ctx);
			},

			_query: function (query, options, ctx) {
				return this.__invoke("query", {
					query: query,
					options: options
				}, ctx);
			}

		};
	});
});




Scoped.define("module:Stores.Invokers.StoreInvokeeInvoker", ["base:Class", "module:Stores.Invokers.StoreInvokee"], function (Class, Invokee, scoped) {
	return Class.extend({scoped: scoped}, [Invokee, function (inherited) {		
		return {
					
			constructor: function (store) {
				inherited.constructor.apply(this);
				this.__store = store;
			},
			
			storeInvoke: function (member, data, context) {
				return this["__" + member](data, context);
			},
			
			__insert: function (data, context) {
				return this.__store.insert(data, context);
			},
		
			__remove: function (id, context) {
				return this.__store.remove(id, context);
			},

			__get: function (id, context) {
				return this.__store.get(id, context);
			},

			__update: function (data, context) {
				return this.__store.update(data.id, data.data, context);
			},

			__query: function (data, context) {
				return this.__store.query(data.query, data.options, context);
			}

		};
	}]);
});
Scoped.define("module:Stores.Invokers.StoreInvokeeRestInvoker", [
    "base:Class",
    "base:Objs",
    "base:Types",
    "module:Stores.Invokers.StoreInvokee"
], function (Class, Objs, Types, Invokee, scoped) {
	return Class.extend({scoped: scoped}, [Invokee, function (inherited) {
		return {
			
			constructor: function (restInvokee, options) {
				inherited.constructor.call(this);
				this.__restInvokee = restInvokee;
				this.__options = Objs.tree_extend({
					methodMap: {
						"insert": "POST",
						"get": "GET",
						"remove": "DELETE",
						"update": "PUT",
						"query": "GET" 
					},
					toMethod: null,
					dataMap: {
						"insert": function (data, context) { return data; },
						"update": function (data, context) { return data.data; }
					},
					toData: null,
					getMap: {
						"query": function (data, context) {
							var result = {};
							if (data.query && !Types.is_empty(data.query))
								result.query = JSON.stringify(data.query);
							result = Objs.extend(result, data.options);
							if (result.sort)
								result.sort = JSON.stringify(result.sort);
							return result;
						}
					},
					toGet: null,
					baseURI: "/",
					uriMap: {
						"get": function (id, context) { return id; },
						"remove": function (id, context) { return id; },
						"update": function (data, context) { return data.id; }
					},
					toURI: null,
					context: this
				}, options);
			},
			
			storeInvoke: function (member, data, context) {
				return this.__restInvokee.restInvoke(
					this._toMethod(member, data, context),
					this._toURI(member, data, context),
					this._toData(member, data, context),
					this._toGet(member, data, context)
				);
			},
			
			_toMethod: function (member, data, context) {
				var method = null;
				if (this.__options.toMethod)
					method = this.__options.toMethod.call(this.__options.context, member, data, context);
				return method || this.__options.methodMap[member];
			},
			
			_toURI: function (member, data, context) {
				var base = Types.is_function(this.__options.baseURI) ? this.__options.baseURI.call(this.__options.context, context) : this.__options.baseURI;
				if (this.__options.toURI) {
					var ret = this.__options.toURI.call(this.__options.context, member, data, context);
					if (ret)
						return base + ret;
				}
				return base + (member in this.__options.uriMap ? (Types.is_function(this.__options.uriMap[member]) ? this.__options.uriMap[member].call(this.__options.context, data, context): this.__options.uriMap[member]) : "");
			},
			
			_toData: function (member, data, context) {
				var result = null;
				if (this.__options.toData)
					result = this.__options.toData.call(this.__options.context, member, data, context);
				return result || (member in this.__options.dataMap ? this.__options.dataMap[member].call(this.__options.context, data, context) : null);
			},
			
			_toGet: function (member, data, context) {
				var result = null;
				if (this.__options.toGet)
					result = this.__options.toGet.call(this.__options.context, member, data, context);
				return result || (member in this.__options.getMap ? this.__options.getMap[member].call(this.__options.context, data, context) : null);
			}
			
			
		};
	}]);
});


Scoped.define("module:Stores.Invokers.RouteredRestInvokeeStoreInvoker", [
     "base:Class",
     "base:Objs",
     "base:Types",
     "module:Stores.Invokers.RouteredRestInvokee"
 ], function (Class, Objs, Types, Invokee, scoped) {
 	return Class.extend({scoped: scoped}, [Invokee, function (inherited) {
 		return {

			constructor: function (storeInvokee, options) {
				inherited.constructor.call(this);
				this.__storeInvokee = storeInvokee;
				this.__options = Objs.tree_extend({
					dataMap: {
						"insert": function (member, uriData, post, get, ctx) {
							return post;
						},
						"update": function (member, uriData, post, get, ctx) {
							return {
								id: uriData.id,
								data: post
							};
						},
						"get": function (member, uriData, post, get, ctx) {
							return uriData.id;
						},
						"remove": function (member, uriData, post, get, ctx) {
							return uriData.id;
						},
						"query": function (member, uriData, post, get, ctx) {
							var result = {};
							try {
								if (get.query)
									result.query = JSON.parse(get.query);
							} catch (e) {}
							var opts = Objs.clone(get, 1);
							delete opts.query;
							if (!Types.is_empty(opts))
								result.options = opts;
							try {
								if (result.options.sort)
									result.options.sort = JSON.parse(result.options.sort);
							} catch (e) {}
							return result;
						}
					},
					toData: null,
					contextMap: {},
					toContext: function (member, uriData, post, get, ctx) {
						return ctx;
					},
					context: this
				}, options);
			},
			
			routeredRestInvoke: function (member, uriData, post, get, ctx) {
				return this.__storeInvokee.storeInvoke(
					member,
					this._toData(member, uriData, post, get, ctx),
					this._toContext(member, uriData, post, get, ctx)
				);
 			},
 			
 			_toData: function (member, uriData, post, get, ctx) {
				var data = null;
				if (this.__options.toData)
					data = this.__options.toData.call(this.__options.context, member, uriData, post, get, ctx);
				return data || (member in this.__options.dataMap ? this.__options.dataMap[member].call(this.__options.context, member, uriData, post, get, ctx) : null);
 			},
 			
 			_toContext: function (member, uriData, post, get, ctx) {
				var data = null;
				if (this.__options.toContext)
					data = this.__options.toContext.call(this.__options.context, member, uriData, post, get, ctx);
				return data || (member in this.__options.contextMap ? this.__options.contextMap[member].call(this.__options.context, member, uriData, post, get, ctx) : null);
 			}
 		
		};
	}]);
});


Scoped.define("module:Stores.Invokers.RestInvokeeStoreInvoker", [
     "module:Stores.Invokers.RouteredRestInvokeeStoreInvoker",
     "module:Stores.Invokers.RestInvokee",
     "base:Router.RouteParser",
     "base:Objs",
     "base:Types"
 ], function (Class, Invokee, RouteParser, Objs, Types, scoped) {
 	return Class.extend({scoped: scoped}, [Invokee, function (inherited) {
 		return {
 			
			constructor: function (storeInvokee, options) {
				inherited.constructor.call(this, storeInvokee, Objs.tree_extend({
					baseURI: "/",
					methodMap: {
						"insert": "POST",
						"get": "GET",
						"remove": "DELETE",
						"update": "PUT",
						"query": "GET" 
					},
					toMethod: null,
					uriMap: {
						"get": "(id:.+)",
						"remove": "(id:.+)",
						"update": "(id:.+)"
					},
					toURI: null
				}, options));
				this.__routes = {};
				Objs.iter(this.__options.methodMap, function (method, member) {
					var s = "";
					var base = Types.is_function(this.__options.baseURI) ? this.__options.baseURI.call(this.__options.context) : this.__options.baseURI;
					if (this.__options.toURI) {
						var ret = this.__options.toURI.call(this.__options.context, member);
						if (ret)
							s = base + ret;
					}
					if (!s)
						s = base + (member in this.__options.uriMap ? (Types.is_function(this.__options.uriMap[member]) ? this.__options.uriMap[member].call(this.__options.context): this.__options.uriMap[member]) : "");
					this.__routes[member] = method + " " + s;
				}, this);
				this.__routeParser = this.auto_destroy(new RouteParser(this.__routes));
			},
			
 			restInvoke: function (method, uri, post, get, ctx) {
 				var routed = this.__routeParser.parse(method + " " + uri);
 				return this.routeredRestInvoke(routed.name, routed.args, post, get, ctx);
 			}
			
		};
	}]);
});

/*
 * Very important to know:
 *  - If both itemCache + remoteStore use the same id_key, the keys actually coincide.
 *  - If they use different keys, the cache stores the remoteStore keys as a foreign key and assigns its own keys to the cached items
 *
 */

Scoped.define("module:Stores.CachedStore", [
	"module:Stores.BaseStore",
	"module:Stores.MemoryStore",
	"module:Queries",
	"module:Queries.Constrained",
	"module:Stores.CacheStrategies.ExpiryCacheStrategy",
	"base:Promise",
	"base:Objs",
	"base:Types",
	"base:Iterators.ArrayIterator",
	"base:Iterators.MappedIterator",
	"base:Timers.Timer"
], function (Store, MemoryStore, Queries, Constrained, ExpiryCacheStrategy, Promise, Objs, Types, ArrayIterator, MappedIterator, Timer, scoped) {
	return Store.extend({scoped: scoped}, function (inherited) {
		return {

			constructor: function (remoteStore, options) {
				inherited.constructor.call(this);
				this.remoteStore = remoteStore;
				this._options = Objs.extend({
					itemMetaKey: "meta",
					queryMetaKey: "meta",
					queryKey: "query",
					cacheKey: null,
					suppAttrs: {},
					optimisticRead: false
				}, options);
				this._online = true;
				this.itemCache = this._options.itemCache || this.auto_destroy(new MemoryStore({
					id_key: this._options.cacheKey || this.remoteStore.id_key()
				}));
				this._options.cacheKey = this.itemCache.id_key();
				this._id_key = this.itemCache.id_key();
				this._foreignKey = this.itemCache.id_key() !== this.remoteStore.id_key();
				this.queryCache = this._options.queryCache || this.auto_destroy(new MemoryStore());
				this.cacheStrategy = this._options.cacheStrategy || this.auto_destroy(new ExpiryCacheStrategy());
				if (this._options.auto_cleanup) {
					this.auto_destroy(new Timer({
						fire: this.cleanup,
						context: this,
						start: true,
						delay: this._options.auto_cleanup
					}));
				}
			},

			_query_capabilities: function () {
				return Constrained.fullConstrainedQueryCapabilities();
			},

			_insert: function (data, ctx) {
				return this.cacheInsert(data, {
					lockItem: true,
					silent: true,
					refreshMeta: false,
					accessMeta: true
				}, ctx);
			},

			_update: function (id, data, ctx) {
				return this.cacheUpdate(id, data, {
					ignoreLock: false,
					silent: true,
					lockAttrs: true,
					refreshMeta: false,
					accessMeta: true
				}, ctx);
			},

			_remove: function (id, ctx) {
				return this.cacheRemove(id, {
					ignoreLock: true,
					silent: true
				}, ctx);
			},

			_get: function (id, ctx) {
				return this.cacheGet(id, {
					silentInsert: true,
					silentUpdate: true,
					silentRemove: true,
					refreshMeta: true,
					accessMeta: true
				}, ctx);
			},

			_query: function (query, options, ctx) {
				return this.cacheQuery(query, options, {
					silent: true,
					queryRefreshMeta: true,
					queryAccessMeta: true,
					refreshMeta: true,
					accessMeta: true
				}, ctx);
			},

			/*
			 * options:
			 *   - lockItem: boolean
			 *   - silent: boolean
			 *   - refreshMeta: boolean
			 *   - accessMeta: boolean
			 */

			cacheInsert: function (data, options, ctx) {
				var meta = {
					lockedItem: options.lockItem,
					lockedAttrs: {},
					refreshMeta: options.refreshMeta ? this.cacheStrategy.itemRefreshMeta() : null,
					accessMeta: options.accessMeta ? this.cacheStrategy.itemAccessMeta() : null
				};
				return this.itemCache.insert(this.addItemSupp(this.addItemMeta(data, meta)), ctx).mapSuccess(function (result) {
					data = this.removeItemMeta(result);
					if (!options.silent)
						this._inserted(data, ctx);
					return data;
				}, this);
			},

			/*
			 * options:
			 *   - ignoreLock: boolean
			 *   - lockAttrs: boolean
			 *   - silent: boolean
			 *   - accessMeta: boolean
			 *   - refreshMeta: boolean
			 *   - foreignKey: boolean (default false)
			 *   - unlockItem: boolean (default false)
			 */

			cacheUpdate: function (id, data, options, ctx) {
				var foreignKey = options.foreignKey && this._foreignKey;
				var itemPromise = foreignKey ?
					              this.itemCache.getBy(this.remoteStore.id_key(), id, ctx)
					            : this.itemCache.get(id, ctx);
				return itemPromise.mapSuccess(function (item) {
					if (!item)
						return null;
					var meta = this.readItemMeta(item);
					if (options.unlockItem) {
						meta.lockedItem = false;
						meta.lockedAttrs = {};
					}
					data = Objs.filter(data, function (value, key) {
						return options.ignoreLock || (!meta.lockedItem && !meta.lockedAttrs[key]);
					}, this);
					if (Types.is_empty(data))
						return this.removeItemMeta(item);
					if (options.lockAttrs) {
						Objs.iter(data, function (value, key) {
							meta.lockedAttrs[key] = true;
						}, this);
					}
					if (options.refreshMeta)
						meta.refreshMeta = this.cacheStrategy.itemRefreshMeta(meta.refreshMeta);
					if (options.accessMeta)
						meta.accessMeta = this.cacheStrategy.itemAccessMeta(meta.accessMeta);
					return this.itemCache.update(this.itemCache.id_of(item), this.addItemMeta(data, meta), ctx).mapSuccess(function (result) {
						result = this.removeItemMeta(result);
						if (!options.silent)
							this._updated(result, data, ctx);
						return result;
					}, this);
				}, this);
			},

			cacheInsertUpdate: function (data, options, ctx) {
				var foreignKey = options.foreignKey && this._foreignKey;
				var itemPromise = foreignKey ?
					              this.itemCache.getBy(this.remoteStore.id_key(), this.remoteStore.id_of(data), ctx)
					            : this.itemCache.get(this.itemCache.id_of(data), ctx);
				return itemPromise.mapSuccess(function (item) {
					options.foreignKey = false;
					return item ? this.cacheUpdate(this.itemCache.id_of(item), data, options, ctx) : this.cacheInsert(data, options, ctx);
				}, this);
			},

			/*
			 * options:
			 *   - ignoreLock: boolean
			 *   - silent: boolean
			 *   - foreignKey: boolean
			 */
			cacheRemove: function (id, options, ctx) {
				var foreignKey = options.foreignKey && this._foreignKey;
				var itemPromise = foreignKey ?
					  this.itemCache.getBy(this.remoteStore.id_key(), id, ctx)
					: this.itemCache.get(id, ctx);
				return itemPromise.mapSuccess(function (data) {
					if (!data)
						return data;
					var meta = this.readItemMeta(data);
					if (!options.ignoreLock && (meta.lockedItem || !Types.is_empty(meta.lockedAttrs)))
						return Promise.error("locked item");
					var cached_id = this.itemCache.id_of(data);
					return this.itemCache.remove(cached_id, ctx).success(function () {
						if (!options.silent)
							this._removed(cached_id, ctx);
					}, this);
				}, this);
			},
			
			cacheOnlyGet: function (id, options, ctx) {
				var foreignKey = options.foreignKey && this._foreignKey;
				var itemPromise = foreignKey ?
					  this.itemCache.getBy(this.remoteStore.id_key(), id, ctx)
					: this.itemCache.get(id, ctx);
				return itemPromise;
			},

			/*
			 * options:
			 *   - silentInsert: boolean
			 *   - silentUpdate: boolean
			 *   - silentRemove: boolean
			 *   - refreshMeta: boolean
			 *   - accessMeta: boolean
			 *   - foreignKey: boolean
			 */
			cacheGet: function (id, options, ctx) {
				var foreignKey = options.foreignKey && this._foreignKey;
				return this.cacheOnlyGet(id, options, ctx).mapSuccess(function (data) {
					if (!data) {
						if (!foreignKey && this._foreignKey)
							return data;
						return this.remoteStore.get(id, ctx).mapSuccess(function (data) {
							this.online();
							if (data) {
								return this.cacheInsert(data, {
									lockItem: false,
									silent: options.silentInsert,
									accessMeta: true,
									refreshMeta: true
								}, ctx);
							} else
								return data;
						}, this);
					}
					var meta = this.readItemMeta(data);
					var cached_id = this.itemCache.id_of(data);
					var remote_id = this.remoteStore.id_of(data);
					if (this.cacheStrategy.validItemRefreshMeta(meta.refreshMeta) || meta.lockedItem) {
						if (options.accessMeta) {
							meta.accessMeta = this.cacheStrategy.itemAccessMeta(meta.accessMeta);
							this.itemCache.update(cached_id, this.addItemMeta({}, meta), ctx);
						}
						return this.removeItemMeta(data);
					}
					return this.remoteStore.get(remote_id, ctx).mapSuccess(function (data) {
						this.online();
						if (data) {
							return this.cacheUpdate(cached_id, data, {
								ignoreLock: false,
								lockAttrs: false,
								silent: options.silentUpdate,
								accessMeta: true,
								refreshMeta: true
							}, ctx);
						} else {
							return this.cacheRemove(cached_id, {
								ignoreLock: false,
								silent: options.silentRemove
							}, ctx);
						}
					}, this).mapError(function () {
						this.offline();
						return Promise.value(data);
					}, this);
				}, this);
			},
			
			__itemCacheQuery: function (query, options, ctx) {
				return this.itemCache.query(query, options, ctx).mapSuccess(function (items) {
					items = items.asArray();
					Objs.iter(items, function (item) {
						this.cacheUpdate(this.itemCache.id_of(item), {}, {
							lockItem: false,
							lockAttrs: false,
							silent: true,
							accessMeta: options.accessMeta,
							refreshMeta: false
						}, ctx);
					}, this);
					return new MappedIterator(new ArrayIterator(items), this.removeItemMeta, this);
				}, this);
			},

			/*
			 * options:
			 *   - silent: boolean
			 *   - queryRefreshMeta: boolean
			 *   - queryAccessMeta: boolean
			 *   - refreshMeta: boolean
			 *   - accessMeta: boolean
			 */
			cacheQuery: function (query, queryOptions, options, ctx) {
				var queryString = Constrained.serialize({
					query: query,
					options: queryOptions
				});
				var localQuery = Objs.objectBy(
					this._options.queryKey,
					queryString
				);
				return this.queryCache.query(localQuery, {limit : 1}, ctx).mapSuccess(function (result) {
					result = result.hasNext() ? result.next() : null;
					if (result) {
						var meta = this.readQueryMeta(result);
						var query_id = this.queryCache.id_of(result);
						if (this.cacheStrategy.validQueryRefreshMeta(meta.refreshMeta)) {
							if (options.queryAccessMeta) {
								meta.accessMeta = this.cacheStrategy.queryAccessMeta(meta.accessMeta);
								this.queryCache.update(query_id, this.addQueryMeta({}, meta), ctx);
							}
							return this.__itemCacheQuery(query, options, ctx);
						}
						this.queryCache.remove(query_id, ctx);
					}
					// Note: This is probably not good enough in the most general cases.
					if (Queries.queryDeterminedByAttrs(query, this._options.suppAttrs))
						return this.itemCache.query(query, options, ctx);
					var remotePromise = this.remoteStore.query(query, queryOptions, ctx).mapSuccess(function (items) {
						this.online();
						items = items.asArray();
						var meta = {
							refreshMeta: options.queryRefreshMeta ? this.cacheStrategy.queryRefreshMeta() : null,
							accessMeta: options.queryAccessMeta ? this.cacheStrategy.queryAccessMeta() : null
						};
						this.queryCache.insert(Objs.objectBy(
							this._options.queryKey, queryString,
							this._options.queryMetaKey, meta
						), ctx);
						var promises = [];
						Objs.iter(items, function (item) {
							promises.push(this.cacheInsertUpdate(item, {
								lockItem: false,
								lockAttrs: false,
								silent: options.silent && !this._options.optimisticRead,
								accessMeta: options.accessMeta,
								refreshMeta: options.refreshMeta,
								foreignKey: true
							}, ctx));
						}, this);
						return Promise.and(promises).mapSuccess(function (items) {
							return new MappedIterator(new ArrayIterator(items), this.addItemSupp, this);
						}, this);
					}, this).mapError(function () {
						this.offline();
						if (!this._options.optimisticRead) {
							return this.__itemCacheQuery(query, options, ctx);
						}
					}, this);
					return this._options.optimisticRead ? this.__itemCacheQuery(query, options, ctx) : remotePromise;
				}, this);
			},

			online: function () {
				this.trigger("online");
				this._online = true;
			},

			offline: function () {
				this.trigger("offline");
				this._online = false;
			},

			addItemMeta: function (data, meta) {
				data = Objs.clone(data, 1);
				data[this._options.itemMetaKey] = meta;
				return data;
			},

			addItemSupp: function (data) {
				return Objs.extend(Objs.clone(this._options.suppAttrs, 1), data);
			},
			
			removeItemSupp: function (data) {
				if (!this._options.suppAttrs)
					return data;
				return Objs.filter(data, function (value, key) {
					return !(key in this._options.suppAttrs);
				}, this);
			},

			addQueryMeta: function (data, meta) {
				data = Objs.clone(data, 1);
				data[this._options.queryMetaKey] = meta;
				return data;
			},

			removeItemMeta: function (data) {
				data = Objs.clone(data, 1);
				delete data[this._options.itemMetaKey];
				return data;
			},

			removeQueryMeta: function (data) {
				data = Objs.clone(data, 1);
				delete data[this._options.queryMetaKey];
				return data;
			},

			readItemMeta: function (data) {
				return data[this._options.itemMetaKey];
			},

			readQueryMeta: function (data) {
				return data[this._options.queryMetaKey];
			},

			unlockItem: function (id, ctx) {
				this.itemCache.get(id, ctx).success(function (data) {
					if (!data)
						return;
					var meta = this.readItemMeta(data);
					meta.lockedItem = false;
					meta.lockedAttrs = {};
					this.itemCache.update(id, this.addItemMeta({}, meta), ctx);
				}, this);
			},

			cleanup: function () {
				if (!this._online)
					return;
				this.queryCache.query().success(function (queries) {
					while (queries.hasNext()) {
						var query = queries.next();
						var meta = this.readQueryMeta(query);
						if (!this.cacheStrategy.validQueryRefreshMeta(meta.refreshMeta) || !this.cacheStrategy.validQueryAccessMeta(meta.accessMeta))
							this.queryCache.remove(this.queryCache.id_of(query));
					}
				}, this);
				this.itemCache.query().success(function (items) {
					while (items.hasNext()) {
						var item = items.next();
						var meta = this.readItemMeta(item);
						if (!meta.lockedItem && Types.is_empty(meta.lockedAttrs) &&
							(!this.cacheStrategy.validItemRefreshMeta(meta.refreshMeta) || !this.cacheStrategy.validItemAccessMeta(meta.accessMeta)))
							this.itemCache.remove(this.itemCache.id_of(item));
					}
				}, this);
			},

			cachedIdToRemoteId: function (cachedId) {
				if (!this._foreignKey)
					return Promise.value(cachedId);
				return this.itemCache.get(cachedId).mapSuccess(function (item) {
					return item ? this.remoteStore.id_of(item) : null;
				}, this);
			},
			
			serialize: function () {
				return this.itemCache.serialize().mapSuccess(function (itemCacheSerialized) {
					return this.queryCache.serialize().mapSuccess(function (queryCacheSerialized) {
						return {
							items: itemCacheSerialized,
							queries: queryCacheSerialized
						};
					}, this);
				}, this);
			},
			
			unserialize: function (data) {
				return this.itemCache.unserialize(data.items).mapSuccess(function (items) {
					this.queryCache.unserialize(data.queries);
					return items.map(function (item) {
						return this.removeItemMeta(item);
					}, this);
				}, this);
			}

		};
	});
});



Scoped.define("module:Stores.CacheStrategies.CacheStrategy", [
                                                              "base:Class"    
                                                              ], function (Class, scoped) {
	return Class.extend({scoped: scoped}, {

		itemRefreshMeta: function (refreshMeta) {},

		queryRefreshMeta: function (refreshMeta) {},

		itemAccessMeta: function (accessMeta) {},

		queryAccessMeta: function (accessMeta) {},

		validItemRefreshMeta: function (refreshMeta) {},

		validQueryRefreshMeta: function (refreshMeta) {},

		validItemAccessMeta: function (accessMeta) {},

		validQueryAccessMeta: function (accessMeta) {}


	});	
});


Scoped.define("module:Stores.CacheStrategies.ExpiryCacheStrategy", [
                                                                    "module:Stores.CacheStrategies.CacheStrategy",
                                                                    "base:Time",
                                                                    "base:Objs"
                                                                    ], function (CacheStrategy, Time, Objs, scoped) {
	return CacheStrategy.extend({scoped: scoped}, function (inherited) {
		return {

			constructor: function (options) {
				inherited.constructor.call(this);
				this._options = Objs.extend({
					itemRefreshTime: 24 * 60 * 1000,
					itemAccessTime: 10 * 60 * 60 * 1000,
					queryRefreshTime: 24 * 60 * 1000,
					queryAccessTime: 10 * 60 * 60 * 1000,
					now: function () {
						return Time.now();
					}
				}, options);
			},

			itemRefreshMeta: function (refreshMeta) {
				if (refreshMeta)
					return refreshMeta;
				if (this._options.itemRefreshTime === null)
					return null;
				return this._options.now() + this._options.itemRefreshTime;
			},

			queryRefreshMeta: function (refreshMeta) {
				if (refreshMeta)
					return refreshMeta;
				if (this._options.queryRefreshTime === null)
					return null;
				return this._options.now() + this._options.queryRefreshTime;
			},

			itemAccessMeta: function (accessMeta) {
				if (this._options.itemAccessTime === null)
					return null;
				return this._options.now() + this._options.itemAccessTime;
			},

			queryAccessMeta: function (accessMeta) {
				if (this._options.queryAccessTime === null)
					return null;
				return this._options.now() + this._options.queryAccessTime;
			},

			validItemRefreshMeta: function (refreshMeta) {
				return this._options.itemRefreshTime === null || refreshMeta >= this._options.now();
			},

			validQueryRefreshMeta: function (refreshMeta) {
				return this._options.queryRefreshTime === null || refreshMeta >= this._options.now();
			},	

			validItemAccessMeta: function (accessMeta) {
				return this._options.itemAccessTime === null || accessMeta >= this._options.now();
			},

			validQueryAccessMeta: function (accessMeta) {
				return this._options.queryAccessTime === null || accessMeta >= this._options.now();
			}

		};
	});	
});
Scoped.define("module:Stores.PartialStore", [
	"module:Stores.BaseStore",
	"module:Stores.CachedStore",
	"module:Stores.PartialStoreWriteStrategies.PostWriteStrategy",
	"module:Stores.PartialStoreWatcher",
	"base:Objs",
	"base:Types"
], function (Store, CachedStore, PostWriteStrategy, PartialStoreWatcher, Objs, Types, scoped) {
	return Store.extend({scoped: scoped}, function (inherited) {			
		return {

			constructor: function (remoteStore, options) {
				inherited.constructor.call(this, options);
				this._options = Objs.extend({}, options);
				if (this._options.remoteWatcher)
					this.remoteWatcher = this._options.remoteWatcher;
				this.remoteStore = remoteStore;
				this.cachedStore = new CachedStore(remoteStore, this._options);
				this.writeStrategy = this._options.writeStrategy || this.auto_destroy(new PostWriteStrategy());
				if (this.remoteWatcher) {
					this.remoteWatcher.on("insert", this._remoteInsert, this);
					this.remoteWatcher.on("update", this._remoteUpdate, this);
					this.remoteWatcher.on("remove", this._remoteRemove, this);
					this._watcher = new PartialStoreWatcher(this);
				}
				this.cachedStore.on("insert", this._inserted, this);
				this.cachedStore.on("remove", this._removed, this);
				this.cachedStore.on("update", this._updated, this);
				this.writeStrategy.init(this);
			},
			
			id_key: function () {
				return this.cachedStore.id_key();
			},
			
			destroy: function () {
				if (this.remoteWatcher)
					this.remoteWatcher.off(null, null, this);
				if (this._watcher)
					this._watcher.destroy();
				this.cachedStore.destroy();
				inherited.destroy.call(this);
			},

			_insert: function (data, ctx) {
				return this.writeStrategy.insert(data, ctx);
			},
			
			_remove: function (id, ctx) {
				return this.writeStrategy.remove(id, ctx);
			},
			
			_update: function (id, data, ctx) {
				return this.cachedStore.cacheOnlyGet(id, {}, ctx).mapSuccess(function (cachedData) {
					var diff = Objs.diff(data, cachedData);
					return Types.is_empty(diff) ? cachedData : this.writeStrategy.update(id, data, ctx);
				}, this);
			},

			_get: function (id, ctx) {
				return this.cachedStore.get(id, ctx);
			},
			
			_query: function (query, options, ctx) {
				return this.cachedStore.query(query, options, ctx);
			},			
			
			_query_capabilities: function () {
				return this.cachedStore._query_capabilities();
			},
			
			_remoteInsert: function (data, ctx) {
				this.cachedStore.cacheInsertUpdate(data, {
					lockItem: false,
					silent: false,
					refreshMeta: true,
					accessMeta: true,
					foreignKey: true
				}, ctx);
			},
			
			_remoteUpdate: function (row, data, ctx) {
				var id = this.remoteStore.id_of(row);
				this.cachedStore.cacheUpdate(id, data, {
					ignoreLock: false,
					lockAttrs: false,
					silent: false,
					accessMeta: true,
					refreshMeta: true,
					foreignKey: true
				}, ctx);
			},
			
			_remoteRemove: function (id, ctx) {
				this.cachedStore.cacheRemove(id, {
					ignoreLock: false,
					silent: false,
					foreignKey: true
				}, ctx);
			},
			
			serialize: function () {
				return this.cachedStore.serialize();
			},
			
			unserialize: function (data) {
				return this.cachedStore.unserialize(data).success(function (items) {
					items.forEach(function (item) {
						this._inserted(item);
					}, this);
				}, this);
			}

		};
	});	
});


Scoped.define("module:Stores.PartialStoreWatcher", [
    "module:Stores.Watchers.LocalWatcher"                                                    
], function (StoreWatcher, scoped) {
	return StoreWatcher.extend({scoped: scoped}, function (inherited) {
		return {
			
			_watchItem : function(id) {
				inherited.watchItem.call(this, id);
				this._store.cachedStore.cachedIdToRemoteId(id).success(function (remoteId) {
					this._store.remoteWatcher.watchItem(remoteId, this);
				}, this);
			},

			_unwatchItem : function(id) {
				inherited.unwatchItem.call(this, id);
				this._store.cachedStore.cachedIdToRemoteId(id).success(function (remoteId) {
					this._store.remoteWatcher.unwatchItem(remoteId, this);
				}, this);
			},

			_watchInsert : function(query) {
				inherited.watchInsert.call(this, query);
				this._store.remoteWatcher.watchInsert(query, this);
			},

			_unwatchInsert : function(query) {
				inherited.unwatchInsert.call(this, query);
				this._store.remoteWatcher.unwatchInsert(query, this);
			}			
			
		};
	});
});
Scoped.define("module:Stores.PartialStoreWriteStrategies.WriteStrategy", [
                                                                          "base:Class"
                                                                          ], function (Class, scoped) {
	return Class.extend({scoped: scoped}, function (inherited) {
		return {
			
			init: function (partialStore) {
				this.partialStore = partialStore;
			},

			insert: function (data, ctx) {},

			remove: function (id, ctx) {},

			update: function (data, ctx) {}

		};
	});
});

Scoped.define("module:Stores.PartialStoreWriteStrategies.PostWriteStrategy", [
                                                                              "module:Stores.PartialStoreWriteStrategies.WriteStrategy"
                                                                              ], function (Class, scoped) {
	return Class.extend({scoped: scoped}, function (inherited) {
		return {

			insert: function (data, ctx) {
				return this.partialStore.remoteStore.insert(data, ctx).mapSuccess(function (data) {
					return this.partialStore.cachedStore.cacheInsert(data, {
						lockItem: false,
						silent: true,
						refreshMeta: true,
						accessMeta: true
					}, ctx);
				}, this);
			},

			remove: function (cachedId, ctx) {
				return this.partialStore.cachedStore.cachedIdToRemoteId(cachedId).mapSuccess(function (remoteId) {
					return this.partialStore.remoteStore.remove(remoteId, ctx).mapSuccess(function () {
						return this.partialStore.cachedStore.cacheRemove(cachedId, {
							ignoreLock: true,
							silent: true
						}, ctx);
					}, this);
				}, this);
			},

			update: function (cachedId, data, ctx) {
				return this.partialStore.cachedStore.cachedIdToRemoteId(cachedId).mapSuccess(function (remoteId) {
					return this.partialStore.remoteStore.update(remoteId, data, ctx).mapSuccess(function () {
						return this.partialStore.cachedStore.cacheUpdate(cachedId, data, {
							ignoreLock: false,
							lockAttrs: false,
							silent: true,
							refreshMeta: true,
							accessMeta: true
						}, ctx);
					}, this);
				});
			}

		};
	});
});


Scoped.define("module:Stores.PartialStoreWriteStrategies.PreWriteStrategy", [
    "module:Stores.PartialStoreWriteStrategies.WriteStrategy",
    "base:Objs"
], function (Class, Objs, scoped) {
	return Class.extend({scoped: scoped}, function (inherited) {
		return {

			insert: function (data) {
				return this.partialStore.cachedStore.cacheInsert(data, {
					lockItem: true,
					silent: true,
					refreshMeta: true,
					accessMeta: true
				}).mapSuccess(function (data) {
					nosuppdata = this.partialStore.cachedStore.removeItemSupp(data);
					return this.partialStore.remoteStore.insert(nosuppdata).mapSuccess(function (remoteData) {
						return this.partialStore.cachedStore.cacheUpdate(this.partialStore.cachedStore.id_of(data), remoteData, {
							silent: true,
							unlockItem: true
						}).mapSuccess(function (addedRemoteData) {
							return Objs.extend(Objs.clone(data, 1), addedRemoteData);
						}, this);
					}, this).error(function () {
						this.partialStore.cachedStore.cacheRemove(this.partialStore.cachedStore.id_of(data), {
							ignoreLock: true,
							silent: false
						});
					}, this);
				}, this);
			},

			remove: function (cachedId) {
				return this.partialStore.cachedStore.cachedIdToRemoteId(cachedId).mapSuccess(function (remoteId) {
					return this.partialStore.cachedStore.cacheRemove(cachedId, {
						ignoreLock: true,
						silent: true
					}).success(function () {
						this.partialStore.remoteStore.remove(remoteId);
					}, this);
				}, this);
			},

			update: function (cachedId, data) {
				return this.partialStore.cachedStore.cachedIdToRemoteId(cachedId).mapSuccess(function (remoteId) {
					return this.partialStore.cachedStore.cacheUpdate(cachedId, data, {
						lockAttrs: true,
						ignoreLock: false,
						silent: true,
						refreshMeta: false,
						accessMeta: true
					}).success(function (data) {
						data = this.partialStore.cachedStore.removeItemSupp(data);
						this.partialStore.remoteStore.update(remoteId, data).success(function () {
							this.partialStore.cachedStore.unlockItem(cachedId);
						}, this);
					}, this);
				}, this);
			}
	
		};
	});
});


Scoped.define("module:Stores.PartialStoreWriteStrategies.CommitStrategy", [
                                                                           "module:Stores.PartialStoreWriteStrategies.WriteStrategy",
                                                                           "module:Stores.StoreHistory",
                                                                           "module:Stores.MemoryStore",
                                                                           "base:Objs",
                                                                           "base:Timers.Timer"
                                                                           ], function (Class, StoreHistory, MemoryStore, Objs, Timer, scoped) {
	return Class.extend({scoped: scoped}, function (inherited) {
		return {

			constructor: function (historyStore, options) {
				inherited.constructor.call(this);
				this._options = options || {};
				this.historyStore = this._options.historyStore || this.auto_destroy(new MemoryStore());
			},
			
			init: function (partialStore) {
				inherited.init.call(this, partialStore);
				this.storeHistory = this.auto_destroy(new StoreHistory(null, this.historyStore, {
					source_id_key: partialStore.cachedStore.itemCache.id_key(),
					row_data: {
						pushed: false,
						success: false
					},
					filter_data: {
						pushed: false
					}
				}));
				if (this._options.auto_push) {
					this.auto_destroy(new Timer({
						fire: function () {
							this.push(this.partialStore);
						},
						context: this,
						start: true,
						delay: this._options.auto_push
					}));
				}
			},

			insert: function (data) {
				return this.partialStore.cachedStore.cacheInsert(data, {
					lockItem: true,
					silent: true,
					refreshMeta: true,
					accessMeta: true
				}).success(function (data) {
					data = this.partialStore.cachedStore.removeItemSupp(data);
					this.storeHistory.sourceInsert(data);
				}, this);
			},

			remove: function (id) {
				return this.partialStore.cachedStore.cachedIdToRemoteId(id).mapSuccess(function (remoteId) {
					return this.partialStore.cachedStore.cacheRemove(id, {
						ignoreLock: true,
						silent: true
					}).success(function () {
						this.storeHistory.sourceRemove(id, this.partialStore.remoteStore.id_row(remoteId));
					}, this);
				}, this);
			},

			update: function (id, data) {
				return this.partialStore.cachedStore.cacheUpdate(id, data, {
					lockAttrs: true,
					ignoreLock: false,
					silent: true,
					refreshMeta: false,
					accessMeta: true
				}).success(function () {
					data = this.partialStore.cachedStore.removeItemSupp(data);
					this.storeHistory.sourceUpdate(id, data);
				}, this);
			},
			
			push: function () {
				if (this.pushing)
					return;
				var failedIds = {};
				var unlockIds = {};
				var hs = this.storeHistory.historyStore;
				var iter = hs.query({success: false}, {sort: {commit_id: 1}}).value();
				var next = function () {
					if (!iter.hasNext()) {
						this.pushing = false;
						Objs.iter(unlockIds, function (value, id) {
							if (value) {
								if (value === true) {
									this.partialStore.cachedStore.unlockItem(id);
								} else {
									this.partialStore.cachedStore.cacheUpdate(id, value, {
										unlockItem: true,
										silent: true
									});
								}
							}
						}, this);
						return;
					}
					var commit = iter.next();
					var commit_id = hs.id_of(commit);
					if (commit_id in failedIds) {
						hs.update(commit_id, {
							pushed: true,
							success: false
						});
						next.apply(this);
					} else {
						var promise = null;
						if (commit.type === "insert") {
							promise = this.partialStore.remoteStore.insert(commit.row);
						} else if (commit.type === "update") {
							promise = this.partialStore.cachedStore.cachedIdToRemoteId(commit.row_id).mapSuccess(function (remoteId) {
								return this.partialStore.remoteStore.update(remoteId, commit.row);
							}, this);
						} else if (commit.type === "remove") {
							promise = this.partialStore.remoteStore.remove(commit.row ? this.partialStore.remoteStore.id_of(commit.row) : commit.row_id);
						}
						promise.success(function (ret) {
							hs.update(commit_id, {
								pushed: true,
								success: true
							});
							if (!(commit.row_id in unlockIds)) {
								unlockIds[commit.row_id] = true;
								if (commit.type === "insert") {
									unlockIds[commit.row_id] = ret;
								}
							}
							next.apply(this);
						}, this).error(function () {
							hs.update(commit_id, {
								pushed: true,
								success: false
							});
							failedIds[commit_id] = true;
							unlockIds[commit.row_id] = false;
							next.apply(this);
						}, this);
					}
				};
				next.apply(this);
			}

		};
	});
});

Scoped.define("module:Stores.RemoteStore", [
    "module:Stores.Invokers.InvokerStore",
    "module:Stores.Invokers.StoreInvokeeRestInvoker",
    "module:Stores.Invokers.RestInvokeeAjaxInvoker"
], function (Store, RestInvoker, AjaxInvoker, scoped) {
 	return Store.extend({scoped: scoped}, function (inherited) {
 		return {
 			
 			constructor: function (ajax, restOptions, storeOptions) {
 				var ajaxInvoker = new AjaxInvoker(ajax);
 				var restInvoker = new RestInvoker(ajaxInvoker, restOptions);
 				inherited.constructor.call(this, restInvoker, storeOptions);
 				this.auto_destroy(restInvoker);
 				this.auto_destroy(ajaxInvoker);
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



Scoped.define("module:Stores.Watchers.ConsumerWatcher", [
                                                         "module:Stores.Watchers.StoreWatcher"
                                                         ], function(StoreWatcher, scoped) {
	return StoreWatcher.extend({scoped: scoped}, function (inherited) {
		return {

			constructor: function (sender, receiver, options) {
				inherited.constructor.call(this, options);
				this._receiver = receiver;
				this._sender = sender;
				receiver.on("receive", function (message, data) {
					if (message === "insert")
						this._insertedWatchedInsert(data);
					if (message === "update")
						this._updatedWatchedItem(data.row, data.data);
					else if (message === "remove")
						this._removedWatchedItem(data);
				}, this);
			},

			destroy: function () {
				this._receiver.off(null, null, this);
				inherited.destroy.apply(this);
			},

			_watchItem: function (id) {
				this._sender.send("watch_item", id);
			},

			_unwatchItem: function (id) {
				this._sender.send("unwatch_item", id);
			},

			_watchInsert: function (query) {
				this._sender.send("watch_insert", query);
			},

			_unwatchInsert: function (query) {
				this._sender.send("unwatch_insert", query);
			}

		};
	});
});


Scoped.define("module:Stores.Watchers.ProducerWatcher", [
                                                         "base:Class"
                                                         ], function(Class, scoped) {
	return Class.extend({scoped: scoped}, function (inherited) {
		return {

			constructor: function (sender, receiver, watcher) {
				inherited.constructor.apply(this);
				this._watcher = watcher;
				this._receiver = receiver;
				receiver.on("receive", function (message, data) {
					if (message === "watch_item")
						watcher.watchItem(data, this);
					else if (message === "unwatch_item")
						watcher.unwatchItem(data, this);
					else if (message === "watch_insert")
						watcher.watchInsert(data, this);
					else if (message === "unwatch_insert")
						watcher.unwatchInsert(data, this);
				}, this);
				watcher.on("insert", function (data) {
					sender.send("insert", data);
				}, this).on("update", function (row, data) {
					sender.send("update", {row: row, data: data});
				}, this).on("remove", function (id) {
					sender.send("remove", id);
				}, this);
			},

			destroy: function () {
				this._receiver.off(null, null, this);
				this._watcher.off(null, null, this);
				inherited.destroy.apply(this);
			}

		};
	});
});

Scoped.define("module:Stores.Watchers.ListWatcher", [
    "module:Stores.Watchers.StoreWatcher",
    "base:Objs"
], function(StoreWatcher, Objs, scoped) {
	return StoreWatcher.extend({scoped: scoped}, function (inherited) {
		return {

			constructor: function (store, watchers, options) {
				options = options || {};
				options.id_key = store.id_key();
				this.__watchers = watchers;
				inherited.constructor.call(this, options);
				this.__forEachWatcher(function (watcher) {
					this.delegateEvents(["insert", "update", "remove"], watcher);
				});
			},
			
			__forEachWatcher: function (f) {
				Objs.iter(this.__watchers, f, this);
			},

			destroy: function () {
				this.__forEachWatcher(function (watcher) {
					watcher.off(null, null, this);
				});
				inherited.destroy.apply(this);
			},
			
			_watchItem : function(id) {
				this.__forEachWatcher(function (watcher) {
					watcher.watchItem(id);
				});
			},

			_unwatchItem : function(id) {
				this.__forEachWatcher(function (watcher) {
					watcher.unwatchItem(id);
				});
			},

			_watchInsert : function(query) {
				this.__forEachWatcher(function (watcher) {
					watcher.watchInsert(query);
				});
			},

			_unwatchInsert : function(query) {
				this.__forEachWatcher(function (watcher) {
					watcher.unwatchInsert(query);
				});
			}

		};
	});
});

Scoped.define("module:Stores.Watchers.LocalWatcher", [
                                                      "module:Stores.Watchers.StoreWatcher"
                                                      ], function(StoreWatcher, scoped) {
	return StoreWatcher.extend({scoped: scoped}, function (inherited) {
		return {

			constructor: function (store, options) {
				options = options || {};
				options.id_key = store.id_key();
				inherited.constructor.call(this, options);
				this._store = store;
				this._store.on("insert", function (data) {
					this._insertedInsert(data);
				}, this).on("update", function (row, data) {
					this._updatedItem(row, data);
				}, this).on("remove", function (id) {
					this._removedItem(id);
				}, this);
			},

			destroy: function () {
				this._store.off(null, null, this);
				inherited.destroy.apply(this);
			}

		};
	});
});

Scoped.define("module:Stores.Watchers.PollWatcher", [
                                                     "module:Stores.Watchers.StoreWatcher",
                                                     "base:Comparators",
                                                     "base:Objs",
                                                     "base:Timers.Timer"
                                                     ], function(StoreWatcher, Comparators, Objs, Timer, scoped) {
	return StoreWatcher.extend({scoped: scoped}, function (inherited) {
		return {

			constructor: function (store, options) {
				options = options || {};
				options.id_key = store.id_key();
				inherited.constructor.call(this, options);
				this._store = store;
				this.__itemCache = {};
				this.__lastKey = null;
				this.__lastKeyIds = {};
				this.__insertsCount = 0;
				this.__increasingKey = options.increasing_key || this.id_key;
				this.__ignoreUpdates = options.ignore_updates;
				if (options.auto_poll) {
					this.auto_destroy(new Timer({
						fire: this.poll,
						context: this,
						start: true,
						delay: options.auto_poll
					}));
				}
			},

			_watchItem : function(id) {
				this.__itemCache[id] = null;
			},

			_unwatchItem : function(id) {
				delete this.__itemCache[id];
			},

			_queryLastKey: function () {
				var sort = {};
				return this._store.query({}, {
					limit: 1,
					sort: Objs.objectBy(this.__increasingKey, -1)
				}).mapSuccess(function (iter) {
					return iter.hasNext() ? iter.next()[this.__increasingKey] : null;
				}, this).mapError(function () {
					return null;
				});
			},

			_watchInsert : function(query) {
				if (this.__insertsCount === 0) {
					this._queryLastKey().success(function (value) {
						this.__lastKey = value;
						this.__lastKeyIds = {};
					}, this);
				}
				this.__insertsCount++;
			},

			_unwatchInsert : function(query) {
				this.__insertsCount--;
				if (this.__insertsCount === 0)
					this.__lastKey = null;
			},

			poll: function () {
				if (!this.__ignoreUpdates) {
					Objs.iter(this.__itemCache, function (value, id) {
						this._store.get(id).success(function (data) {
							if (!data) 
								this._removedItem(id);
							else {
								this.__itemCache[id] = Objs.clone(data, 1);
								if (value && !Comparators.deepEqual(value, data, -1))
									this._updatedItem(data, data);
							}
						}, this);
					}, this);
				}
				if (this.__lastKey) {
					this.insertsIterator().iterate(function (q) {
						var query = q.query;
						var options = q.options;
						var keyQuery = Objs.objectBy(this.__increasingKey, {"$gte": this.__lastKey});
						this._store.query(Objs.extend(keyQuery, query), options).success(function (result) {
							while (result.hasNext()) {
								var item = result.next();
								var id = item[this.__increasingKey];
								if (!this.__lastKeyIds[id])
									this._insertedInsert(item);
								this.__lastKeyIds[id] = true;
								if (id > this.__lastKey)
									this.__lastKey = id; 
							}
						}, this);
					}, this);
				} else {
					this._queryLastKey().success(function (value) {
						if (value !== this.__lastKey) {
							this.__lastKey = value;
							this.__lastKeyIds = {};
						}
					}, this);
				}
			}

		};
	});
});

Scoped.define("module:Stores.Watchers.StoreWatcherMixin", [], function() {
	return {

		watchItem : function(id, context) {},

		unwatchItem : function(id, context) {},

		watchInsert : function(query, context) {},

		unwatchInsert : function(query, context) {},

		_removedWatchedItem : function(id) {
			this.trigger("remove", id);
		},

		_updatedWatchedItem : function(row, data) {
			this.trigger("update", row, data);
		},

		_insertedWatchedInsert : function(data) {
			this.trigger("insert", data);
		},
		
		delegateStoreEvents: function (store) {
			this.on("insert", function (data) {
				store.trigger("insert", data);
			}, store).on("update", function (row, data) {
				store.trigger("update", row, data);
			}, store).on("remove", function (id) {
				store.trigger("remove", id);
			}, store);
		},

		undelegateStoreEvents: function (store) {
			this.off(null, null, store);
		}

	};	
});


Scoped.define("module:Stores.Watchers.StoreWatcher", [
                                                      "base:Class",
                                                      "base:Events.EventsMixin",
                                                      "base:Classes.ContextRegistry",    
                                                      "module:Stores.Watchers.StoreWatcherMixin",
                                                      "module:Queries"
                                                      ], function(Class, EventsMixin, ContextRegistry, StoreWatcherMixin, Queries, scoped) {
	return Class.extend({scoped: scoped}, [EventsMixin, StoreWatcherMixin, function (inherited) {
		return {

			constructor: function (options) {
				inherited.constructor.call(this);
				options = options || {};
				if (options.id_key)
					this.id_key = options.id_key;
				else
					this.id_key = "id";
				this.__items = new ContextRegistry();
				this.__inserts = new ContextRegistry(Queries.serialize, Queries);
			},

			destroy: function () {
				this.__inserts.iterator().iterate(this.unwatchInsert, this);
				this.__items.iterator().iterate(this.unwatchItem, this);
				this.__inserts.destroy();
				this.__items.destroy();
				inherited.destroy.call(this);
			},

			insertsIterator: function () {
				return this.__inserts.iterator();
			},

			watchItem : function(id, context) {
				if (this.__items.register(id, context))
					this._watchItem(id);
			},

			unwatchItem : function(id, context) {
				this.__items.unregister(id, context).forEach(this._unwatchItem, this);
			},

			watchInsert : function(query, context) {
				if (this.__inserts.register(query, context))
					this._watchInsert(query);
			},

			unwatchInsert : function(query, context) {
				this.__inserts.unregister(query, context).forEach(this._unwatchInsert, this);
			},

			_removedItem : function(id) {
				if (!this.__items.get(id))
					return;
				// @Oliver: I am not sure why this is commented out, but tests fail if we comment it in.
				// this.unwatchItem(id, null);
				this._removedWatchedItem(id);
			},

			_updatedItem : function(row, data) {
				var id = row[this.id_key];
				if (!this.__items.get(id))
					return;
				this._updatedWatchedItem(row, data);
			},

			_insertedInsert : function(data) {
				var trig = false;
				var iter = this.__inserts.iterator();
				while (!trig && iter.hasNext())
					trig = Queries.evaluate(iter.next().query, data);
				if (!trig)
					return;
				this._insertedWatchedInsert(data);
			},

			unregisterItem: function (id, context) {
				if (this.__items.unregister(id, context))
					this._unregisterItem(id);
			},			

			_watchItem : function(id) {},

			_unwatchItem : function(id) {},

			_watchInsert : function(query) {},

			_unwatchInsert : function(query) {}

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
				if (options.delete_cascade) {
					model.on("remove", function () {
						this.__delete_cascade();
					}, this);
				}
			},

			__delete_cascade: function () {
				this.execute().success(function (iter) {
					iter = Iterators.ensure(iter);
					while (iter.hasNext())
						iter.next().remove({});
				}, this);
			},

			execute: function () {
				if ("__cache" in this)
					return Promise.create(this.__cache);
				var promise = this._execute();
				if (this._options.cached) {
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
			
			_execute: function () {
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
                                                                       "module:Modelling.Associations.Association",
                                                                       "base:Objs"
                                                                       ], function (Associations, Objs, scoped) {
	return Associations.extend({scoped: scoped}, function (inherited) {
		return {

			constructor: function (model, options) {
				inherited.constructor.call(this, model, Objs.extend({
					conditional: function () { return true; }
				}, options));
			},

			_execute: function () {
				var assoc = this.assoc();
				return assoc.execute.apply(assoc, arguments);
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
		
			_execute: function () {
				return this.allBy();
			},
		
			execute: function () {
				return inherited.execute.call(this).mapSuccess(function (items) {
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
		
		_execute: function () {
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
	
		_execute: function (id) {
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
				if (options.primary_key)
					this._primary_key = options.primary_key;
			},

			_execute: function (id) {
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

			constructor: function (model, err) {
				var message = Objs.values(model.errors()).join("\n") || err;
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
                                         "module:Modelling.Table"
                                         ], function (AssociatedProperties, ModelInvalidException, Objs, Promise, Types, Table, scoped) {
	return AssociatedProperties.extend({scoped: scoped}, function (inherited) {			
		return {

			constructor: function (attributes, table, options, ctx) {
				this.__table = table;
				this.__options = Objs.extend({
					newModel: true,
					removed: false
				}, options);
				this.__ctx = ctx;
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
							this.set(key, data[key]);
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
					var promise = this.isNew() ? this.__table.store().insert(attrs, this.__ctx) : this.__table.store().update(this.id(), attrs, this.__ctx);
					return promise.mapCallback(function (err, result) {
						if (this.destroyed())
							return this;
						if (err) {
							if (err.data) {
								Objs.iter(err.data, function (value, key) {
									this.setError(key, value);
								}, this);
							}
							return new ModelInvalidException(this, err);
						}
						this.__silent++;
						this.setAll(result);
						this.__silent--;
						this._properties_changed = {};
						this.trigger("save");
						if (wasNew) {
							this.__options.newModel = false;
							this._registerEvents();
						}
						return this;
					}, this);
				}, this);
			},

			remove: function () {
				if (this.isNew() || this.isRemoved())
					return Promise.create(true);
				return this.__table.store().remove(this.id(), this.__ctx).success(function () {
					this.__options.removed = true;
					this.trigger("remove");		
				}, this);
			}	

		};
	}, {
		
		createTable: function (store, options) {
			return new Table(store, this, options);
		}

	});
});
Scoped.define("module:Modelling.SchemedProperties", [
                                                     "base:Properties.Properties",
                                                     "base:Types",
                                                     "base:Promise",
                                                     "base:Objs"
                                                     ], function (Properties, Types, Promise, Objs, scoped) {
	return Properties.extend({scoped: scoped}, function (inherited) {			
		return {

			constructor: function (attributes) {
				inherited.constructor.call(this);
				var scheme = this.cls.scheme();
				this._properties_changed = {};
				this.__errors = {};
				for (var key in scheme) {
					if ("def" in scheme[key]) 
						this.set(key, Types.is_function(scheme[key].def) ? scheme[key].def(attributes) : scheme[key].def);
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
				var validate = entry.validate;
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
				tags = tags || [];
				var asInner = function (key) {
					var target = scheme[key].tags || [];
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
				};
				for (var key in props)
					if (key in scheme)
						asInner.call(this, key);
				return rec;		
			},

			setByTags: function (data, tags) {
				var scheme = this.cls.scheme();
				tags = tags || {};
				var setInner = function (key) {
					var target = scheme[key].tags || [];
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
				};
				for (var key in data)
					if (key in scheme)
						setInner.call(this, key);
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
					return obj.execute.apply(obj, arguments);
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
			
			pid: function () {
				return this.id();
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
                                         "base:Iterators.MappedIterator",
                                         "base:Classes.ObjectCache"
                                         ], function (Class, EventsMixin, Objs, Types, MappedIterator, ObjectCache, scoped) {
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
					save_invalid: false,
					// Cache Models
					cache_models: false
				}, options || {});
				this.__store.on("insert", function (obj) {
					this.trigger("create", obj);
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
				if (this.__options.cache_models) {
					this.model_cache = this.auto_destroy(new ObjectCache(function (model) {
						return model.id();
					}));
				}
			},

			modelClass: function (cls) {
				cls = cls || this.__model_type;
				return Types.is_string(cls) ? Scoped.getGlobal(cls) : cls;
			},

			newModel: function (attributes, cls, ctx) {
				cls = this.modelClass(cls);
				var model = new cls(attributes, this, {}, ctx);
				if (this.__options.auto_create)
					model.save();
				if (this.model_cache) {
					if (model.hasId())
						this.model_cache.register(model);
					else {
						model.once("save", function () {
							this.model_cache.register(model);
						}, this);
					}
				}
				return model;
			},

			materialize: function (obj, ctx) {
				if (!obj)
					return null;
				var cls = this.modelClass(this.__options.type_column && obj[this.__options.type_column] ? this.__options.type_column : null);
				if (this.model_cache) {
					var cachedModel = this.model_cache.get(obj[this.primary_key()]);
					if (cachedModel) {
						cachedModel.setAll(obj);
						return cachedModel;
					}
				}
				var model = new cls(obj, this, {newModel: false}, ctx);
				if (this.model_cache)
					this.model_cache.register(model);
				return model;
			},

			options: function () {
				return this.__options;
			},

			store: function () {
				return this.__store;
			},

			findById: function (id, ctx) {
				return this.__store.get(id, ctx).mapSuccess(function (obj) {
					return this.materialize(obj, ctx);
				}, this);
			},

			findBy: function (query, options, ctx) {
				return this.allBy(query, Objs.extend({limit: 1}, options), ctx).mapSuccess(function (iter) {
					return iter.next();
				});
			},

			allBy: function (query, options, ctx) {
				return this.__store.query(query, options, ctx).mapSuccess(function (iterator) {
					return new MappedIterator(iterator, function (obj) {
						return this.materialize(obj, ctx);
					}, this);
				}, this);
			},

			primary_key: function () {
				return (Types.is_string(this.__model_type) ? Scoped.getGlobal(this.__model_type) : this.__model_type).primary_key();
			},

			all: function (options, ctx) {
				return this.allBy({}, options, ctx);
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
			}

		};
	}]);
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