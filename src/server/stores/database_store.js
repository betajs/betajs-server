BetaJS.Stores.BaseStore.extend("BetaJS.Stores.DatabaseStore", {
	
	constructor: function (database, table_name, foreign_id) {
		this._inherited(BetaJS.Stores.DatabaseStore, "constructor");
		this.__database = database;
		this.__table_name = table_name;
		this.__table = null;
		this.__foreign_id = foreign_id;
	},
	
	table: function () {
		if (!this.__table)
			this.__table = this.__database.getTable(this.__table_name);
		return this.__table;
	},
	
	_insert: function (data) {
	    if (!this.__foreign_id || !data[this.__foreign_id])
	        return this.table().insertRow(data);
	    return this.table().findOne(BetaJS.Objs.objectBy(this.__foreign_id, data[this.__foreign_id])).mapSuccess(function (result) {
	    	return result ? result : this.table().insertRow(data);
	    }, this);
	},
	
	_remove: function (id) {
	    if (!this.__foreign_id)
		    return this.table().removeById(id);
		return this.table().removeRow(BetaJS.Objs.objectBy(this.__foreign_id, id));
	},
	
	_get: function (id) {
        if (!this.__foreign_id)
    		return this.table().findById(id);
	    return this.table().findOne(BetaJS.Objs.objectBy(this.__foreign_id, id));
	},
	
	_update: function (id, data) {
        if (!this.__foreign_id)
    		return this.table().updateById(id, data);
        return this.updateRow(BetaJS.Objs.objectBy(this.__foreign_id, id), data);
	},
	
	_query_capabilities: function () {
		return {
			"query": true,
			"sort": true,
			"skip": true,
			"limit": true
		};
	},
	
	_query: function (query, options) {
		return this.table().find(query, options);
	},
	
	_ensure_index: function (key) {
		this.table().ensureIndex(key);
	}

});
