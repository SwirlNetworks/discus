var Discus = require('./discus');
var ListView = require('./list_view');
var TableEntry = require('./table_entry');
var $ = require('jquery');

Discus.TableView = ListView.extend({
	defaults: function() {
		var data = this._super("defaults", arguments);

		$.extend(data, {
			sparse: true,
			renderLimit: 12,
			renderThrottle: 150,
			sparseTagName: 'tbody',
			sparseClassName: 'tableView',
			sparseLimit: 100,

			viewClass: Discus.TableEntry
		});

		return data;
	},
	tagName: 'table'
});

module.exports = Discus.TableView;
