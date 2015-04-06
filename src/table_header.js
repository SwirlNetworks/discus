var Discus = require('./discus');
var $ = require('jquery');
var _ = require('underscore');

Discus.TableHeader = Discus.View.extend({
	defaults: function() {
		return {
			flaoting: false
		};
	},
	tagName: 'thead',

	stateModelEvents: {
		'table': {
			'change:columns': 'render'
		}
	},

	initialize: function() {
		// convenience reference
		this.table = this.options.parent;

		// get the scoped table state model from the parent chain
		this.stateModel = this.getSharedStateModel('table');
	},

	render: function() {
		var self = this,
			columns = this.stateModel.get('columns'),
			tr = $('<tr />');


		this.$el.empty();
		this.$el.append(tr);

		_(columns).each(function(col) {
			tr.append('<th>' + col + '</th>');
		});
	}

});

module.exports = Discus.TableHeader;
