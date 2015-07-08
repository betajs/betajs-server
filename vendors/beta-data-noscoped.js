/*!
betajs-data - v1.0.0 - 2015-07-08
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
		version: '39.1436389370226'
	};
});

Scoped.define("module:Queries.Constrained", [
                                             "json:",
                                             "module:Queries",
                                             "base:Types",
                                             "base:Objs",
                                             "base:Tokens",
                                             "base:Comparators"
                                             ], function (JSON, Queries, Types, Objs, Tokens, Comparators) {
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
                                 "json:",
                                 "base:Types",
                                 "base:Sort",
                                 "base:Objs",
                                 "base:Class",
                                 "base:Tokens",
                                 "base:Iterators.ArrayIterator",
                                 "base:Iterators.FilteredIterator",
                                 "base:Strings",
                                 "base:Comparators"
                                 ], function (JSON, Types, Sort, Objs, Class, Tokens, ArrayIterator, FilteredIterator, Strings, Comparators) {

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
			return value.evaluate_single(object_value.toLowerCase(), condition_value.toLowerCase());
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
			return value === null || !Types.is_object(value) || Objs.all(value, function (v, key) {
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
			return Objs.keys(this.dependencies_query(query, {}));
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
				} else {
					var conds = this.simplifyConditions(value);
					if (!Types.is_empty(conds))
						result[key] = conds;
				}
			}, this);
			return result;
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
			return Obj.objectBy(key, result);
		},

		mapKeyValueCondition: function (condition_value, key, callback, context) {
			var is_array = Types.is_array(condition_value);
			if (!is_array)
				condition_value = [condition_value];
			var result = Objs.map(condition_value, function (value) {
				return Objs.peek(callback.call(context, key, value));
			}, this);
			return is_array ? result : result[0];
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
					if (conds["$eq" + add]) {
						var materialized = [];
						index["itemIterate" + postfix](conds["$eq" + add], primarySortDirection, function (dataKey, data) {
							if (dataKey !== conds["$eq" + add])
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
			if (constrainedQuery.options.sort) {
				var first = Objs.ithKey(constrainedQuery.options.sort, 0);
				if (indices[first]) {
					return this.compileIndexQuery({
						query: Queries.simplifyQuery(Queries.disjunctiveNormalForm(constrainedQuery.query, true)),
						options: constrainedQuery.options
					}, first, indices[first]);
				}
			}
			var dnf = Queries.simplifyQuery(Queries.disjunctiveNormalForm(constrainedQuery.query, true));
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

//Stores everything temporarily in the browser's memory

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

Scoped.define("module:Stores.BaseStore", [
                                          "base:Class",
                                          "base:Events.EventsMixin",
                                          "module:Stores.ReadStoreMixin",
                                          "module:Stores.WriteStoreMixin",
                                          "base:Promise"
                                          ], function (Class, EventsMixin, ReadStoreMixin, WriteStoreMixin, Promise, scoped) {
	return Class.extend({scoped: scoped}, [EventsMixin, ReadStoreMixin, WriteStoreMixin, function (inherited) {			
		return {

			constructor: function (options) {
				inherited.constructor.call(this);
				this._initializeReadStore(options);
				this._initializeWriteStore(options);
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
		},
		
		watcher: function () {
			return this._watcher;
		},

		_get: function (id) {
			return Promise.create(null, new StoreException("unsupported: get"));
		},

		_query_capabilities: function () {
			return {};
		},

		_query: function (query, options) {
			return Promise.create(null, new StoreException("unsupported: query"));
		},

		get: function (id) {
			return this._get(id);
		},

		query: function (query, options) {
			query = Objs.clone(query, -1);
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
						return this._query(constrainedQuery.query, constrainedQuery.options);
					},
					this,
					this.indices);
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

			sourceRemove: function (id) {
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

		_inserted: function (row) {
			this.trigger("insert", row);		
			this.trigger("write", "insert", row);
		},

		_removed: function (id) {
			this.trigger("remove", id);
			this.trigger("write", "remove", id);
		},

		_updated: function (row, data) {
			this.trigger("update", row, data);	
			this.trigger("write", "update", row, data);
		}, 

		insert_all: function (data, query) {
			var promise = Promise.and();
			for (var i = 0; i < data.length; ++i)
				promise = promise.and(this.insert(data[i]));
			return promise.end();
		},

		_insert: function (data) {
			return Promise.create(null, new StoreException("unsupported: insert"));
		},

		_remove: function (id) {
			return Promise.create(null, new StoreException("unsupported: remove"));
		},

		_update: function (id, data) {
			return Promise.create(null, new StoreException("unsupported: update"));
		},

		insert: function (data) {
			if (!data)
				return Promise.create(null, new StoreException("empty insert"));
			if (this._create_ids && !(this._id_key in data && data[this._id_key]))
				data[this._id_key] = this._id_generator.generate();
			return this._insert(data).success(function (row) {
				this._inserted(row);
			}, this);
		},

		remove: function (id) {
			return this._remove(id).success(function () {
				this._removed(id);
			}, this);
		},

		update: function (id, data) {
			return this._update(id, data).success(function (row) {
				this._updated(row, data);
			}, this);
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


Scoped.define("module:Stores.PassthroughStore", [
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
				if (options.destroy_store)
					this._auto_destroy(store);
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

			_ensure_index: function (key) {
				return this.__store.ensure_index(key);
			},

			_store: function () {
				return this.__store;
			},

			_preInsert: function (data) {
				return Promise.create(data);
			},
			
			_postInsert: function (data) {
				return Promise.create(data);
			},
			
			_preRemove: function (id) {
				return Promise.create(id);
			},
			
			_postRemove: function (id) {
				return Promise.create(true);
			},
			
			_preGet: function (id) {
				return Promise.create(id);
			},
			
			_postGet: function (data) {
				return Promise.create(data);
			},

			_preUpdate: function (id, data) {
				return Promise.create({id: id, data: data});
			},
			
			_postUpdate: function (row) {
				return Promise.create(row);
			},
			
			_preQuery: function (query, options) {
				return Promise.create({query: query, options: options});
			},
			
			_postQuery: function (results) {
				return Promise.create(results);
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
			
			__promises: [],
			__ready: false,
			
			ready: function () {
				this.__ready = true;
				Objs.iter(this.__promises, function (rec) {
					rec.promise.forwardCallback(rec.stalling);
				});
				this.__promises = [];
			},
			
			__execute: function (promise) {
				if (this.__ready)
					return promise;
				var stalling = Promise.create();
				this.__promises.push({
					stalling: stalling,
					promise: promise
				});
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
			
			_encodeId: function (id) {
				return this.id_of(this._encodeData(Objs.objectBy(this.id_key(), id)));
			},
			
			_decodeId: function (id) {
				return this.id_of(this._decodeData(Objs.objectBy(this.id_key(), id)));
			},
			
			_encodeQuery: function (query, options) {
				var opts = Objs.clone(options);
				if (opts.sort)
					opts.sort = Types.is_object(opts.sort) ? this._encodeData(opts.sort) : {};
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


Scoped.define("module:Stores.CachedStore", [
                                            "module:Stores.BaseStore",
                                            "module:Stores.MemoryStore",
                                            "module:Queries.Constrained",
                                            "module:Stores.CacheStrategies.ExpiryCacheStrategy",
                                            "base:Promise",
                                            "base:Objs",
                                            "base:Types",
                                            "base:Iterators.ArrayIterator",
                                            "base:Iterators.MappedIterator",
                                            "base:Timers.Timer"
                                            ], function (Store, MemoryStore, Constrained, ExpiryCacheStrategy, Promise, Objs, Types, ArrayIterator, MappedIterator, Timer, scoped) {
	return Store.extend({scoped: scoped}, function (inherited) {			
		return {

			constructor: function (remoteStore, options) {
				inherited.constructor.call(this);
				this._options = Objs.extend({
					itemMetaKey: "meta",
					queryMetaKey: "meta",
					queryKey: "query"
				}, options);
				this.remoteStore = remoteStore;
				this._online = true;
				this.itemCache = this._options.itemCache || this.auto_destroy(new MemoryStore());
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

			_insert: function (data) {
				return this.cacheInsert(data, {
					lockItem: true,
					silent: true,
					refreshMeta: false,
					accessMeta: true
				});
			},

			_update: function (id, data) {
				return this.cacheUpdate(id, data, {
					ignoreLock: false,
					silent: true,
					lockAttrs: true,
					refreshMeta: false,
					accessMeta: true
				});
			},

			_remove: function (id) {
				return this.cacheRemove(id, {
					ignoreLock: true,
					silent: true					
				});
			},

			_get: function (id) {
				return this.cacheGet(id, {
					silentInsert: true,
					silentUpdate: true,
					silentRemove: true,
					refreshMeta: true,
					accessMeta: true
				});
			},

			_query: function (query, options) {
				return this.cacheQuery(query, options, {
					silent: true,
					queryRefreshMeta: true,
					queryAccessMeta: true,
					refreshMeta: true,
					accessMeta: true
				});
			},			

			/*
			 * options:
			 *   - lockItem: boolean
			 *   - silent: boolean
			 *   - refreshMeta: boolean
			 *   - accessMeta: boolean
			 */

			cacheInsert: function (data, options) {
				var meta = {
						lockedItem: options.lockItem,
						lockedAttrs: {},
						refreshMeta: options.refreshMeta ? this.cacheStrategy.itemRefreshMeta() : null,
								accessMeta: options.accessMeta ? this.cacheStrategy.itemAccessMeta() : null
				};
				return this.itemCache.insert(this.addItemMeta(data, meta)).mapSuccess(function (result) {
					data = this.removeItemMeta(result);
					if (!options.silent)
						this._inserted(data);
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
			 */

			cacheUpdate: function (id, data, options) {
				return this.itemCache.get(id).mapSuccess(function (item) {
					if (!item)
						return null;
					var meta = this.readItemMeta(item);
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
					return this.itemCache.update(id, this.addItemMeta(data, meta)).mapSuccess(function (result) {
						result = this.removeItemMeta(result);
						if (!options.silent)
							this._updated(result, data);
						return result;
					}, this);					
				}, this);
			},

			cacheInsertUpdate: function (data, options) {
				var id = data[this.remoteStore.id_key()];
				return this.itemCache.get(id).mapSuccess(function (item) {
					return item ? this.cacheUpdate(id, data, options) : this.cacheInsert(data, options);
				}, this);
			},

			/*
			 * options:
			 *   - ignoreLock: boolean
			 *   - silent: boolean
			 */
			cacheRemove: function (id, options) {
				return this.itemCache.get(id).mapSuccess(function (data) {
					if (!data)
						return data;
					var meta = this.readItemMeta(data);
					if (!options.ignoreLock && (meta.lockedItem || !Types.is_empty(meta.lockedAttrs)))
						return Promise.error("locked item");
					return this.itemCache.remove(id).success(function () {
						if (!options.silent)
							this._removed(id);
					}, this);
				}, this);
			},

			/*
			 * options:
			 *   - silentInsert: boolean
			 *   - silentUpdate: boolean
			 *   - silentRemove: boolean
			 *   - refreshMeta: boolean
			 *   - accessMeta: boolean
			 */
			cacheGet: function (id, options) {
				return this.itemCache.get(id).mapSuccess(function (data) {
					if (!data) {
						return this.remoteStore.get(id).success(function (data) {
							this.online();
							if (data) {
								this.cacheInsert(data, {
									lockItem: false,
									silent: options.silentInsert,
									accessMeta: true,
									refreshMeta: true
								});
							}
						}, this);
					}
					var meta = this.readItemMeta(data);
					if (this.cacheStrategy.validItemRefreshMeta(meta.refreshMeta) || meta.lockedItem) {
						if (options.accessMeta) {
							meta.accessMeta = this.cacheStrategy.itemAccessMeta(meta.accessMeta);
							this.itemCache.update(id, this.addItemMeta({}, meta));
						}
						return this.removeItemMeta(data);
					}
					return this.remoteStore.get(id).success(function (data) {
						this.online();
						if (data) {
							this.cacheUpdate(id, data, {
								ignoreLock: false,
								lockAttrs: false,
								silent: options.silentUpdate,
								accessMeta: true,
								refreshMeta: true
							});
						} else {
							this.cacheRemove(id, {
								ignoreLock: false,
								silent: options.silentRemove
							});
						}
					}, this).mapError(function () {
						this.offline();
						return Promise.value(data);
					}, this);
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
			cacheQuery: function (query, queryOptions, options) {
				var queryString = Constrained.serialize({
					query: query,
					options: queryOptions
				});
				var localQuery = Objs.objectBy(
						this._options.queryKey,
						queryString
				);
				return this.queryCache.query(localQuery, {limit : 1}).mapSuccess(function (result) {
					result = result.hasNext() ? result.next() : null;
					if (result) {
						var meta = this.readQueryMeta(result);
						var query_id = this.queryCache.id_of(result);
						if (this.cacheStrategy.validQueryRefreshMeta(meta.refreshMeta)) {
							if (options.queryAccessMeta) {
								meta.accessMeta = this.cacheStrategy.queryAccessMeta(meta.accessMeta);
								this.queryCache.update(query_id, this.addQueryMeta({}, meta));
							}
							return this.itemCache.query(query, options).mapSuccess(function (items) {
								items = items.asArray();
								Objs.iter(items, function (item) {
									this.cacheUpdate(this.itemCache.id_of(item), {}, {
										lockItem: false,
										lockAttrs: false,
										silent: true,
										accessMeta: options.accessMeta,
										refreshMeta: false
									});
								}, this);
								return new MappedIterator(new ArrayIterator(items), this.removeItemMeta, this);
							}, this);
						}
						this.queryCache.remove(query_id);
					}
					return this.remoteStore.query(query, queryOptions).mapSuccess(function (items) {
						this.online();
						items = items.asArray();
						var meta = {
								refreshMeta: options.queryRefreshMeta ? this.cacheStrategy.queryRefreshMeta() : null,
										accessMeta: options.queryAccessMeta ? this.cacheStrategy.queryAccessMeta() : null
						};
						this.queryCache.insert(Objs.objectBy(
								this._options.queryKey, queryString,
								this._options.queryMetaKey, meta
						));
						Objs.iter(items, function (item) {
							this.cacheInsertUpdate(item, {
								lockItem: false,
								lockAttrs: false,
								silent: options.silent,
								accessMeta: options.accessMeta,
								refreshMeta: options.refreshMeta
							});
						}, this);
						return new ArrayIterator(items);
					}, this).mapError(function () {
						this.offline();
						return this.itemCache.query(query, options).mapSuccess(function (items) {
							items = items.asArray();
							Objs.iter(items, function (item) {
								this.cacheUpdate(this.itemCache.id_of(item), {}, {
									lockItem: false,
									lockAttrs: false,
									silent: true,
									accessMeta: options.accessMeta,
									refreshMeta: false
								});
							}, this);
							return new MappedIterator(new ArrayIterator(items), this.removeItemMeta, this);
						}, this);
					}, this);
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

			unlockItem: function (id) {
				this.itemCache.get(id).success(function (data) {
					if (!data) 
						return;
					var meta = this.readItemMeta(data);
					meta.lockedItem = false;
					meta.lockedAttrs = {};
					this.itemCache.update(id, this.addItemMeta({}, meta));
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
				return refreshMeta ? refreshMeta : this._options.now() + this._options.itemRefreshTime; 
			},

			queryRefreshMeta: function (refreshMeta) {
				return refreshMeta ? refreshMeta : this._options.now() + this._options.queryRefreshTime; 
			},

			itemAccessMeta: function (accessMeta) {
				return this._options.now() + this._options.itemAccessTime; 
			},

			queryAccessMeta: function (accessMeta) {
				return this._options.now() + this._options.queryAccessTime; 
			},

			validItemRefreshMeta: function (refreshMeta) {
				return refreshMeta >= this._options.now();
			},

			validQueryRefreshMeta: function (refreshMeta) {
				return refreshMeta >= this._options.now();
			},	

			validItemAccessMeta: function (accessMeta) {
				return accessMeta >= this._options.now();
			},

			validQueryAccessMeta: function (accessMeta) {
				return accessMeta >= this._options.now();
			}

		};
	});	
});
Scoped.define("module:Stores.PartialStore", [
                                            "module:Stores.BaseStore",
                                            "module:Stores.CachedStore",
                                            "module:Stores.PartialStoreWriteStrategies.PostWriteStrategy",
                                            "base:Objs"
                                            ], function (Store, CachedStore, PostWriteStrategy, Objs, scoped) {
	return Store.extend({scoped: scoped}, function (inherited) {			
		return {

			constructor: function (remoteStore, options) {
				inherited.constructor.call(this, options);
				this._options = Objs.extend({}, options);
				this.remoteStore = remoteStore;
				this.cachedStore = new CachedStore(remoteStore, this._options);
				this.writeStrategy = this._options.writeStrategy || this.auto_destroy(new PostWriteStrategy());
				if (this._watcher) {
					this._watcher.on("insert", this._remoteInsert, this);
					this._watcher.on("update", this._remoteUpdate, this);
					this._watcher.on("remove", this._remoteRemove, this);
				}
				this.cachedStore.on("insert", this._inserted, this);
				this.cachedStore.on("remove", this._removed, this);
				this.cachedStore.on("update", function (row, data) {
					this._updated(this.cachedStore.id_of(row), data);
				}, this);
				this.writeStrategy.init(this);
			},
			
			destroy: function () {
				if (this._watcher)
					this._watcher.off(null, null, this);
				this.cachedStore.destroy();
				inherited.destroy.call(this);
			},

			_insert: function (data) {
				return this.writeStrategy.insert(data);
			},
			
			_remove: function (id) {
				return this.writeStrategy.remove(id);
			},
			
			_update: function (id, data) {
				return this.writeStrategy.update(id, data);
			},

			_get: function (id) {
				return this.cachedStore.get(id);
			},
			
			_query: function (query, options) {
				return this.cachedStore.query(query, options);
			},			
			
			_query_capabilities: function () {
				return this.cachedStore._query_capabilities();
			},
			
			_remoteInsert: function (data) {
				this.cachedStore.cacheInsert(data, {
					lockItem: false,
					silent: false,
					refreshMeta: true,
					accessMeta: true
				});
			},
			
			_remoteUpdate: function (row, data) {
				var id = this.remoteStore.id_of(row);
				this.cachedStore.cacheUpdate(id, data, {
					ignoreLock: false,
					lockAttrs: false,
					silent: false,
					accessMeta: true,
					refreshMeta: true
				});
			},
			
			_remoteRemove: function (id) {
				this.cachedStore.cacheRemove(id, {
					ignoreLock: false,
					silent: false
				});
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

			insert: function (data) {},

			remove: function (id) {},

			update: function (data) {}

		};
	});
});

Scoped.define("module:Stores.PartialStoreWriteStrategies.PostWriteStrategy", [
                                                                              "module:Stores.PartialStoreWriteStrategies.WriteStrategy"
                                                                              ], function (Class, scoped) {
	return Class.extend({scoped: scoped}, function (inherited) {
		return {

			insert: function (data) {
				return this.partialStore.remoteStore.insert(data).mapSuccess(function (data) {
					return this.partialStore.cachedStore.cacheInsert(data, {
						lockItem: false,
						silent: true,
						refreshMeta: true,
						accessMeta: true
					}, this);
				}, this);
			},

			remove: function (id) {
				return this.partialStore.remoteStore.remove(id).mapSuccess(function () {
					return this.partialStore.cachedStore.cacheRemove(id, {
						ignoreLock: true,
						silent: true
					}, this);
				}, this);
			},

			update: function (id, data) {
				return this.partialStore.remoteStore.update(id, data).mapSuccess(function () {
					return this.partialStore.cachedStore.cacheUpdate(id, data, {
						ignoreLock: false,
						lockAttrs: false,
						silent: true,
						refreshMeta: true,
						accessMeta: true
					}, this);
				}, this);
			}

		};
	});
});


Scoped.define("module:Stores.PartialStoreWriteStrategies.PreWriteStrategy", [
                                                                             "module:Stores.PartialStoreWriteStrategies.WriteStrategy"
                                                                             ], function (Class, scoped) {
	return Class.extend({scoped: scoped}, function (inherited) {
		return {

			insert: function (data) {
				return this.partialStore.cachedStore.cacheInsert(data, {
					lockItem: true,
					silent: true,
					refreshMeta: true,
					accessMeta: true
				}).success(function (data) {
					this.partialStore.remoteStore.insert(data).success(function () {
						this.partialStore.cachedStore.unlockItem(this.partialStore.cachedStore.id_of(data));
					}, this).error(function () {
						this.partialStore.cachedStore.cacheRemove(this.partialStore.cachedStore.id_of(data), {
							ignoreLock: true,
							silent: false
						});
					}, this);
				}, this);
			},

			remove: function (id) {
				return this.partialStore.cachedStore.cacheRemove(id, {
					ignoreLock: true,
					silent: true
				}).success(function () {
					this.partialStore.remoteStore.remove(id);
				}, this);
			},

			update: function (id, data) {
				return this.partialStore.cachedStore.cacheUpdate(id, data, {
					lockAttrs: true,
					ignoreLock: false,
					silent: true,
					refreshMeta: false,
					accessMeta: true
				}).success(function (data) {
					this.partialStore.remoteStore.update(id, data).success(function () {
						this.partialStore.cachedStore.unlockItem(this.partialStore.cachedStore.id_of(data));
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
				this.storeHistory = this.auto_destroy(new StoreHistory(null, this.historyStore, {
					source_id_key: this._options.source_id_key || "id",
					row_data: {
						pushed: false,
						success: false
					},
					filter_data: {
						pushed: false
					}
				}));
			},
			
			init: function (partialStore) {
				inherited.init.call(this, partialStore);
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
					this.storeHistory.sourceInsert(data);
				}, this);
			},

			remove: function (id) {
				return this.partialStore.cachedStore.cacheRemove(id, {
					ignoreLock: true,
					silent: true
				}).success(function () {
					this.storeHistory.sourceRemove(id);
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
							if (value) 
								this.partialStore.cachedStore.unlockItem(id);
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
						if (commit.type === "insert")
							promise = this.partialStore.remoteStore.insert(commit.row);
						else if (commit.type === "update")
							promise = this.partialStore.remoteStore.update(commit.row_id, commit.row);
						else if (commit.type === "remove")
							promise = this.partialStore.remoteStore.remove(commit.row_id);
						promise.success(function () {
							hs.update(commit_id, {
								pushed: true,
								success: true
							});
							if (!(commit.row_id in unlockIds))
								unlockIds[commit.row_id] = true;
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


/**
 * @class RemoteStore
 *
 * RemoteStore is a store designed to be used with remote data. It is also
 * extended to create a queriable remote store.
 */
Scoped.define("module:Stores.RemoteStore", [
                                            "module:Stores.BaseStore",
                                            "module:Stores.RemoteStoreException",
                                            "base:Objs",
                                            "base:Types",
                                            "json:"
                                            ], function (BaseStore, RemoteStoreException, Objs, Types, JSON, scoped) {
	return BaseStore.extend({scoped: scoped}, function (inherited) {			
		return {

			/**
			 * @method constructor
			 *
			 * @param {string} uri The remote endpoint where the queriable data is accessible.
			 * @param {object} ajax An instance of an concrete implementation of
			 * BetaJS.Net.AbstractAjax. Whether BetaJS.Data is being used in
			 * the client or server dictates which implementation of Ajax to use.
			 * @param {object} options The options for the RemoteStore. Currently the
			 * supported options are "update_method" and "uri_mappings".
			 *
			 * @example
			 * // Returns new instance of RemoteStore
			 * new RemoteStore('/api/v1/people', new BetaJS.Browser.JQueryAjax(), {})
			 */
			constructor : function(uri, ajax, options) {
				inherited.constructor.call(this, options);
				this._uri = uri;
				this.__ajax = ajax;
				this.__options = Objs.extend({
					"update_method": "PUT",
					"uri_mappings": {}
				}, options || {});
			},

			/**
			 * @method getUri
			 *
			 * @return {string} The uri instance variable.
			 */
			getUri: function () {
				return this._uri;
			},

			/**
			 * @method prepare_uri
			 *
			 * @param {string} action The action to be performed on the remote data
			 * store. For example, remove, get...
			 * @param {object} data The data on which the action will be performed.
			 * For example, the object being updated.
			 *
			 * @return {string} The uri to be used to perform the specified action on
			 * the specified data.
			 */
			prepare_uri: function (action, data) {
				if (this.__options.uri_mappings[action])
					return this.__options.uri_mappings[action](data);
				if (action == "remove" || action == "get" || action == "update")
					return this.getUri() + "/" + data[this._id_key];
				return this.getUri();
			},

			/**
			 * @method _encode_query
			 *
			 * @param {object} query The query object.
			 * @param {object} options Options for the specified query.
			 *
			 * @protected
			 *
			 * @return {string} A uri to perform the specified query.
			 */
			_encode_query: function (query, options) {
				return {
					uri: this.prepare_uri("query")
				};		
			},

			/**
			 * @method __invoke
			 *
			 * Invoke the specified operation on the remote data store.
			 *
			 * @param {object} options The options for the ajax.asyncCall. Specifies
			 * the method, uri, and data. See "_insert" for an example.
			 * @param {boolean} parse_json Boolean flag indicating if the response
			 * should be parsed as json.
			 *
			 * @private
			 *
			 * @return {object} The remote response from invoking the specified
			 * operation.
			 */
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

			/**
			 * @method _insert
			 *
			 * Insert the given data into the remote store.
			 *
			 * @param {object} data The data to be inserted.
			 *
			 * @protected
			 *
			 * @return {object} The result of invoking insert.
			 */
			_insert : function(data) {
				return this.__invoke({
					method: "POST",
					uri: this.prepare_uri("insert", data),
					data: data
				}, true);
			},

			/**
			 * @method _get
			 *
			 * Get the data specified by the id parameter from the remote store.
			 *
			 * @param {int} id The id of the data to be retrieved.
			 *
			 * @protected
			 *
			 * @return {object} The desired data.
			 */
			_get : function(id) {
				var data = {};
				data[this._id_key] = id;
				return this.__invoke({
					uri: this.prepare_uri("get", data)
				});
			},

			/**
			 * @method _update
			 *
			 * Update data.
			 *
			 * @param {int} id The id of the data to be updated.
			 * @param {object} data The new data to be used for the update.
			 *
			 * @protected
			 *
			 * @return {object} The result of invoking the update operation on the
			 * remote store.
			 */
			_update : function(id, data) {
				var copy = Objs.clone(data, 1);
				copy[this._id_key] = id;
				return this.__invoke({
					method: this.__options.update_method,
					uri: this.prepare_uri("update", copy),
					data: data
				});
			},

			/**
			 * @method _remove
			 *
			 * Remove data.
			 *
			 * @param {int} id The id of the data to be removed.
			 *
			 * @protected
			 *
			 * @return {object} The result of invoking the remove operation on the
			 * remote store.
			 */
			_remove : function(id) {
				var data = {};
				data[this._id_key] = id;
				return this.__invoke({
					method: "DELETE",
					uri: this.prepare_uri("remove", data)
				});
			},

			/**
			 * @method _query
			 *
			 * Query the remote store.
			 *
			 * @param {object} query The query object specifying the query fields and
			 * their respective values.
			 * @param {object} options The options object specifying which options are
			 * set, and what the respective values are.
			 *
			 * @protected
			 *
			 * @return {object} The result of invoking the query operation on the
			 * remote store.
			 */
			_query : function(query, options) {
				return this.__invoke(this._encode_query(query, options), true);
			}	

		};
	});
});


/**
 * @class QueryGetParamsRemoteStore
 *
 * QueryGetParamsRemoteStore should be used if the following conditions are met.
 * - Data is remotely accessible. For example, accessible through REST ajax
 *   calls.
 * - Data is quierable and will be queried. 
 *
 * @augments RemoteStore
 */
Scoped.define("module:Stores.QueryGetParamsRemoteStore", [
                                                          "module:Queries",
                                                          "module:Stores.RemoteStore",
                                                          "json:"
                                                          ], function (Queries, RemoteStore, JSON, scoped) {
	return RemoteStore.extend({scoped: scoped}, function (inherited) {			
		return {

			/**
			 * @inheritdoc
			 *
			 * @param {Object} capability_params An object representing the remote
			 * endpoints querying capabilities. The keys are
			 * query aspects the remote data source can handle. The values are the
			 * identifiers for these capabilites in the uri. For example, if a server
			 * can process the skip field in a query, and expects the skip fields to
			 * be called "jump" in the Uri, the capability_param object would be
			 * `{"skip": "jump"}`.
			 * @param {Object} options
			 *
			 * @example <caption>Creation of client side QueryGetParamsRemoteStore</caption>
			 * // returns new QueryGetParamsRemoteStore
			 * new QueryGetParamsRemoteStore('api/v1/people',
			 *                                new BetaJS.Browser.JQueryAjax(),
			 *                                {"skip": "skip", "query": "query"});
			 *
			 * @return {QueryGetParamsRemoteStore} The newly constructed instance of
			 * QueryGetParamsRemoteStore.
			 */
			constructor : function(uri, ajax, capability_params, options) {
				inherited.constructor.call(this, uri, ajax, options);
				this.__capability_params = capability_params;
			},

			/**
			 * @method _query_capabilities
			 *
			 * Helper method for dealing with capability_params.
			 *
			 * @protected
			 *
			 * @return {object} Key/value object where key is possible capability
			 * parameter and value is if that capability_parameter is included for
			 * this instance.
			 */
			_query_capabilities: function () {
				var caps = {};
				if ("skip" in this.__capability_params)
					caps.skip = true;
				if ("limit" in this.__capability_params)
					caps.limit = true;
				if ("query" in this.__capability_params)
					caps.query = Queries.fullQueryCapabilities();
				if ("sort" in this.__capability_params)
					caps.sort = true;
				return caps;
			},

			/**
			 * @method _encode_query
			 *
			 * Helper method that encodes the query and the options into a uri to send
			 * to the remote data source.
			 *
			 * @param {object} query A query to be encoded into uri form. The query
			 * will only be included in the uri if "query" was included in the
			 * capability_params during this instances construction.
			 * @param {object} options A set of options to be encoded into uri form.
			 *
			 * @protected
			 *
			 * @TODO Include the option of including the query param in the uri as a
			 * simple list of keys and values. For example, if the query param is
			 * `{'test': 'hi'}`, the uri becomes 'BASE_URL?test=hi&MORE_PARAMS'
			 * instead of 'BASE_URL?query={"test":"hi"}&MORE_PARAMS'. This change
			 * would increase the number of server/api configurations that could use
			 * this method of encoding queries.
			 *
			 * @return {object} The only key is the uri, and the associated value is
			 * the uri representing the query and the options.
			 */
			_encode_query: function (query, options) {
				options = options || {};
				var uri = this.getUri() + "?"; 
				if (options.skip && "skip" in this.__capability_params)
					uri += this.__capability_params.skip + "=" + options.skip + "&";
				if (options.limit && "limit" in this.__capability_params)
					uri += this.__capability_params.limit + "=" + options.limit + "&";
				if (options.sort && "sort" in this.__capability_params)
					uri += this.__capability_params.sort + "=" + JSON.stringify(options.sort) + "&";
				if ("query" in this.__capability_params)
					uri += this.__capability_params.query + "=" + JSON.stringify(query) + "&";
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
				options = options || {};
				this.__itemCache = {};
				this.__lastKey = null;
				this.__lastKeyIds = {};
				this.__insertsCount = 0;
				this.__increasingKey = options.increasing_key || this.id_key;
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
				if (this.__lastKey) {
					this.insertsIterator().iterate(function (query) {
						var keyQuery = Objs.objectBy(this.__increasingKey, {"$gte": this.__lastKey});
						this._store.query({"$and": [keyQuery, query]}).success(function (result) {
							while (result.hasNext()) {
								var item = result.next();
								var id = this._store.id_of(item);
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
				if (this.__items.unregister(id, context))
					this._unwatchItem(id);
			},

			watchInsert : function(query, context) {
				if (this.__inserts.register(query, context))
					this._watchInsert(query);
			},

			unwatchInsert : function(query, context) {
				if (this.__inserts.unregister(query, context))
					this._unwatchInsert(query);
			},

			_removedItem : function(id) {
				if (!this.__items.get(id))
					return;
				//this.unwatchItem(id, null);
				this._removedWatchedItem(id);
			},

			_updatedItem : function(row, data) {
				var id = row[this.id_key];
				if (!this.__items.get(id))
					return;
				this._updatedWatchedItem(id);
			},

			_insertedInsert : function(data) {
				var trig = false;
				var iter = this.__inserts.iterator();
				while (!trig && iter.hasNext())
					trig = Queries.evaluate(iter.next(), data);
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
                                            "base:Objs"
                                            ], function (AbstractIndex, TreeMap, Objs, scoped) {
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
				if (Objs.is_empty(value))
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

/**
 * @class QueryCollection
 *
 * A base class for querying collections. Subclasses specify the expected type
 * of data store and specify whether the query collection is active.
 */
Scoped.define("module:Collections.QueryCollection", [      
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
				inherited.constructor.call(this);
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
				query = query || {};
				this.update(query.query ? query : {
					query: query,
					options: {
						skip: options.skip || 0,
						limit: options.limit || options.range || null,
						sort: options.sort || null
					}
				});
				if (options.auto)
					this.enable();
			},

			destroy: function () {
				this.disable();
				if (this._watcher()) {
					this._watcher()._unwatchInsert(null, this);
					this._watcher()._unwatchItem(null, this);
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
				constrainedQuery = Constrained.rectify(constrainedQuery);
				var currentSkip = this._query.options.skip || 0;
				var currentLimit = this._query.options.limit || null;
				if (constrainedQuery.query)
					this._query.query = constrainedQuery.query;
				this._query.options = Objs.extend(this._query.options, constrainedQuery.options);
				if (!this._enabled)
					return Promise.create(true);
				if (constrainedQuery.query || "sort" in constrainedQuery.options || !this._incremental)					
					return this.refresh();
				var nextSkip = "skip" in constrainedQuery.options ? constrainedQuery.options.skip || 0 : currentSkip;
				var nextLimit = "limit" in constrainedQuery.options ? constrainedQuery.options.limit || null : currentLimit;
				if (nextSkip === currentSkip && nextLimit === currentLimit)
					return Promise.create(true);
				// No overlap
				if ((nextLimit && nextSkip + nextLimit <= currentSkip) || (currentLimit && currentSkip + currentLimit <= nextSkip))
					return this.refresh();
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
					promise = this._execute(Objs.tree_extend({options: {
						skip: nextSkip,
						limit: leftLimit    
					}}, this._query, 2));
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
				return promise.and(this._execute(Objs.tree_extend({
					options: {
						skip: currentSkip + currentLimit,
						limit: !nextLimit ? null : nextLimit - currentLimit
					}
				}, this._query, 2)));
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
				if (clear)
					this.clear();
				if (this._query.options.sort && !Types.is_empty(this._query.options.sort))
					this.set_compare(Comparators.byObject(this._query.options.sort));
				else
					this.set_compare(null);
				this._unwatchInsert();
				if (this._active)
					this._watchInsert(this._query.query);
				return this._execute(this._query);
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
			_execute: function (constrainedQuery) {
				var limit = constrainedQuery.options.limit;
				return this._subExecute(constrainedQuery.query, constrainedQuery.options).mapSuccess(function (iter) {
					var result = iter.asArray();
					this._complete = limit === null || result.length < limit;
					this.replace_objects(result);
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
                                                          "module:Collections.QueryCollection",
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
                                                          "module:Collections.QueryCollection",
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
				tags = tags || {};
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