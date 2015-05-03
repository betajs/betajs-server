module.banner = '/*!\n<%= pkg.name %> - v<%= pkg.version %> - <%= grunt.template.today("yyyy-mm-dd") %>\nCopyright (c) <%= pkg.contributors %>\n<%= pkg.license %> Software License.\n*/\n';

module.exports = function(grunt) {

	grunt
			.initConfig({
				pkg : grunt.file.readJSON('package.json'),
				'revision-count' : {
					options : {
						property : 'revisioncount',
						ref : 'HEAD'
					}
				},
				concat : {
					options : {
						banner : module.banner
					},
					dist_raw : {
						dest : 'dist/beta-server-raw.js',
						src : [ 'src/fragments/begin.js-fragment',

						'src/net/*.js', 'src/sessions/*.js',
								'src/databases/*.js', 'src/stores/*.js',
								'src/fragments/end.js-fragment' ]
					},
					dist_scoped : {
						dest : 'dist/beta-server.js',
						src : [ 'vendors/scoped.js',
								'dist/beta-server-noscoped.js' ]
					}
				},
				preprocess : {
					options : {
						context : {
							MAJOR_VERSION : '<%= revisioncount %>',
							MINOR_VERSION : (new Date()).getTime()
						}
					},
					dist : {
						src : 'dist/beta-server-raw.js',
						dest : 'dist/beta-server-noscoped.js'
					}
				},
				clean : {
					raw : "dist/beta-server-raw.js",
					closure : "dist/beta-server-closure.js"
				},
				uglify : {
					options : {
						banner : module.banner
					},
					dist : {
						files : {
							'dist/beta-server-noscoped.min.js' : [ 'dist/beta-server-noscoped.js' ],
							'dist/beta-server.min.js' : [ 'dist/beta-server.js' ]
						}
					}
				},
				jshint : {
					options : {
						es5 : false,
						es3 : true
					},
					source : [ "./src/*/*.js" ],
					dist : [ "./dist/beta-server-noscoped.js",
							"./dist/beta-server.js" ],
					gruntfile : [ "./Gruntfile.js" ],
					tests : [ "./tests/*.js" ]
				},
				closureCompiler : {
					options : {
						compilerFile : process.env.CLOSURE_PATH + "/compiler.jar",
						compilerOpts : {
							compilation_level : 'ADVANCED_OPTIMIZATIONS',
							warning_level : 'verbose',
							externs : [ "./src/fragments/closure.js-fragment" ]
						}
					},
					dist : {
						src : [ "./vendors/beta.js",
								"./vendors/beta-data-noscoped.js",
								"./dist/beta-server-noscoped.js" ],
						dest : "./dist/beta-server-closure.js"
					}
				},
				wget : {
					dependencies : {
						options : {
							overwrite : true
						},
						files : {
							"./vendors/scoped.js" : "https://raw.githubusercontent.com/betajs/betajs-scoped/master/dist/scoped.js",
							"./vendors/beta.js" : "https://raw.githubusercontent.com/betajs/betajs/master/dist/beta.js",
							"./vendors/beta-data-noscoped.js" : "https://raw.githubusercontent.com/betajs/betajs-data/master/dist/beta-data-noscoped.js"
						}
					}
				},
				'node-qunit' : {
					dist : {
						deps: ['./vendors/beta.js', './vendors/beta-data-noscoped.js'],
						code : './dist/beta-server.js',
						tests : grunt.file.expand("./tests/*.js"),
						done : function(err, res) {
							publishResults("node", res, this.async());
						}
					}
				},
				template : {
					"readme" : {
						options : {
							data: {
								indent: "",
								framework: grunt.file.readJSON('package.json')
							}
						},
						files : {
							"README.md" : ["readme.tpl"]
						}
					}
				}
			});

	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-git-revision-count');
	grunt.loadNpmTasks('grunt-preprocess');
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-wget');
	grunt.loadNpmTasks('grunt-closure-tools');
	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-node-qunit');
	grunt.loadNpmTasks('grunt-jsdoc');
	grunt.loadNpmTasks('grunt-template');	

	grunt.registerTask('default', [ 'revision-count', 'concat:dist_raw',
			'preprocess', 'clean:raw', 'concat:dist_scoped', 'uglify' ]);
	grunt.registerTask('qunit', [ 'node-qunit' ]);
	grunt.registerTask('lint', [ 'jshint:source', 'jshint:dist',
			'jshint:tests', 'jshint:gruntfile' ]);
	grunt.registerTask('check', [ 'lint', 'qunit' ]);
	grunt.registerTask('dependencies', [ 'wget:dependencies' ]);
	grunt.registerTask('closure', [ 'closureCompiler', 'clean:closure' ]);
	grunt.registerTask('readme', [ 'template:readme' ]);

};


