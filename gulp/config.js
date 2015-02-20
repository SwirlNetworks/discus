module.exports = {
	dest: 'build/',

	watch: {
		'src/**/*.js': ['browserify', 'min']
	}
}
