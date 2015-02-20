var Discus = require('./discus');
require('./view'); // depends on view

Discus.Screen = Discus.View.extend({
	discusInitialize: function() {
		this._super('discusInitialize');
	}
});
