var Discus = require('./discus'),
	async = require('async'),
	_ = require('underscore'),
	$ = require('jquery');

require('./view');
require('./model');

function isScrollable(el) {
	return el.scrollHeight > el.clientHeight;
}
function nearestScrollableParent(el) {
	while (el && !isScrollable(el)) {
		if (el === el.parentNode) {
			return null;
		}
		el = el.parentNode;
	}
	return el;
}
function ASYNC(fn) {
	return function() {
		if (this.isRemoved) {
			console.warn("ran on a removed list view");
			return;
		}
		return (fn.apply(this, arguments));
	};
}

Discus.ListView = Discus.View.extend({
	className: 'listView',
	tagName: 'ul',

	events: {},

	defaults: function() {
		var data = {
			// view class and options
			viewClass: this.viewClass || null,
			viewClassOptions: {},

			// loading options
			showLoadingAnimation: false,
			loadingPromise: (new $.Deferred()).resolve(), // defaults to an already resolved promise

			multiSelect: false,
			emptyImageType: '', // there is a default image used in this case
			renderOffscreen: 3,

			scrollLoad: true,

			searchEnabled: false,
			searchInputSelector: '',

			contextMenu: null,

			showEmptyTableText: false,
			emptyTableText: null,
			delayEmptyTableText: true, // covers the gap between promises resolving and data actually being available (parsing maybe ?)
			hideIfEmpty: false,
			initialSelection: null,

			/*  */
			dragOrderingEnabled: false,
			readOnlyDrag: false,
			dragOrderingSelector: '', /* optional */

			// default is 32 views a second. this is pretty quick, all things considered..
			renderLimit: 8, /* Maximum number of views to be rendered, if data appears to be missing, try upping this */
			renderThrottle: 250,
			renderAttached: false, // if we should render everything on the dom instead of removing ourselves first..

			sparse: false,
			sparseLimit: 20,
			sparseTagName: 'div',
			sharedView: this.options.shareView
		};

		return data;
	},

	initialize: function() {
		var self = this;
		// used by tables, mostly
		this.sparse = {
			offset: 0
		};

		// set up default options before doing anything real
		_.defaults(this.options, this.defaults());

		// state variables that I didn't want to expose to the direct scope
		this._d = {
			resetCollection: false,
			modelChanges: {},
			viewCache: {},
			listCache: [],
			renderedViews: []
		};

		if (!this.options.sync) {
			// set up all our async functions
			// this is mostly to bucket events, we link directly to events like add or remove and update our internal cache
			// then we flush that cache to the DOM whenever we get a chance
			// this is important because rendering has some overhead, so if you spam it performance will take a HUGE hit
			this.updateViews = _.debounce(this.updateViews);
			this.renderModels = _.debounce(this.renderModels);
			this.selectedChanged = _.debounce(this.selectedChanged);
			this.handleScroll = _.debounce(this.handleScroll, 10);
			this.render = _.debounce(this.render);
		}

		_.bindAll(this, 'refilter', 'resort', 'resetCollection', 'renderModels');

		this.stateModel = this.createSharedStateModel('listView');

		if (!this.options.viewClass) {
			throw new Error('Must specify a viewClass name before initialization when using ListView ' + this.options.viewClass);
		}
		if (this.options.shareView) {
			console.error("please use sharedView, shareView was a dumb name.");
			debugger;
		}

		// auto-detect and warn when using depreciated API
		if (this.options.childData) {
			console.warn("Use viewClassOptions instead of childData");
			debugger; // jshint ignore: line
			this.options.viewClassOptions = $.extend({}, this.options.childData, this.options.viewClassOptions);
		}

		// set up the loading promise. Take the one from the options, combine it with ours from the collection
		this.loadingPromise = this.options.loadingPromise;
		if (this.collection.promise) {
			this.loadingPromise = $.when(
				this.collection.promise(),
				this.loadingPromise
			);
		}
		// If we're already resolved, we'll instead rely on the below delay'd resetColleciton, rather than this one..
		if (this.loadingPromise.state() !== "resolved") {
			this.loadingPromise.done(function () {
				self._resetCollection();
			});
		}

		this.listenTo(this.collection, "fetch", function(promise) {
			var self = this;
			// add this to the loading promise...
			self.addLoadingPromise(promise);
			// when a fetch starts, we might currently think we're not loading and have no data. This will cause the isLoading to work again!
			if (this.collection.length === 0) {
				this._resetCollection();
			}
		});

		// basic collection events for maintaining our listCache
		this.listenTo(this.collection, "add", this._addModel);
		this.listenTo(this.collection, "remove", this._removeModel);
		this.listenTo(this.collection, "reset", this._resetCollection);
		// this is so that other classes can alert listening listviews of upcoming loading promises...
		this.listenTo(this.collection, "loading_promise", this.addLoadingPromise);

		if (this.options.onChange) {
			this.listenTo(this.collection, 'change', this.modelChange);
		}

		if (this.options.searchEnabled) {
			$(document).on('finishedtyping.' + this.cid, this.options.searchInputSelector, this.refilter);
		}

		//precalc initial selection id list
		if (this.options.multiSelect !== undefined && this.options.initialSelection) {
			this.initialSelection = this.options.initialSelection;
			if (!_.isArray(this.initialSelection)) {
				this.initialSelection = [this.initialSelection];
			}
			this.initialSelection = _(this.initialSelection).map(function(data){
				if (data.model) {
					return data.model.get('id');
				} else {
					return data.id || data;
				}
			});
		}

		// build initial dom state and all that shit...
		if (this.collection.length) {
			_.delay(this.resetCollection, this);
		}
	},

	// This runs every time we modify the views on the DOM. Subclass and extend if desired..
	onViewsChanged: function() {},

	render: function() {
		this._super("render", arguments);

		// if we're on the dom...
		if (this.$el.parent().length) {
			this.rebuildDOM();
		}
		// if we're not, we just kinda don't worry about it..
		// we'll be rendered again next time we're added to the dom
	},
	// this deconstructs and reconstructs the DOM
	// it can be kind of heavy, but generally is a good operation
	// it's somewhat important to run this at least the first time we're actually attached to the dom
	// (and all subsequent renders where we're attached to a fresh unmodified dom)
	rebuildDOM: function() {
		if (this.options.sparse) {
			if (!this.sparse.scrollParent || !this.sparse.scrollParent.length) {
				this.generateSparseRenderTarget();
			}
		}
		var target = this.getRenderTarget();

		// Start!
		// renderAttached is handled within detach/attach dom...
		this.detachDOM();

		// tear everything down first..
		target.empty();
		this.$el.empty();

		if (this.options.hideIfEmpty && !this._d.renderedViews.length) {
			this.attachDOM();
			return;
		}
		// rebuild the layers

		// start with the render header
		this.renderHeader();

		// if we're using a sparse holder, put that in the right spot now
		if (this.sparse.holder) {
			this.sparse.holder.appendTo(this.$el);
			this.sparse.holder.attr('class', 'list_view_slider ' + this.options.sparseClassName);
		}

		if (this.isLoading()) {
			this._d.loadingSpinnerShown = true;
			this.renderLoading();

		} else if (this._d.listCache.length === 0) {
			this.showNoData();
		} else {

			// render in all of the views that should be rendered. This is the heavy-ish task..
			_(this._d.renderedViews).each(function(view) {
				view.renderTo(target);
			});

			// render footer. Ordering matters, footers DO NOT clean themselves up or maintain themselves..
			this.renderFooter();
		}

		this.attachDOM();

		// Done!
	},

	// basically the new "resetViews". It trashes all of it's internal state and rebuilds the whole list. This should be called infrequently
	resetCollection: ASYNC(function() {
		this._d.resetCollection = true;
		this.updateViews();
	}),

	// these next coupl of methods queue up structures to then be flushed using updateViews
	// updateViews should really be updateInternalCache or something...

	addModel: function(model) {
		var _d = this._d; // quicker lookup
		if (!_d.hasData) {
			// if we've never rendered data yet, queue up a reset collection
			// this probably means we just finished our very first fetch
			// reset needed to clear out loading / no data state..
			return this.resetCollection();
		}
		_d.modelChanges[model.cid] = {t: 'add', m: model};
		this.updateViews();
	},
	removeModel: function(model) {
		this._d.modelChanges[model.cid] = {t: 'remove', m: model};
		this.updateViews();
	},
	modelChange: function(model) {
		// just call render on it or something..
		this.getView(model).render();
	},

	// always runs on the event loop. This syncs the queued actions to the cache and then renders them
	updateViews: ASYNC(function() {
		var self = this,
			_d = this._d, // quicker lookup
			count = 0,
			i;

		// check if we need to do a full reset of data -> dom, this is heavier than adding or removing
		if (_d.resetCollection) {
			this._resetCollection();
			return;
		}
		this.detachDOM();

		$.each(_d.modelChanges, function(modelCid, change) {
			delete _d.modelChanges[modelCid];
			self['_'+change.t+'Model'](change.m);
		});

		this.renderModels();

		this.attachDOM();

	}),
	// attachDOM / detachDOM
	_detachCount: 0,
	attachDOM: function() {
		if (this.options.renderAttached) {
			return;
		}
		this._detachCount--;
		if (this._detachCount > 0) {
			return;
		}

		if (this.placeHolder && this.placeHolder.parent().length) {
			this.$el.insertAfter(this.placeHolder);
		} else {
			///TODO This case doesn't render properly!?
			// I'm pretty sure it does... It means we're rendering before being attached to the DOM
			// debugger;
		}
		this.placeHolder.remove();
		this.placeHolder = null;

		this.redelegateEvents();
	},
	detachDOM: function() {
		if (this.options.renderAttached) {
			return;
		}
		if (this._detachCount > 0) {
			this._detachCount++;
			return;
		}
		this.placeHolder = $("<div />", {
			css: {
				height: this.$el.height(),
				width: this.$el.width(),
				position: this.$el.css('position'),
				top: this.$el.css('top'),
				left: this.$el.css('left')
			}
		}).insertAfter(this.$el);
		this.$el.detach();
		this._detachCount++;
	},
	_resetCollection: ASYNC(function() {
		var self = this,
			_d = this._d, // quicker lookup
			models, chain;
		// assume large changes like new data set or order/filtering changing

		// clear out state data..
		_d.hasData = false;
		_d.modelChanges = {};
		_d.resetCollection = false;

		console.log("Resetting the entire list view state!!!");

		this.getRenderTarget().empty();
		_d.renderedViews = [];
		this.changed();

		// Start out with a copy of the models
		models = this.collection.models.concat();

		// filter the models first to reduce the working set
		models = _(models).filter(function(model) {
			return self.filterModel(model);
		});

		// if we have sorting, go ahead and do that next
		if (self.sortBy) {
			models = _(models).sortBy(self.sortBy, self);

			// if the reverse flag is passed in, flip the order of the array before continuing
			if (self.sortBy.reverse) {
				models.reverse();
			}
		}

		_d.listCache = _(models).map(function(model) {
			return {
				s: self.sortBy ? self.sortBy(model) : null,
				m: model
			};
		});

		this.renderModels();
	}),
	_addModel: function(model) {
		if (!this.filterModel(model)) {
			return;
		}
		if (!this._d.listCache.length) {
			return this.resetCollection();
		}
		var _d = this._d,
			sortingValue = this.sortBy(model),
			cacheValue = { s: sortingValue, m: model },
			index = _.sortedIndex(_d.listCache, cacheValue, 's');

		if (this.sortBy.reverse) {
			index = _d.listCache.length - index;
		}
		if (_d.listCache[index] && _d.listCache[index].m.cid === model.cid) {
			//already inserted
			return;
		}

		if (this.options.sparse && index < this.getRenderOffset()) {
			this.sparse.offset++;
			console.log("Adjusting offset to", this.sparse.offset);
		}
		_d.listCache.splice(index, 0, cacheValue);
		this.renderModels();
	},
	_removeModel: function(model, collection, options) {
		var view = this.getView(model),
			_d = this._d;

		if (this.options.sparse && options.index < this.getRenderOffset()) {
			this.sparse.offset--;
		}

		_d.listCache = _(_d.listCache).reject(function(entry) {
			return entry.m.cid === model.cid;
		});
		if (view) {
			view.detach();
			_d.renderedViews = _(_d.renderedViews).without(view);
		}
		if (_d.listCache.length === 0) {
			this.resetCollection();
		}

		this.changed();
	},
	renderModels: ASYNC(function() {
		var self = this,
			_d = this._d,
			offset = this.getRenderOffset(),
			renderList = _d.listCache;

		if (this.renderTimerID) {
			clearTimeout(this.renderTimerID);
			this.renderTimerID = null;
		}

		if (this.isLoading()) {
			_d.loadingSpinnerShown = true;
			this.renderLoading();
			return;
		} else if (_d.loadingSpinnerShown) {
			_d.loadingSpinnerShown = false;
			if (this.tableLoadingSpinner) {
				this.tableLoadingSpinner.remove();
				this.tableLoadingSpinner = null;
			}
			this.renderTimerID = this.setTimeout(this.renderModels, this.options.renderThrottle);
			return;
		}
		if (_d.listCache.length === 0) {
			// debugger;
			this.showNoData();
			return;
		} else {
			this.getRenderTarget().find(".empty_data_row").remove();
			this.$el.removeClass('noData');
		}

		if (this.options.selectFirst) {
			this.selectFirst();
		}

		if (this.options.multiSelect !== undefined) {
			if (this.initialSelection) {
				if (this._d.listCache.length > 0) {
					_(this._d.listCache).chain().filter(function(cache) {
						return self.initialSelection.indexOf(cache.m.get('id') + '') > -1;
					}).each(function(cache) {
						self.initialSelection = _.without(self.initialSelection, cache.m.id);
						self.getStateModel(cache.m).set('selected', true);
					});
				}
			}
		}

		_d.hasData = true;

		if (this.options.sparse) {
			// adjust list for offset!
			console.log("Rendering views based on offset,", offset);
			renderList = _d.listCache.slice(offset, offset + this.options.sparseLimit);

			if (_d.renderedViews.length === 0 && self.options.sparse && !self.sparse.rowHeight && renderList.length > 0) {
				self.getView(renderList[0].m).renderTo(this.$el);
				_d.renderedViews.push(self.getView(renderList[0].m));

				this.updateSparseSizing();

				_d.renderedViews = [];
				self.getView(renderList[0].m)
			}

			this.resetSparsePosition();
			// setup the height so that we fill up enough space..
			this.$el.css({
				height: this.sparse.rowHeight * this._d.listCache.length
			});
		}

		if (renderList.length === _d.renderedViews.length) {
			if (_.isEqual(
				_d.renderedViews,
				_(renderList).map(function(cache) {
					return self.getView(cache.m);
				})
				)) {
				return;
			}
		}

		this.renderHeader();

		// if (this.options.sparse) {
		// 	this.chunkRender(renderList, false);
		// } else 
		if (_d.renderedViews.length === 0) {
			this.chunkRender(renderList, true);
		} else {
			this.chunkRender(renderList, false);
		}
	}),
	chunkRenderID: 0,
	chunkRender: function(models, ordered) {
		var self = this,
			_d = this._d, // quicker lookup
			renderID = this.chunkRenderID,
			renderQueue = [],
			target = this.getRenderTarget(),
			viewOffset = 0,
			// limit = this.options.sparse ? this.options.sparseLimit : this.options.renderLimit,
			limit = this.options.renderLimit,
			i, max;

		this.chunkRenderID = this.chunkRenderID + 1;
		_d.renderID = renderID;
		_d.isRendering = true;

		// cancel previous render!
		this.clearTimeout(_d.chunkRenderTimerID);

		if (self.options.sparse) {
			console.log("Rendering", models.length);
		}
		for (i = 0, max = Math.ceil(models.length/limit); i < max; ++i) {
			renderQueue.push( models.slice(i * limit, (i + 1) * limit) );
		}
		if (self.options.sparse) {
			console.log("and doing it in", renderQueue.length, 'chunks');
		}
		
		i = 0;
		// renderQueue
		async.eachSeries(renderQueue, function(section, callback) {
			if (self.isRemoved || _d.renderID !== renderID) {
				// canceled or dead
				console.log("Canceling stale render", renderID);
				self.clearTimeout(_d.chunkRenderTimerID);
				return callback("Render canceled");
			}
			if (!_(section).all(function(cache) {
				return self.collection.contains(cache.m);
			})) {
				// our queue contains stuff that was removed.
				// this probably means that another render is currently debouncing on the queue
				// lets kill this render and allow the other to eventually catch up..
				console.log("Canceling bad render data", renderID);
				self.clearTimeout(_d.chunkRenderTimerID);
				return callback("Render canceled");
			}

			self.detachDOM();
			self.removeFooter();


			_(section).chain()
				// model -> view
				.filter(function(cache) {
					cache.v = self.getView(cache.m);
					if (!cache.v || cache.v.isRemoved) {
						debugger;
						self.resetCollection();
					} // why?
					return cache.v;
				})
				.each(function(cache) {
					var view = cache.v,
						sort = cache.s,
						model = cache.m;

					if (ordered) {
						_d.renderedViews.push(view);
						view.detach();
						view.$el.appendTo(target);
					} else { (function() { // just so we can return; easily...
						if (_d.renderedViews.length <= viewOffset) {
							ordered = true;
							view.$el.appendTo(target);
							_d.renderedViews.push(view);
							return;
						}

						while (_d.renderedViews.length > viewOffset && !_(models).any(function(cache) {
							return cache.m.cid === _d.renderedViews[viewOffset].model.cid;
						})) {
							// the next rendered view isn't actually part of the collection anymore...
							// or at least is filtered out
							// debugger;
							if (self.options.sharedView) {
								_d.renderedViews.splice(viewOffset, 1)[0].detach();
							} else {
								_d.renderedViews.splice(viewOffset, 1)[0].remove();
							}
						}

						if (_d.renderedViews.length <= viewOffset) {
							ordered = true;
							view.$el.appendTo(target);
							_d.renderedViews.push(view);
							return;
						}
						if (_d.renderedViews[viewOffset].cid === view.cid) {
							// we need to make sure that the view's el is in the right spot...
							if (viewOffset === 0) {
								_d.renderedViews[viewOffset].$el.prependTo(target);
							} else {
								_d.renderedViews[viewOffset].$el.insertAfter(_d.renderedViews[viewOffset-1].lastElement());
							}
							// render is done below, so you don't need to here
							return;
						}

						// attach view to the dom at the correct offset...
						// if the next view in the cache is before this one, then the cache is probably ruined.
						if (self.sortBy.reverse) {
							if (self.sortBy(_d.renderedViews[viewOffset].model) > sort) {
								// the views on the DOM are in the wrong order!!!!!
								//  This almost always happens when there is a view on the DOM that should have been removed!
								debugger;
							}
						} else {
							if (self.sortBy(_d.renderedViews[viewOffset].model) < sort) {
								// the views on the DOM are in the wrong order!!!!!
								//  This almost always happens when there is a view on the DOM that should have been removed!
								debugger;
							}
						}
						if (!_d.renderedViews[viewOffset].$el.closest(self.$el).length) {
							// The next view we're comparing isn't part of this listview?!
							// It was probably stolen by a sharedView listview somewhere else..
							debugger;
						}
						// so we SHOULD be the value at offset, but another view is, so instead we insert before it
						view.detach();
						view.$el.insertBefore(_d.renderedViews[viewOffset].$el);
						// and we insert ourselves into the renderedViews list at the same sport
						_d.renderedViews.splice(viewOffset, 0, view);
						// next iteration, viewOffset will inc by 1 and be equal to the view we were looking at before splicing
						// eventually, that view will be the same 
					}()); }// end function and else {} block.

					view.render();
					viewOffset++;
				});

			self.onViewsChanged();
			self.attachDOM();
			self.renderFooter();

			if (self.options.sync) {
				callback();
			} else {
				_d.chunkRenderTimerID = self.setTimeout(callback, self.options.renderThrottle);
			}
		}, function(err) {
			if (err) { debugger; }
			if (self.isRemoved) {
				return;
			}
			if (_d.renderID !== renderID) {
				if (self.options.sparse) {
					console.log("Completing canceled render...", viewOffset);
				}
				return;
			}	
			_d.isRendering = false;
			self.removeFooter();
			self.renderFooter();
			console.log("Finished chunk rendering", viewOffset, i);
			self.changed();
		});
	},
	removeFooter: function() {
		var renderedViews = this._d.renderedViews,
			lastView = renderedViews.length ? renderedViews[renderedViews.length-1] : null;

		if (this.tableLoadingSpinner && !this._d.loadingSpinnerShown) {
			// probably the footer loading spinner.. get it out of here!
			this.tableLoadingSpinner.remove();
			this.tableLoadingSpinner = null;
		}
		if (!lastView) {
			this.getRenderTarget().empty();
			this.renderHeader();
			return;
		}

		lastView.$el.next().remove();
		// just in case that actually belongs to him...
		lastView.render();
	},
	resetViews: function() {
		// this.resetCollection();
		debugger;
		console.error("resetViews is depreciated, consider using a more intelligent method");
	},
	resort: function() {
		var self = this,
			_d = this._d;

		_d.listCache = _(_d.listCache).sortBy(function(cache) {
			cache.s = self.sortBy(cache.m);
			return cache.s;
		});
		if (self.sortBy.reverse) {
			_d.listCache.reverse();
		}
		_d.renderedViews = [];
		this.getRenderTarget().empty();
		this.renderModels();
	},
	refilter: function() {
		this.resetCollection();
	},
	// this should always be called instead of filterBy directly
	// this is so that we can eventually normalize all the sort/filter/data methods to use the same parameters
	filterModel: function(model) {
		return this.filterBy(model.toJSON(), model);
	},
	changed: function() {
		var self = this;
		if (this.changedQueued) {
			// already queued
			return;
		}
		this.changedQueued = true;
		this.setTimeout(function() {
			if (self.isRemoved) {
				return;
			}
			self.changedQueued = false;
			self.trigger("changed");
			self.onChange();
			self.checkRenderComplete();
		});
	},
	onChange: function() {
	},

	sortBy: function(model) {
		return this.collection.indexOf(model);
	},
	filterBy: function(model) {
		// not used when in conjunction with the generic filter view
		var _this = this,
			searchFilter = true;

		if (this.options.searchEnabled) {
			var value = $(this.options.searchInputSelector).val(),
				searchTerms = value ? value.toLowerCase().split(' ') : null,
				textSearchSuccessful = false;

			// empty search should return true
			if (searchTerms === null) {
				textSearchSuccessful = true;
			} else {
				textSearchSuccessful = _.all(searchTerms, function (term) {
					/**
					 *	This can be extended to check against the defined columns for this view
					 *	that is assuming its a table i suppose. Columns are accessable at
					 *				_this.options.metadata.get('columns') 
					 *	just check the _.intersection() between the filtered fieldMetadata and the columns
					 */
					return _.any( _.filter(_this.collection.fieldMetadata, function (meta) { return typeof meta.getFilterData === 'function'; }), function (field, fieldKey) {
						var value = typeof field.getFilterData === 'function' ? field.getFilterData(model) : model[fieldKey];
						if (value && value.value) {
							value = value.value;
						}
						var retVal = value && value.toString().toLowerCase().indexOf(term) !== -1;
						// if (retVal) { console.log('match!', term, value); }
						return retVal;
					});
				});
			}

			searchFilter = textSearchSuccessful;
		}

		return model.deleted !== "1" && searchFilter;
	},
	renderHeader: function(){},
	renderFooter: function(){
		if (this._d.isRendering || this.isLoading()) {
			this.renderLoading();
		}
	},

	getOrder: function () {
		var orderArr = [];

		_.each( this.$( this.options.dragOrderingSelector ), function ( element ) {
			orderArr.push( $( element ).data('modelId') );
		});

		return orderArr.join(',');
	},

	orderChanged: function () {
		this.trigger('order_changed', this.getOrder());
	},

	/********************************************
	*											*
	*				SPARSE SYSTEM				*
	*											*
	********************************************/

	generateSparseRenderTarget: function() {
		var self = this,
			sparse = this.sparse,
			scrollParent;

		if (!sparse.holder) {
			sparse.holder = $('<' + this.options.sparseTagName + ' />', {
				'class': 'list_view_slider ' + this.options.sparseClassName,
				css: {
					width: '100%',
					height: '10000px',
					position: 'relative',
					display: 'block'
				}
			}).appendTo(this.$el);
		} else {
			sparse.holder.appendTo(this.$el);
		}

		scrollParent = nearestScrollableParent(sparse.holder.get(0));

		sparse.holder.css({
			height: '',
			display: ''
		});

		if (!scrollParent) {
			return sparse.holder;
		}
		scrollParent = $(scrollParent);

		this.setupScrollParent(scrollParent);
		this.updateSparseSizing();

		return sparse.holder;
	},
	handleScroll: function() {
		if (!this.sparse.rowHeight) {
			this.updateSparseSizing();
		}
		if (!this.sparse.rowHeight) {
			// can't do shit yet..
			return;
		}

		var _d = this._d,
			sparse = this.sparse,
			currentOffset = this.getRenderOffset(),
			scrollParent = sparse.scrollParent.get(0),
			scroll = scrollParent.scrollTop - sparse.scrollHeightOffset,
			// the current fold
			offsetLine = sparse.rowHeight * currentOffset,
			// this means we need to scroll up off the top
			moveUpScroll = 0,
			foldPoint = this.options.sparseLimit - ~~(scrollParent.offsetHeight/ sparse.rowHeight),
			offsetDifference, rejects;

		scroll = scroll - offsetLine;

		// scroll relative from top

		if (!scroll) {
			return;
		}
		if (currentOffset > 0 && scroll < (
				// amount off the top it needs to be before we move up
				0
			)) {
			// we need to move up!!
			sparse.offset = currentOffset + (scroll/sparse.rowHeight) - foldPoint;
			// sparse.offset = Math.max(0, currentOffset - ~~(scroll / sparse.rowHeight));

		} else if (scroll > (sparse.rowHeight * foldPoint)) {
			// we're moving down!
			sparse.offset = currentOffset + (scroll/sparse.rowHeight);
		}

		if (sparse.offset !== currentOffset) {
			// round, floor
			sparse.offset = ~~Math.max(0, sparse.offset);
			// ceil
			if (this.collection.metadata) {
				sparse.offset = Math.min(parseInt(this.collection.metadata.total) - this.options.sparseLimit, sparse.offset);
			} else {
				sparse.offset = Math.min(parseInt(this.collection.length) - this.options.sparseLimit, sparse.offset);
			}
		}
		if (sparse.offset !== currentOffset) {
			// when scrolling down it's positive, up it's negative
			offsetDifference = sparse.offset - currentOffset;

			if (offsetDifference > this.options.sparseLimit || (0 - offsetDifference) > this.options.sparseLimit) {
				// abandon all hope
				_d.renderedViews = [];
				this.getRenderTarget().empty();
			} else {
				// splice returns deleted objects
				rejects = _d.renderedViews.splice(offsetDifference, this.options.sparseLimit - offsetDifference);
				/*

				i just need space..


				so rejects are from the difference (increases as well want fewer view) until the end.
				when we're moving up, the number is negative, so it is the distance from the base until like infinity or broken or bromething (it's like something)
				so with those removed, the list is perfect... so long as we're moving up

				if we're moving down, 

				we want to keep the difference from the top down, so that rejects array should contain the views we want

				*/
				if (offsetDifference > 0) { 
					// this doesn't work...
					(function(t) {
						rejects = _d.renderedViews;
						_d.renderedViews = t;
					}(rejects));
				}

				this.resetSparsePosition();
				_(rejects).each(function(view) {
					view.detach();
				});
			}
			
			console.log("Changing the offset to", sparse.offset);
			console.log(scroll, sparse.rowHeight);

			this.renderModels();
		}
	},

	resetSparsePosition: function() {
		this.getRenderTarget().css({
			top: this.sparse.offset * this.sparse.rowHeight
		});
	},

	setupScrollParent: function(newParent) {
		var self = this,
			sparse = this.sparse;

		if (sparse.scrollParent) {
			sparse.scrollParent.off("scroll.sparse" + self.cid);
		}

		sparse.scrollParent = newParent;
		sparse.scrollParentListener = sparse.scrollParent;

		if (!newParent || !newParent.length) {
			return;
		}

		if (sparse.scrollParent.get(0).tagName === 'BODY') {
			sparse.scrollParentListener = $(window);
		}
		sparse.scrollParentListener.on("scroll.sparse" + this.cid, function() {
			if (self.isRemoved) {
				sparse.scrollParentListener.off("scroll.sparse" + self.cid);
				return;
			}
			self.handleScroll();
		});
	},

	updateSparseSizing: function() {
		if (!this.options.sparse) {
			return;
		}
		if (!this.sparse.scrollParent || !this.sparse.scrollParent.length) {
			this.generateSparseRenderTarget();
			if (!this.sparse.scrollParent) {
				return;
			}
		}
		if (this._d.renderedViews.length === 0) {
			return;
		}
		// this.sparse.holder.css({
		// 	height: 'auto'
		// });
		// var oldRowHeight = this.sparse.rowHeight;

		if (!this.sparse.rowHeight) {
			this.sparse.rowHeight = this._d.renderedViews[0].$el.height();
		}

		this.$el.css({
			height: this.sparse.rowHeight * this._d.listCache.length
		});

		if (this.sparse.scrollParent && !this.sparse.scrollHeightOffset) {
			this.sparse.holder.css({
				top: 'auto'
			});

			this.sparse.scrollHeightOffset = this.sparse.holder.offset().top - (this.sparse.scrollParent.offset() ? this.sparse.scrollParent.offset().top : 0);
		}
		// debugger;
		// this.resetCollection();
	},

	addLoadingPromise: function(promise) {
		var self = this,
			needsReset = !this.isLoading();

		if (!promise || !promise.done) {
			debugger;
		}

		this.loadingPromise = $.when(
			promise,
			this.loadingPromise
		);
		this.loadingPromise.done(function () {
			self._resetCollection();
		});
		this.readyAfter(this.loadingPromise);
		if (needsReset) {
			this.renderModels();
		}
		return this.loadingPromise;
	},
	checkRenderComplete: function() {
		if (this.isRemoved || this._d.isRendering || !this._d.hasData) {
			return false;
		}

		if (this._super("checkRenderComplete", arguments)) {
			this.stopListening(this, "change", this.checkRenderComplete);
			return true;
		}
		return false;
	},
	setLoadingPromise: function(promise) {
		debugger;
	},

	isLoading: function() {
		return (this.collection.length === 0) && (this.loadingPromise.state() !== "resolved");
	},
	renderLoading: function() {
		if (this.options.showLoadingAnimation) {
			// this.tableLoadingSpinner = new MyLoadingSpinner({
			// 	parent: this
			// });

			if (this.tableLoadingSpinner) {
				this.tableLoadingSpinner.renderTo(this.$el);
			}
		}
	},

	showNoData: function ( text ) {
		this.getRenderTarget().empty();
		if (this.options.hideIfEmpty) {
			return;
		}
		this.$el.addClass('noData');
		this.renderHeader();
		this.renderEmpty(text);
		this.renderFooter();
	},
	renderEmpty: function(text){
		// basically none of this function makes sense. Look at how noun is used...
		if (this.tagName === 'tbody' || this.tagName === 'table') {
			var model = this.collection.model,
				noun;

			if (model.hasOwnProperty('noun')) {
				noun = model.noun;
			} else if (this.options.emptyImageType) {
				// nothing
			} else {
				/* This is the default */
				text = 'No Data';
			}

			/* If they provided text lets render it anyways */
			if (this.options.emptyTableText) {
				text = this.options.emptyTableText;
			}

			this.getRenderTarget().append([
				// '<tr class="no-click "><td colspan="9999">&nbsp;</td></tr>',
				// '<tr class="no-click "><td colspan="9999">&nbsp;</td></tr>',
				// '<tr class="no-click "><td colspan="9999">&nbsp;</td></tr>',
				'<tr class="no-click no-bg no-border empty_data_row">',
					'<td class="empty_data_cell" colspan="99999">',
						'<div class="empty_table_holder">',
							'<div class="empty_table_image ' + (this.options.emptyImageType || noun) + '"></div>',
							// '<div class="empty_table_text">' + (text ? text : '') + '</div>',
						'</div>',
					'</td>',
				'</tr>'
			].join(''));
		} else if (this.tagName === 'div') {
			if (this.className.indexOf('isotope_list_view') !== -1) {
				this.getRenderTarget().append([
					'<div class="empty_isotope_image ' + (this.options.emptyImageType || noun) + '"></div>'
				].join(''));
				this.getRenderTarget().height('340px');
			}
		} else if (this.tagName === 'ul') {
			if (this.options.emptyImageType) {
				this.getRenderTarget().append([
					'<div class="empty_list_image ' + (this.options.emptyImageType || noun) + '"></div>'
				].join(''));
			} else {
				this.getRenderTarget().append([
					// '<div class="empty_list_text">' + text + '</div>'
				].join(''));
			}
		}
	},

	/********************************************
	*											*
	*			UTILITY FUNCTIONS				*
	*											*
	********************************************/
	// indexOf
	// getRenderOffset
	// getRenderTarget
	// getStateModel
	// getView
	// isLoading

	indexOf: function(model) {
		var _d = this._d,
			model = this.collection.get(model.id ? model.id : model),
			sortingValue = this.sortBy(model),
			cacheValue = { s: sortingValue, m: model };

		return _.sortedIndex(_d.listCache, cacheValue, 's');
	},
	getRenderOffset: function() {
		return this.sparse.offset;
	},
	getRenderTarget: function() {
		if (this.options.sparse) {
			if (this.sparse.holder) {
				if (this.sparse.holder.parent().get(0) !== this.el) {
					this.sparse.holder.appendTo(this.$el);
				}
				return this.sparse.holder;
			}
			if (this.$el.parent().length || (this.placeHolder && this.placeHolder.parent().length)) {
				return this.generateSparseRenderTarget();
			}
		}
		return this.$el;
	},

	getView: function(model) {
		var view = this._d.viewCache[model.cid];

		if (view && !view.isRemoved) {
			return view;
		}
		if (!this.collection.contains(model)) {
			return null;
		}
		if (this.options.sharedView) {
			if (model.___list_view_shared_views[this.options.sharedView]) {
				return model.___list_view_shared_views[this.options.sharedView];
			}
		}

		// create view!
		view = new this.options.viewClass($.extend(true, {}, this.options.viewClassOptions, {
			parent: this.options.sharedView ? this.options.parent || this : this,
			model: model,
			collection: this.collection
		}));
		view.collection = this.collection;

		this._d.viewCache[model.cid] = view;
		if (this.options.sharedView) {
			model.___list_view_shared_views[this.options.sharedView] = view;
			this.listenToOnce(view, "destroyed", function() {
				debugger;
			});
		}

		this.stopListening(this.getStateModel(model));
		this.listenTo(this.getStateModel(model), "change:selected", this.selectedChanged);

		return view;
	},

	getStateModel: function(model) {
		var key = this.options.sharedView ? this.options.sharedView : this.cid;
		if (typeof model === 'string' || typeof model === 'number') {
			model = this.collection.get(model);
		} else if (!model.toJSON && model.id) {
			model = this.collection.get(model.id);
		}

		if (model) {
			if (!model.__list_view_state_models) {
				model.__list_view_state_models = {};
			}
			if (!model.__list_view_state_models[key]) {
				model.__list_view_state_models[key] = new Discus.Model({
					selected: false
				});
			}
			return model.__list_view_state_models[key];
		} else {
			//requested model doesn't exist in collection, this shouldn't happen
			debugger; // jshint ignore: line
			return null;
		}
	},



	/********************************************
	*											*
	*			SELECTION FUNCTIONS				*
	*											*
	********************************************/
	// selectedChanged
	// selectFirst
	// selectAll
	// unselectAll
	// selectByID
	// isSelected
	// getSelected
	// getSelectedModels

	selectedChanged: ASYNC(function(model) {
		if (model instanceof Discus.Model && this.options.multiSelect === false) {
			if (this.getStateModel(model).get('selected')) {
				this.unselectAll(model.id);
			}
		}
		this.trigger('selected_changed', model);
		this.$el.trigger('selected_changed', model);
	}),

	selectFirst: function() {
		var currentRow = this.getSelected(),
			listCache = this._d.listCache;

		if (!listCache.length) {
			// there's nothing rendered!
			return;
		}

		if (currentRow.length === 0) {
			currentRow = null;
		} else if (currentRow.length) {
			currentRow = currentRow[0];
		}

		if (currentRow && !_.any(listCache, function(cache) { return cache.m.cid === currentRow.cid; })) {
			currentRow = null;
		}

		if (!currentRow) {
			// if nothing is selected, then grab the first entry from the cache
			this.selectByID(listCache[0].m.id);
		}
	},
	selectAll: function(e) {
		var self = this,
			select = false;
		if (e.target) {
			select = $(e.target).is(":checked");
		} else {
			select = !!e;
		}
		_(this._d.listCache).each(function(cache) {
			self.getStateModel(cache.m).set({
				selected: select
			});
		});

		return true;
	},

	getSelected: function() {
		if (this.isRemoved) {
			// You didn't mean to call this.
			debugger;
			return [];
		}
		var self = this;

		return this.collection.chain()
			.filter(function(model) {
				return self.getStateModel(model).attributes.selected;
			})
			.value();
	},

	isSelected: function(model) {
		return this.getStateModel(model).get('selected');
	},

	getSelectedModels: function() {
		return this.collection.filter(this.isSelected, this);
	},

	selectByID: function(id) {
		var model = this.collection.get(id);
 
		if (!model) { return; }

		if (!this.options.multiSelect) {
			// unselect!
			this.unselectAll(id);
		}

		this.getStateModel(model).set({
			selected: true
		});

		if (this.stateModel) {
			this.stateModel.set({
				selectedRow: model
			});
		}

		return true;
	},

	// optional, unselect all but id
	unselectAll: function(id) {
		var self = this;
		this.collection.each(function(model) {
			if (model.id == id || _(id).contains(model.id)) { return; }
//			console.log("Unselecting model", model.id, id);

			self.getStateModel(model).set({
				selected: false
			});
		});
	},
	redelegateEvents: function() {
		this._super("redelegateEvents", arguments);
		_(this._d.renderedViews).each(function(view) {
			// view.render();
			view.redelegateEvents();
		});
	},
	remove: function() {
		if (this.sparse.scrollParent) {
			this.sparse.scrollParent.off("scroll.sparse" + this.cid);
		}
		this._super("remove", arguments);
	}
});

module.exports = Discus.ListView;
