Scoped.define("module:Stores.MongoDatabaseStore", [
        "data:Stores.ConversionStore",
        "base:Objs",                                                   
        "module:Stores.DatabaseStore"
    ], function (ConversionStore, Objs, DatabaseStore, scoped) {
    return ConversionStore.extend({scoped: scoped}, function (inherited) {
		return {
			
			constructor: function (database, table_name, types, foreign_id) {
				var store = new DatabaseStore(database, table_name, foreign_id);
				var encoding = {};
				var decoding = {};
				types = types || {};
		        var ObjectId = database.mongo_object_id();
		        if (!foreign_id)
				    types.id = "id";
		        Objs.iter(types, function (keyValue, key) {
					if (keyValue == "id") {
						encoding[key] = function (value) {
							return value ? new ObjectId(value + "") : null;
						};
						decoding[key] = function (value) {
							return value ? value + "" : null;
						};
					}
		        }, this);
				var opts = {
		            value_encoding: encoding,
		            value_decoding: decoding
				};
				if (foreign_id) {
				    opts.key_encoding = {
				        "id": foreign_id
				    };
				    opts.key_encoding[foreign_id] = null;
		            opts.key_decoding = {
		                "id": null
		            };
		            opts.key_encoding[foreign_id] = "id";
				}
				inherited.constructor.call(this, store, opts);
			},
			
			table: function () {
				return this.store().table();
			}

		};
    });
});
