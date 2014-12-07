BetaJS.Class.extend("BetaJS.Databases.DatabaseTable", {
	
	constructor: function (database, table_name) {
		this._inherited(BetaJS.Databases.DatabaseTable, "constructor");
		this._database = database;
		this._table_name = table_name;
	},

	findOne: function (query, options) {
		return this._findOne(this._encode(query), options).mapSuccess(function (result) {
			return !result ? null : this._decode(result);
		}, this);
	},
	
	_findOne: function (query, options) {
		options = options || {};
		options.limit = 1;
		return this._find(query, options).mapSuccess(function (result) {
			return result.next();
		});
	},
	
	_encode: function (data) {
		return data;	
	},
	
	_decode: function (data) {
		return data;
	},

	_find: function (query, options) {
	},

	find: function (query, options) {
		return this._find(this._encode(query), options).mapSuccess(function (result) {
			return new BetaJS.Iterators.MappedIterator(result, this._decode, this);
		}, this);
	},
	
	findById: function (id) {
		return this.findOne({id : id});
	},
	
	_insertRow: function (row) {		
	},
	
	_removeRow: function (query) {		
	},
	
	_updateRow: function (query, row) {
	},
	
	insertRow: function (row) {
		return this._insertRow(this._encode(row)).mapSuccess(this._decode, this);
	},
	
	removeRow: function (query) {
		return this._removeRow(this._encode(query));
	},
	
	updateRow: function (query, row) {
		return this._updateRow(this._encode(query), this._encode(row)).mapSuccess(this._decode, this);
	},
	
	removeById: function (id) {
		return this.removeRow({id : id});
	},
	
	updateById: function (id, data) {
		return this.updateRow({id: id}, data);
	},
	
	ensureIndex: function (key) {}
	
});