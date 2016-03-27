Database Stores allow you to access a database table through the abstract of a `Store`, providing all the additional functionality from the `BetaJS-Data` module.

Once you have instantiated your `database` instance, you can create a corresponding `Store` for a table as follows, e.g. for a MongoDB:

```javascript
	var store = new BetaJS.Server.Stores.MongoDatabaseStore(database, "my-database-table");
```