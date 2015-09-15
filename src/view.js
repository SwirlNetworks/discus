var Discus = require('./discus');
var _super = require('./super');
var _ = require('underscore');
var Backbone = require("backbone");
var $ = require("jquery");

var needsConfigureShim = Discus.VERSION_ARRAY[0] >= 1 && Discus.VERSION_ARRAY[1] >= 1;

var viewByCID = {};

Discus.viewByCID = function(cid) {
	return viewByCID[cid] || null; // no undefined pls
};

Discus.View = function(options) {
	if (needsConfigureShim) {
		this.options = options;
	}
	Backbone.View.apply(this, arguments);
	// setup cid
	this.$el.attr({
		'data-cid': this.cid
	});
	this.discusInitialize();

	viewByCID[this.cid] = this;
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
	defaults: function() {
		return {};
	},
	discusInitialize: function() {
		var self = this;
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

		if (this.model) {
			if (_.isFunction(this.model.promise)) {
				this.readyAfter(this.model.promise());
			}
			this.listenTo(this.model, "fetch", this.readyAfter);
		}
		if (this.collection) {
		 	if (_.isFunction(this.collection.promise)) {
				this.readyAfter(this.collection.promise());
			}
			this.listenTo(this.collection, "fetch fetchAll", this.readyAfter);
		}

		if (this.modelEvents && this.model) {
			this._bindEventsToModel(this.model, this.modelEvents);
		}
		if (this.collectionEvents && this.collection) {
			this._bindEventsToModel(this.collection, this.collectionEvents);
		}
		this._setupStateModels();
	},

	_setupStateModels: function() {
		var self = this,
			rootModel = this.stateModel || this.getSharedStateModel();

		if (this.stateModelEvents) {
			_(this.stateModelEvents).chain()
				.map(function(handler, eventName) {
					if (typeof handler === 'object') {
						return _(handler).map(function(subHandler, subEventName) {
							return {
								model: self.getSharedStateModel(eventName),
								handler: subHandler,
								eventName: subEventName
							};
						});
					}
					return {
						model: rootModel,
						handler: handler,
						eventName: eventName
					};
				})
				.flatten()
				.groupBy(function(entry) {
					return entry.model.cid;
				})
				.each(function(entry) {
					var model = _(entry).first().model,

						eventData = _(entry)
							.chain()
							.map(function(row) {
								return [row.eventName, row.handler];
							})
							.object()
							.value();

					self._bindEventsToModel(model, eventData);
				});
		}
	},

	_bindEventsToModel: function(model, events) {
		var self = this;
		_(events).each(function(handler, eventName) {
			if (typeof handler === 'string') {
				handler = self[handler];
			}
			if (!_.isFunction(handler)) {
				throw new Error("Could not find handler for event, " + eventName);
			}
			self.listenTo(model, eventName, handler);
		});
		return this;
	},

	screenStateModel: function() {
		if (this.hasParent()) {
			return this.getParent().screenStateModel();
		}
		return this.stateModel;
	},

	createSharedStateModel: function(name, model) {
		if (model instanceof Backbone.Model) {
			// already a model
		} else if (typeof model === 'object') {
			model = new Backbone.Model(model);
		} else {
			model = new Backbone.Model();
		}
		// now that we have a proper model, do safety checks and store it
		if (!this.__sharedStateModels) {
			this.__sharedStateModels = {};
		} else if (this.__sharedStateModels[name]) {
			debugger; //jshint ignore:line
			console.warn('Overwriting shared state model %s with another Backbone Model', name);
		}
		this.__sharedStateModels[name] = model;

		return model;
	},

	getSharedStateModel: function(name) {
		if (name === 'SCREEN') {
			return this.screenStateModel();
		}
		if (this.__sharedStateModels && this.__sharedStateModels[name]) {
			return this.__sharedStateModels[name];
		}
		if (this.getParent()) {
			return this.getParent().getSharedStateModel(name);
		} else {
			return this.createSharedStateModel(name);
		}
	},

	// track el as part of this view even though it's not a child..
	addElement: function(el) {
		var self = this,
			$el = $(el);

		if ($el.length > 1) {
			$el.each(function() {
				self.addElement(this);
			});
		} else if ($el.length === 0) {
			throw new Error("Invalid element!");
		}

		if (this.$el.closest($el).length) {
			throw new Error("Element is a child of this view. This is only for unrelated elements");
		}
		if ($el.closest(this.$el).length) {
			throw new Error("Element is an ancestor of this view! Reconsider how you're using this view.");
		}

		// normalize
		el = $el.get(0);

		if (!this._trackedElements) {
			this._trackedElements = [];
		}
		_(this._trackedElements).each(function(otherEl) {
			var $otherEl = $(otherEl);

			if ($otherEl.closest($el).length) {
				throw new Error("Element is a child of another tracked element. This will cause problems.");
			}
			if ($el.closest($otherEl).length) {
				throw new Error("Element is an ancestor of another tracked element. This will cause problems.");
			}
		});
		this._trackedElements.push(el);
	},
	lastElement: function() {
		// get the lastmost element, for appending things after other views
		var curEl = this.$el;

		// should this recurse? I DONT KNOW!?!?!?
		_(this._trackedElements).each(function(el) {
			var $el = $(el);

			if (curEl.nextAll().is($el)) {
				curEl = $el;
			}
		});

		return curEl;
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
	setInterval: function(fn, timeout, args) {
		var self = this,
			timerID;

		timerID = setInterval(function() {
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
		if (!child) {
			console.warn("Tried to add a non-existent child");
			debugger; //jshint ignore:line
			return;
		}
		this.__children[child.cid] = child;

		this.listenTo(child, "destroyed", function() {
			this.removeChild(child);
		});
		this.listenTo(child, "renderComplete", this.checkRenderComplete);
	},
	removeChild: function(child) {
		if (!child) {
			console.warn("Tried to remove non-existent child");
			debugger; //jshint ignore:line
			return;
		}
		delete this.__children[child.cid];
		this.stopListening(child);
		if (child.getParent().cid === this.cid) {
			child.setParent();
		}
	},
	hasParent: function() {
		return !!this.getParent();
	},
	getParent: function() {
		//when accessing parent during initializer, this.__current_parent is not set yet
		// so return this.options.parent if it exists
		return this.__current_parent || this.options.parent;
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
		if ((!this.__readyPromise || 
		// for jquery < 1.8
		(this.__readyPromise.isResolved && this.__readyPromise.isResolved()) ||
		// for jquery >= 1.8
		(this.__readyPromise.state && this.__readyPromise.state() == 'resolved')) &&
			_.all(this.__children, function(child) { return child._checkRenderComplete(); }))
		{
			this.isRenderComplete = true;
			this.trigger('renderComplete');
			this.onRenderComplete();
			return true;
		}
		return false;
	},

	onRenderComplete: function() {
		//Executed once AFTER this view has finished rendering, all its subviews have finished rendering, and all
		// KNOWN promises (this.model, this.collection, this.readyAfter( mySpecialPromise ) ) have resolved
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
		}
		
		return data;
	},
	onBeforeRender: function() {
		//Executed once BEFORE render has begun
		//Override w/ custom handling
	},
	render: function() {
		var data, state;

		// ensure cid!.. prooooobably redundant
		this.$el.attr({
			'data-cid': this.cid
		});

		this.onBeforeRender();

		data = this.getTemplateData();
		this._templateData = data;

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

		this.onRender();

		return this;
	},
	onRender: function() {
		//Executed once AFTER render is finished
		//Override w/ custom handling
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
		_(this._trackedElements).each(function(el) {
			$(el).detach();
		});
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
		delete viewByCID[cid];

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

			if (Discus.isDev && self[name] && self[name] instanceof Discus.View && !self[name].isRemoved && typeof self[name].remove === 'function') {
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
	};
}

module.exports = Discus.View;
