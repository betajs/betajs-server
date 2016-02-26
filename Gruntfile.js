module.exports = function(grunt) {

	var pkg = grunt.file.readJSON('package.json');
	var gruntHelper = require('betajs-compile/grunt.js');
	var dist = 'betajs-server';

	gruntHelper.init(pkg, grunt)
	
	
    /* Compilation */    
	.scopedclosurerevisionTask(null, "src/**/*.js", "dist/" + dist + "-noscoped.js", {
		"module": "global:BetaJS.Server",
		"base": "global:BetaJS",
		"data": "global:BetaJS.Data"
    }, {
    	"base:version": 444,
    	"data:version": 56
    })	
    .concatTask('concat-scoped', ['vendors/scoped.js', 'dist/' + dist + '-noscoped.js'], 'dist/' + dist + '.js')
    .uglifyTask('uglify-noscoped', 'dist/' + dist + '-noscoped.js', 'dist/' + dist + '-noscoped.min.js')
    .uglifyTask('uglify-scoped', 'dist/' + dist + '.js', 'dist/' + dist + '.min.js')
    .packageTask()

    /* Testing */
    .qunitTask(null, './dist/' + dist + '-noscoped.js',
    				 grunt.file.expand("./tests/*/*.js"),
    		         ['./vendors/scoped.js', './vendors/beta-noscoped.js', "./vendors/betajs-data-noscoped.js"])
    .closureTask(null, ["./vendors/scoped.js", "./vendors/beta-noscoped.js", "./vendors/betajs-data-noscoped.js", "./dist/betajs-server-noscoped.js"])
    .lintTask(null, ['./src/**/*.js', './dist/' + dist + '-noscoped.js', './dist/' + dist + '.js', './Gruntfile.js', './tests/**/*.js'])
    
    /* External Configurations */
    .codeclimateTask()
    
    /* Dependencies */
    .dependenciesTask(null, { github: ['betajs/betajs-scoped/dist/scoped.js', 'betajs/betajs/dist/beta-noscoped.js', 'betajs/betajs-data/dist/betajs-data-noscoped.js'] })

    /* Markdown Files */
	.readmeTask()
    .licenseTask()
    
    /* Documentation */
    .docsTask();

	grunt.initConfig(gruntHelper.config);	

	grunt.registerTask('default', ['package', 'readme', 'license', 'codeclimate', 'scopedclosurerevision', 'concat-scoped', 'uglify-noscoped', 'uglify-scoped']);
	grunt.registerTask('check', [ 'lint', 'qunit' ]);

};

