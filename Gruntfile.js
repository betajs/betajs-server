module.banner = '/*!\n<%= pkg.name %> - v<%= pkg.version %> - <%= grunt.template.today("yyyy-mm-dd") %>\nCopyright (c) <%= pkg.contributors %>\n<%= pkg.license %> Software License.\n*/\n';

module.exports = function(grunt) {

	grunt.initConfig({
		pkg : grunt.file.readJSON('package.json'),
		concat : {
			options : {
				banner : module.banner
			},
			dist: {
				dest: 'dist/beta-server.js',
				src: [
					'src/server/net/*.js',
					
                    'src/server/sessions/sessions.js',
                    'src/server/sessions/*.js',

					'src/server/databases/databases.js',
					'src/server/databases/database_tables.js',
					'src/server/databases/mongo_database.js',
					'src/server/databases/mongo_database_table.js',
					'src/server/stores/database_store.js',
					'src/server/stores/mongo_database_store.js',
					'src/server/stores/migrator.js',
					'src/server/stores/imap_store.js'
				]
			},
		},
		uglify : {
			options : {
				banner : module.banner
			},
			dist : {
				files : {
					'dist/beta-server.min.js' : [ 'dist/beta-server.js' ],					
				}
			}
		},
		shell: {
			lint: {
		    	command: "jsl +recurse --process ./src/*.js",
		    	options: {
                	stdout: true,
                	stderr: true,
            	},
            	src: [
            		"src/*/*.js"
            	]
			},
		},
	});

	grunt.loadNpmTasks('grunt-newer');
	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-shell');	

	grunt.registerTask('default', ['newer:concat', 'newer:uglify']);
	grunt.registerTask('lint', ['shell:lint']);	
	grunt.registerTask('check', ['lint']);

};