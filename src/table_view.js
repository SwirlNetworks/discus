var Discus = require('./discus');
var ListView = require('./list_view');
var TableEntry = require('./table_entry');
var TableHeader = require('./table_header');

var $ = require('jquery');
var _ = require('underscore');

Discus.TableView = ListView.extend({
	defaults: function() {
		var data = this._super("defaults", arguments);

		// debugger;
		$.extend(data, {
			sparse: true,
			renderLimit: 12,
			renderThrottle: 150,
			sparseTagName: 'tbody',
			sparseClassName: 'tableView',
			sparseLimit: 100,

			viewClass: TableEntry,
			headerViewClass: TableHeader,

			// classname based options
			table: true,
			hover: false,
			bordered: false,
			striped: false
		});

		return data;
	},

	tagName: 'table',

	stateModelEvents: {
		'change:columns': 'resetCollection'
	},

	initialize: function() {
		if (!this.options.columns || !_.isArray(this.options.columns)) {
			throw new Error("You must pass columns in to Talbe View");
		}
		if (this.options.table) {
			this.className += ' table';
		}
		if (this.options.hover) {
			this.className += ' table-hover';
		}
		if (this.options.bordered) {
			this.className += ' table-bordered';
		}
		if (this.options.striped) {
			this.className += ' table-striped';
		}

		this._super("initialize", arguments);

		this.$el.attr('class', this.className);

		this.createSharedStateModel('table', this.stateModel);

		this.stateModel.set({
			columns: this.options.columns
		});

		this.tableHeader = new this.options.headerViewClass({
			parent: this
		});
	},

	renderHeader: function() {
		// render header!
		// put the header at the very beginning again. It generally should already be there...
		// we rely on lifecycle events for the view to render properly, so we only move the element for now
		this.tableHeader.$el.prependTo(this.$el);

		// jk
		this.tableHeader.render();
	}
});

module.exports = Discus.TableView;
