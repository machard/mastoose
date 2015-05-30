'use strict';

module.exports = function(grunt) {
  require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);

  process.env.MASTOOSE_TEST_DB = process.env.MASTOOSE_TEST_DB || 'mongodb://localhost/mastoose_test';

  // Project configuration.
  grunt.initConfig({
    mochacov : {
      lib : {
        options : {
          coveralls : process.env.CI,
        },
        src : ['tests/**.js']
      },
      coverage : {
        options : {
          reporter : 'html-cov',
          quiet : true,
          output : 'coverage.html'
        },
        src : ['tests/**.js']
      },
      'travis-cov' : {
        options : {
          reporter : 'travis-cov'
        },
        src : ['tests/**.js']
      }
    },
    jshint : {
      options : {
        jshintrc : '.jshintrc'
      },
      gruntfile : {
        src : 'Gruntfile.js'
      },
      lib : {
        src : ['src/**.js']
      },
      tests : {
        src : ['tests/**.js']
      },
    },
    watch : {
      gruntfile : {
        files : '<%= jshint.gruntfile.src %>',
        tasks : ['jshint:gruntfile']
      },
      lib : {
        files : '<%= jshint.lib.src %>',
        tasks : ['jshint:lib', 'mochacov']
      },
      tests : {
        files : '<%= jshint.tests.src %>',
        tasks : ['jshint:tests', 'mochacov']
      },
    },
    clean : {
      tests : ['./coverage.html']
    }
  });

  // Default task.
  grunt.registerTask('default', 'watch');
  grunt.registerTask('test', ['jshint', 'clean:tests', 'mochacov']);

};
