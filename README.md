# betajs-server 1.0.29
[![Code Climate](https://codeclimate.com/github/betajs/betajs-server/badges/gpa.svg)](https://codeclimate.com/github/betajs/betajs-server)
[![NPM](https://img.shields.io/npm/v/betajs-server.svg?style=flat)](https://www.npmjs.com/package/betajs-server)
[![Gitter Chat](https://badges.gitter.im/betajs/betajs-server.svg)](https://gitter.im/betajs/betajs-server)

BetaJS-Server is a server-side JavaScript framework extension for BetaJS.



## Getting Started


You can use the library in your NodeJS project and compile it as well.

#### NodeJS

```javascript
	var BetaJS = require('betajs/dist/beta.js');
	require('betajs-data/dist/betajs-data.js');
	require('betajs-server/dist/betajs-server.js');
```


#### Compile

```javascript
	git clone https://github.com/betajs/betajs-server.git
	npm install
	grunt
```



## Basic Usage


The BetaJS Server module contains the following subsystems:
- Database Access and Database Store with Support for MongoDB
- Server-Side AJAX
- Server-Side Session Management


```javascript
	var mongodb = new BetaJS.Server.Databases.MongoDatabase("mongodb://localhost/test-db");
	var store = new BetaJS.Server.Stores.MongoDatabaseStore(mongodb, "test-collection");
	store.insert({x: 5}).success(function (object) {
		console.log(object);
		store.update(object.id, {
			y: 7
		}).success(function (row) {
			console.log(row);
		}, {z: 3});
	});
```



## Links
| Resource   | URL |
| :--------- | --: |
| Homepage   | [https://betajs.com](https://betajs.com) |
| Git        | [git://github.com/betajs/betajs-server.git](git://github.com/betajs/betajs-server.git) |
| Repository | [https://github.com/betajs/betajs-server](https://github.com/betajs/betajs-server) |
| Blog       | [https://blog.betajs.com](https://blog.betajs.com) | 
| Twitter    | [https://twitter.com/thebetajs](https://twitter.com/thebetajs) | 
| Gitter     | [https://gitter.im/betajs/betajs-server](https://gitter.im/betajs/betajs-server) | 



## Compatability
| Target | Versions |
| :----- | -------: |
| NodeJS | 4.0 - Latest |


## CDN
| Resource | URL |
| :----- | -------: |
| betajs-server.js | [http://cdn.rawgit.com/betajs/betajs-server/master/dist/betajs-server.js](http://cdn.rawgit.com/betajs/betajs-server/master/dist/betajs-server.js) |
| betajs-server.min.js | [http://cdn.rawgit.com/betajs/betajs-server/master/dist/betajs-server.min.js](http://cdn.rawgit.com/betajs/betajs-server/master/dist/betajs-server.min.js) |
| betajs-server-noscoped.js | [http://cdn.rawgit.com/betajs/betajs-server/master/dist/betajs-server-noscoped.js](http://cdn.rawgit.com/betajs/betajs-server/master/dist/betajs-server-noscoped.js) |
| betajs-server-noscoped.min.js | [http://cdn.rawgit.com/betajs/betajs-server/master/dist/betajs-server-noscoped.min.js](http://cdn.rawgit.com/betajs/betajs-server/master/dist/betajs-server-noscoped.min.js) |



## Dependencies
| Name | URL |
| :----- | -------: |
| betajs | [Open](https://github.com/betajs/betajs) |
| betajs-data | [Open](https://github.com/betajs/betajs-data) |


## Weak Dependencies
| Name | URL |
| :----- | -------: |
| betajs-scoped | [Open](https://github.com/betajs/betajs-scoped) |


## Main Contributors

- Oliver Friedmann

## License

Apache-2.0







