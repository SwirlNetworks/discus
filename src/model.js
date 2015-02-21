var Discus = require('./discus');
var _super = require('./super');
var Backbone = require('backbone');

Discus.Model = function() {
	Backbone.Model.apply(this, arguments);
	this.discusInitialize.apply(this, arguments);
};
Discus.Model.prototype = Backbone.Model.prototype;
Discus.Model.extend = Backbone.Model.extend;

Discus.Model = Discus.Model.extend({
	_super: _super,

	discusInitialize: function(data) {
		this.___list_view_shared_views = {};
		if (data && data.parent) {
			console.error("Do not give models parents!!");
			debugger;
		}
	},

	set: function(data) {
		if (data.toJSON || data.toArray) {
			debugger; //jshint ignore: line
		}
		return Backbone.Model.prototype.set.apply(this, arguments);
	},

	fetch: function() {
		var res = Backbone.Model.prototype.fetch.apply(this, arguments);

		this.promise = res.promise;
		this.trigger('fetch', res.promise());

		return res;
	}
});

module.exports = Discus.Model;
