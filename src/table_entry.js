var _ = require('underscore');
var Discus = require('./discus');

Discus.TableEntry = Discus.View.extend({
	template: _.template([
		'<td>It worked!</td>'
	].join('')),

	tagName: 'tr',

	initialize: function() {
		console.log('This is a table entry!');
	}
});

module.exports = Discus.TableView;
