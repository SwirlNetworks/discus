var Discus = require('./discus');
require('./view'); // depends on view

Discus.Screen = Discus.View.extend({
	screenStateModel: function() {
		return this.stateModel;
	}
});
