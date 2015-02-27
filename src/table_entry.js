var _ = require('underscore');
var Discus = require('./discus');

Discus.TableEntry = Discus.View.extend({
	tagName: 'tr',

	initialize: function() {
		this._super('initialize', arguments);
		this.table = this.options.parent;
	},

	render: function() {
		var self = this;

		this.$el.empty();

		_(this.table.stateModel.get('columns')).each(function(column) {
			self.renderColumn(column, self.model.displayValue(column));
		});

		this.redelegateEvents();
	},

	renderColumn: function(name, value) {
		this.$el.append('<td>' + value + '</td>');
	}
});

module.exports = Discus.TableView;
