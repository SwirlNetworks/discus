
/**
 * Model -
 *  Convenience and safety extensions of core Backbone.Model
 */
define(['jquery', 'backbone', 'underscore',
],
	function($, Backbone, _) {
		var _set = Backbone.Model.prototype.set,
			_fetch = Backbone.Model.prototype.fetch;

		$.extend(Backbone.Model.prototype, {
			//Safety - prevent setting a BB model as an attribute on another model
			//  i.e. model.set(otherModel); -> fail
			set: function(data) {
				if (data.toJSON || data.toArray) {
					debugger; //jshint ignore: line
				}
				return _set.apply(this, arguments);
			},

			//Convenience - exposes model's fetch promise as an attribute on the model directly
			// i.e. model.fetch(); model.promise().done(...);
			fetch: function() {
				var res = _fetch.apply(this, arguments);
				this.promise = res.promise;

				return res;
			}
		});

	});