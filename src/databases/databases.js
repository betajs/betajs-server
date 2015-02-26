Scoped.define("module:Databases.Database", [      
        "base:Class"
    ], function (Class, scoped) {
    return Class.extend({scoped: scoped}, {
		
		_tableClass: function () {
			return null;
		},
		
		getTable: function (table_name) {
			var cls = this._tableClass();		
			return new cls(this, table_name);
		}

    });
});
