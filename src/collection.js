var Discus = require('./discus');
require('./model');
var _super = require('./super');
var Backbone = require("backbone");

Discus.Collection = function() {
	Backbone.Collection.apply(this, arguments);
	this.discusInitialize.apply(this, arguments);
};
Discus.Collection.prototype = Backbone.Collection.prototype;
Discus.Collection.extend = Backbone.Collection.extend;

Discus.Collection = Discus.Collection.extend({
	_super: _super,
	model: Discus.Model,

	discusInitialize: function() {
		// do nothing


		// profit?
	}
});

module.exports = Discus.Collection;
