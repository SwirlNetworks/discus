var Discus = require('./discus');
var ListView = require('./list_view');
var TableEntry = require('./table_entry');
var $ = require('jquery');
var _ = require('underscore');

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

	tagName: 'table',

	initialize: function() {
		if (!this.options.columns || !_.isArray(this.options.columns)) {
			throw new Error("You must pass columns in to Talbe View");
		}

		this._super("initialize", arguments);

		this.stateModel.set({
			columns: this.options.columns
		});
	},

	renderHeader: function() {
		// render header!
		this.$('thead').remove();
		var thead = $('<thead />'),
			th = $('<th />');

		this.$el.prepend(thead);

		thead.append(th);

		_(this.stateModel.get('columns')).each(function(column) {
			th.append('<td>' + column + '</td>');
		});
	}
});

module.exports = Discus.TableView;
