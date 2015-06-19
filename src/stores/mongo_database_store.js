Scoped.define("module:Stores.MongoDatabaseStore", [
        "data:Stores.TransformationStore",
        "base:Objs",                                                   
        "module:Stores.DatabaseStore"
    ], function (TransformationStore, Objs, DatabaseStore, scoped) {
    return TransformationStore.extend({scoped: scoped}, function (inherited) {
		return {
			
			constructor: function (database, table_name, types, foreign_id) {
				var store = new DatabaseStore(database, table_name, foreign_id);
				this._types = types || {};
		        if (!foreign_id)
				    this._types.id = "id";
		        this._foreign_id = foreign_id;
		        this._ObjectId = database.mongo_object_id();
				inherited.constructor.call(this, store);
			},
			
			table: function () {
				return this.store().table();
			},
			
			_encodeData: function (data) {
				var result = Objs.map(data, function (value, key) {
					if (this._types[key] === "id")
						return value ? new this._ObjectId(value + "") : null;
					return value;
				}, this);
				if (this._foreign_id) {
					result.id = result[this._foreign_id];
					delete result[this._foreign_id];
				}
				return result;
			},
			
			_decodeData: function (data) {
				var result = Objs.map(data, function (value, key) {
					if (this._types[key] === "id")
						return value ? value + "" : null;
					return value;
				}, this);
				if (this._foreign_id) {
					result[this._foreign_id] = result.id;
					delete result.id;
				}
				return result;
			}			

		};
    });
});
