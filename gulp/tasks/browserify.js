var gulp = require('gulp');
var browserify = require('gulp-browserify');
var rename = require('gulp-rename');
var config = require('../config');
var uglify = require('gulp-uglify');

var plumber = require('gulp-plumber');

gulp.task('browserify', function() {
	gulp.src('src/main.js', { read: false })
		.pipe(plumber())
		.pipe(browserify({
			external: ['backbone', 'underscore'],
			standalone: 'Discus'
		}))
		.pipe(rename('discus.js'))
		.pipe(gulp.dest(config.dest))
		.pipe(uglify({
		}))
		.pipe(rename('discus.min.js'))
		.pipe(gulp.dest(config.dest))
});
