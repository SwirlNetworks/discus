var gulp = require('gulp');
var config = require('../config');

gulp.task('watch', function() {
	for (path in config.watch) {
		if (!config.watch.hasOwnProperty(path)) { continue; }
		console.log('Watching', path);
		gulp.watch(path, config.watch[path]);
	}
});
