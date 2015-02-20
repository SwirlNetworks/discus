var _ = require('underscore');
var Discus = require('./discus');
var _super = require('./super');

// define base class
Discus.Object = function() {
	var self = this,
		initParams;
	this.cid = _.uniqueId('class');
	initParams = arguments;
	self.init = (function() {
		var result = self.initialize.apply(self, initParams);
		return function() { return result; };
	}());
};

_.extend(Discus.Object.prototype, Discus.Events, {
	initialize: function() { return this; },
	_super: _super
});

Discus.Object.extend = Discus.Model.extend;

module.exports = Discus.Object;
