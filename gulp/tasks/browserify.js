var gulp = require('gulp');
var browserify = require('gulp-browserify');
var rename = require('gulp-rename');
var config = require('../config');
var uglify = require('gulp-uglify');
var replace = require('gulp-replace');
var license = require('gulp-license');
var clone = require('gulp-clone');
var fs = require('fs');

var plumber = require('gulp-plumber');

gulp.task('browserify', function() {
	var stream = gulp.src('src/main.js', { read: false })
		.pipe(plumber())
		.pipe(browserify({
			external: ['backbone', 'underscore', 'jquery'],
			standalone: 'Discus'
		}))
		.pipe(license('MIT', {
			organization: 'Swirl'
		}))

		.pipe(rename('discus.js'));

	var cloned = stream.pipe(clone());

	if (fs.existsSync('gulp/tasks/vendor.js')) {
		require('./vendor')(stream);
	}

	// do the rest of the build like normal
	cloned.pipe(gulp.dest(config.dest))
		.pipe(uglify({
		}))
		.pipe(rename('discus.min.js'))
		.pipe(gulp.dest(config.dest));
});
