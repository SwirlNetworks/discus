var Discus = require('./discus');
var _super = require('./super');
var Backbone = require("backbone");

Discus.Model = function() {
	Backbone.Model.apply(this, arguments);
	this.discusInitialize.apply(this, arguments);
};
Discus.Model.prototype = Backbone.Model.prototype;
Discus.Model.extend = Backbone.Model.extend;

function _setObject(refArray, Obj, value){
  if(refArray.length == 1){
     Obj[refArray[0]] = value;
  } else {
    _setObject(refArray.slice(1,refArray.length), Obj[refArray[0]], value);
  }
}

Discus.Model = Discus.Model.extend({
	_super: _super,

	discusInitialize: function(data) {
		this.___list_view_shared_views = {};
		if (data && data.parent) {
			console.error("Do not give models parents!!");
			debugger; //jshint ignore:line
		}
	},

	set: function(data) {
		if (data.toJSON || data.toArray) {
			debugger; //jshint ignore: line
		}
		return Backbone.Model.prototype.set.apply(this, arguments);
	},

  setSubProp: function(string, value, options){
		var separator = options && options.separator || '.';
		var refs = string.split(separator);
		var prop = this.get(refs[0]);
		_setObject(refs.slice(1,refs.length),prop, value);
		if(options === undefined || (options && options.silent !== undefined && options.silent === false) || (options && options.silent === undefined)){
			this.trigger('change:'+refs[0], this);
		}
	},

  getSubProp: function(string, options){
			var separator = options && options.separator || '.';
			var refs = string.split(separator);
			var topObj = this.get(refs[0]);
			return refs.slice(1, refs.length).reduce(function(obj, i){
				return obj[i];
			}, topObj);
		},

	fetch: function() {
		var res = Backbone.Model.prototype.fetch.apply(this, arguments);

		this.promise = res.promise;
		this.trigger('fetch', res.promise());

		return res;
	},

	save: function() {
		var res = Backbone.Model.prototype.save.apply(this, arguments);

		this.promise = res.promise;
		this.trigger('save', res.promise());

		return res;
	},

	getMetadata: function(field) {
		return this.metadata[field];
	},
	value: function(field) {
		var metadata = this.getMetadata(field);

		if (metadata && typeof metadata.value === 'function') {
			return metadata.value.apply(this, [field]);
		}

		return this.get(field);
	},
	displayValue: function(field) {
		var metadata = this.getMetadata(field);

		if (metadata && typeof metadata.displayValue === 'function') {
			return metadata.displayValue.apply(this, [field]);
		}

		return this.value(field);
	},
	filterValue: function(field) {
		var metadata = this.getMetadata(field);

		if (metadata && typeof metadata.getFilterData === 'function') {
			return metadata.getFilterData.apply(this, [field]);
		}

		return this.value(field);
	},
	metadata: {
		title: {
			name: "Title",
			type: "string"
		}
	}
});

module.exports = Discus.Model;
