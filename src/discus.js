var Backbone = require("backbone");

function CreateClone() {
	var root = this,
		_sync = root.sync,
		Module;
	function Factory(){
	}
	Factory.prototype = root;
	Factory.prototype.createClone = CreateClone;

	Module = new Factory();

	root.sync = function() {
		if (Module.hasOwnProperty('sync')) {
			return Module.sync.apply(Module, arguments);
		}
		return _sync.apply(root, arguments);
	};

	return Module;
}

module.exports = CreateClone.apply(Backbone);
