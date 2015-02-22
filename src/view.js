var Discus = require('./discus');
var _super = require('./super');
var _ = require('underscore');
var Backbone = require("backbone");
var $ = require("jquery");

var needsConfigureShim = Discus.VERSION_ARRAY[0] >= 1 && Discus.VERSION_ARRAY[1] >= 1;

Discus.View = function(options) {
	if (needsConfigureShim) {
		this.options = options;
	}
	Backbone.View.apply(this, arguments);
	this.discusInitialize();
};
Discus.View.prototype = Backbone.View.prototype;
Discus.View.extend = Backbone.View.extend;

Discus.View = Discus.View.extend({
	_super: _super,
	
	__lsModelCache: {},

	_configure: function(options) {
		if (!needsConfigureShim) {
			this._super("_configure", arguments);
		}

		this.options = options;
		_.defaults(this.options, _.isFunction(this.defaults) ? this.defaults() : this.defaults);

		this.__children = {};

		this._checkRenderComplete = this.checkRenderComplete;
		this.checkRenderComplete = _.debounce(this.checkRenderComplete, 10);
	},
	discusInitialize: function() {
		if (this.options.parent) {
			if (this.options.parent === window) {
				console.error("Passed in parent: this when you meant to do parent: self");
				debugger; //jshint ignore:line
				return;
			}
			this.setParent(this.options.parent);
		} else if (this.options.renderTo) {
			console.error("renderTo does nothing without a parent!");
			debugger; //jshint ignore:line
		}

		if (this.model && _.isFunction(this.model.promise)) {
			this.readyAfter(this.model.promise());
			this.listenTo(this.model, "fetch", this.readyAfter);
		}
		if (this.collection && _.isFunction(this.collection.promise)) {
			this.readyAfter(this.collection.promise());
			this.listenTo(this.collection, "fetch fetchAll", this.readyAfter);
		}
	},

	clearTimeout: function(timerID) {
		if (this.__timerIDS) {
			this.__timerIDS = _(this.__timerIDS).without(timerID);
		}
		return clearTimeout(timerID);
	},
	setTimeout: function(fn, timeout, args) {
		var self = this,
			timerID;

		timerID = setTimeout(function() {
			this.__timerIDS = _(this.__timerIDS).without(timerID);
			fn.apply(self, args);
		});

		if (!this.__timerIDS) {
			this.__timerIDS = [timerID];
		} else {
			this.__timerIDS.push(timerID);
		}

		return timerID;
	},

	addChild: function(child) {
		if (!this.__children) {
			this.__children = {};
		}
		this.__children[child.cid] = child;

		this.listenTo(child, "destroyed", function() {
			this.removeChild(child);
		});
		this.listenTo(child, "renderComplete", this.checkRenderComplete);
	},
	removeChild: function(child) {
		delete this.__children[child.cid];
		this.stopListening(child);
		if (child.parent().cid === this.cid) {
			child.setParent();
		}
	},
	hasParent: function() {
		return !!this.__current_parent;
	},
	parent: function() {
		return this.__current_parent;
	},
	setParent: function(parent) {
		if (this.__current_parent) {
			if (parent && this.__current_parent.cid === parent.cid) {
				return;
			}
			this.stopListening(this.__current_parent, "destroyed", this.remove);
			this.stopListening(this.__current_parent, "rendered");
		}

		this.__current_parent = parent;
		if (parent) {
			this.listenTo(this.__current_parent, "destroyed", this.remove);

			parent.addChild(this);

			if (this.options.renderTo) {
				this.listenTo(this.__current_parent, "rendered", function() {
					this.renderTo(this.__current_parent.$(this.options.renderTo));
				});
			}
		}
	},

	checkRenderComplete: function() {
		if (this.isRemoved) {
			return false;
		}
		//if all data promises are done
		//  && all children have been rendered
		if (this.isRenderComplete) {
			return true;
		}
		if ((!this.__readyPromise || this.__readyPromise.isResolved())
			&& _.all(this.__children, function(child) { return child._checkRenderComplete(); }))
		{
			this.isRenderComplete = true;
			this.trigger('renderComplete');
			console.log('--- renderComplete: ', this);
			return true;
		}
		return false;
	},

	readyAfter: function(promise) {
		var self = this;
		if (!this.__readyPromise) {
			this.__readyPromise = $.when(this.__readyPromise, promise);
		} else {
			this.__readyPromise = promise;
		}
		promise.done(function() {
			self.checkRenderComplete();
		});
	},

	getTemplateData: function() {
		var data = {},
			state;
		if (this.model) {
			$.extend(data, this.model.toJSON());
		}
		if (this.stateModel) {
			state = this.stateModel.toJSON();
			$.extend(data, {
				stateModel: state
			});

			// if (!data.hasOwnProperty("state")) {
			// 	// only create the blocker if we don't have a state value
			// 	if (Object.defineProperty) {
			// 		Object.defineProperty(data, 'state', {
			// 			get: function () {
			// 				throw new Error("Do not use state in templates. Use stateModel instead!");
			// 			},
			// 			set: function(value) {
			// 				// This is called when a subclass edits the data.state before the template. We remove the error condition and return it to a normal variable
			// 				// we also lock it as a normal variable, there is not really a good reason for this..
			// 				Object.defineProperty(data, 'state', {
			// 					value: value,
			// 					writable: true,
			// 					configurable: false
			// 				});
			// 				return value;
			// 			},
			// 			// we do this so we can redefine it later
			// 			configurable: true
			// 		});
			// 	}
			// }
		}
		
		return data;
	},
	render: function() {
		var data, state;

		data = this.getTemplateData();
		// even if we use custom data getter we still might need state data to decide which template to use
		if (this.stateModel) {
			state = this.stateModel.toJSON();
		}

		if (state && state.state && this[state.state + '_template']) {
			this.$el.html(this[state.state + '_template'](data));

		} else if (this.template) {
			this.$el.html(this.template(data));
		}


		this.redelegateEvents();

		this.trigger('rendered');

		return this;
	},
	renderTo: function(selector) {
		this.$el.appendTo(selector);
		this.render();

		return this;
	},

	redelegateEvents: function() {
		this.undelegateEvents();
		this.delegateEvents();

		return this;
	},

	detach: function() {
		if (this.isRemoved) {
			// you should remove your reference to this view when you remove it
			// detach does nothing on a removed view
			debugger; //jshint ignore:line
			return;
		}
		this.$el.detach();
	},
	remove: function() {
		var self = this,
			stack = new Error().stack,
			cid = self.cid;

		if (this.isRemoved) {
			console.warn("This view was removed twice!", this.render.stack);
			debugger; // jshint ignore:line
			return;
		}

		// first clean everything up
		this._super("remove", arguments);
		this.$el.remove();
		$(document).off('.' + cid);
		$(window).off('.' + cid);
		_(this.__timerIDS).each(clearTimeout);

		this.undelegateEvents();
		this.stopListening();

		this.isRemoved = true;
		this.trigger('destroyed');

		// unparent for GC
		delete this.__current_parent;

		// Garbage collection
		$.each(this, function(name) {
			if (!self.hasOwnProperty(name)) { return; }
			if (name === "_superCallObjects") { return; }
			if (name === "cid") { return; }

			if (App.isDev && self[name] && self[name] instanceof Discus.View && !self[name].isRemoved && typeof self[name].remove === 'function') {
				console.warn("[GC] Should this view", cid, "have removed its sub-view", name, "?");
			}
			self[name] = null;
			delete self[name];
		});
		if (this.model) {
			this.model = null;
		}
		if (this.collection) {
			this.collection = null;
		}

		this.isRemoved = true;

		this.render = function() { 
			// render should never be called after remove
			console.log(stack);
			debugger; //jshint ignore:line
		};
		this.render.stack = stack;
	},

	modalForm: function(e) {
		App.UI.modalForm(this.model);
		return this.preventDefault(e);
	},

	preventDefault: function(e) {
		if (!e) { return false; }
		
		if (typeof e.preventDefault === "function") {
			e.preventDefault();
		}

		if (typeof e.stopPropagation === "function") {
			e.stopPropagation();
		}
		return false;
	}
});

if (needsConfigureShim) {
	Discus.View.prototype._ensureElement = function() {
		this._configure(this.options || {});
		return Backbone.View.prototype._ensureElement.apply(this, arguments);
	}
}

module.exports = Discus.View;