test("mongo database store", function () {	
	var mongodb = new BetaJS.Server.Databases.MongoDatabase("mongodb://localhost/betajsservertest");
	var store = new BetaJS.Server.Stores.MongoDatabaseStore(mongodb, "tests");
	store.insert({x: 5}).success(function (object) {
		ok(!!object.id);
		QUnit.equal(object.x, 5);
		store.update(object.id, {
			y: 7
		}).success(function (row) {
			start();
			QUnit.equal(row.y, 7);
			QUnit.equal(this.z, 3);
		}, {z: 3});
	});
	stop();
});