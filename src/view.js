var Discus = require('./discus');
var _super = require('./super');

Discus.View = function() {
	Backbone.View.apply(this, arguments);
	this.discusInitialize();
};
Discus.View.prototype = Backbone.View.prototype;
Discus.View.extend = Backbone.View.extend;

Discus.View = Discus.View.extend({
	_super: _super,
	
	__lsModelCache: {},

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

	hasParent: function() {
		return !!this.__current_parent;
	},
	setParent: function(parent) {
		if (this.__current_parent) {
			if (this.__current_parent.cid === parent.cid) {
				return;
			}
			this.stopListening(this.__current_parent, "destroyed", this.remove);
		}

		this.__current_parent = parent;
		this.listenTo(this.__current_parent, "destroyed", this.remove);

		if (this.options.renderTo) {
			if (this.__current_parent) {
				this.stopListening(this.__current_parent, "rendered");
			}
			this.listenTo(this.__current_parent, "rendered", function() {
				this.renderTo(this.__current_parent.$(this.options.renderTo));
			});
		}
	},
	discusInitialize: function() {
		if (this.options.parent) {
			if (this.options.parent === window) {
				console.error("Passed in parent: this when you meant to do parent: self");
				debugger;
				return;
			}
			this.setParent(this.options.parent);
		} else if (this.options.renderTo) {
			console.error("renderTo does nothing without a parent!");
			debugger;
		}
	},

	/* usePersistent - won't get wiped on partner change */
	localStorage: function ( key, defaults, usePersistent ) {
		if (!Modernizr.localstorage) { console.warn('LocalStorage is missing, expect odd behavior.'); return; }

		/* Anonymous as it should not be exposed to anyone */
		function getModel ( key, usePersistent ) {
			if (!App.user) { return null; }
			return App.user.storage.getItem( key, usePersistent );
		}

		if (this.__lsModelCache[ key ]) {
			var model = this.__lsModelCache[ key ],
				data = model.toJSON();

			data = _.defaults( data , defaults );

			model.set( data );

			return this.__lsModelCache[ key ];
		}

		var model = new LocalStorage({}, {
				lsKey: key,
				usePersistent: usePersistent
			}),
			lsData = getModel( key, usePersistent );

		/* This will add any newly defined defaults to the object, look up underscores defaults() function if confused */
		lsData = _.defaults( lsData || {}, defaults );

		if (lsData) {
			/* This will always cause a Sync with local storage, but thats a cheap operation so we dont care */
			model.set( lsData );
		}
		this.__lsModelCache[ key ] = model;

		return model;
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

	delegateEvents: function() {
		var ret = this._super("delegateEvents", arguments);

		if (this.validationEvents || this.options.validationEvents) {
			var vEvents = _.extend({}, this.validationEvents, this.options.validationEvents);
			Validator.delegateValidationEvents( this.$el, this, vEvents );
		}

		return ret;
	},
	undelegateEvents: function() {
		var ret = this._super("undelegateEvents", arguments);

		if (this.validationEvents || this.options.validationEvents) {
			Validator.undelegateValidationEvents( 'vCache_' + this.cid );
		}

		return ret;
	},

	/* Runs through the validateEvents block and returns true or false */
	validate: function ( options ) {
		var self = this,
			isValidated = true;

		options = options || {};
		_.defaults(options, { silent: false });

		// this.$el.trigger("validationStart"); // we really don't need this at all

		if (this._validators) {
			/* Test each validator, even if an early one fails, this will allow classes to be applied */
			_.each( this._validators, function ( validator ) {
				var elements = self.$( validator.selector );
				if (App.isDev && elements && elements.length === 0) {
					//debugger; /* You tried to validate against an element that doesn't exist, fix it */
					console.warn('The selector', validator.selector, 'returned no elements and a validator tried to run against it.');
				}
				/* The selector can target one or more elements, make sure to check each */
				validator.isValid = true;
				_.each( elements, function ( elem ) {
					/* Determine if this validator has passed */
					var result = Validator.validate( $( elem ), validator.method );

					/* If isValidated isn't already false and this validator fails, set it to false */
					if (result !== true) {
						// debugger;
						isValidated = false;
						validator.isValid = false;
					}
				});
			});
		}

		// emit some signals for parent views to catch in the bubble..
		if (!options.silent) {
			if (isValidated) {
				this.$el.trigger("validationDone");
			} else {
				this.$el.trigger("validationFail");
			}
		}
		
		return isValidated;
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
			debugger;
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
	},
	reloadable: function(data) {
		if (App.router.isReloaded()) {
			if (App.router._reloadData.model) {
				this.model = App.router._reloadData.model;
			}
			if (App.router._reloadData.collection) {
				this.collection = App.router._reloadData.collection;
			}
			if (App.router._reloadData.stateModel) {
				this.stateModel = App.router._reloadData.stateModel;
			}

			delete App.router._reloadData;

		} else {
			this.stateModel = new Discus.Model(data);

		}
	}
});

module.exports = Discus.View;