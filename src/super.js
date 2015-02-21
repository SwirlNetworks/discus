var Discus = require('./discus');

// Find the next object up the prototype chain that has a
// different implementation of the method.
function findSuper(methodName, childObject) {
	var object = childObject;
	while (object[methodName] === childObject[methodName]) {
		object = object.constructor.__super__;

		if (!object) {
			throw new Error('Class has no super method for', methodName, '. Remove the _super call to the non-existent method');
		}
	}
	return object;
}

// The super method takes two parameters: a method name
// and an array of arguments to pass to the overridden method.
// This is to optimize for the common case of passing 'arguments'.
function _super(methodName, args) {
	// Keep track of how far up the prototype chain we have traversed,
	// in order to handle nested calls to _super.
	if (this._superCallObjects === undefined) { this._superCallObjects = {}; }
	var oldSuperCallback = this._superCallObjects[methodName],
		currentObject = oldSuperCallback || this,
		parentObject  = findSuper(methodName, currentObject),
		result;
	this._superCallObjects[methodName] = parentObject;

	try {
		result = parentObject[methodName].apply(this, args || []);
	} finally {
		if (oldSuperCallback) {
			this._superCallObjects[methodName] = oldSuperCallback;
		} else {
			delete this._superCallObjects[methodName];
		}
	}
	return result;
}

_.each(["Collection", "Router"], function(klass) {
	Discus[klass].prototype._super = _super;
});

module.exports = _super;
