/*!
 * Copyright (c) 2015 Swirl
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
 * DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
 * OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE
 * OR OTHER DEALINGS IN THE SOFTWARE.
 */
!function(e){if("object"==typeof exports)module.exports=e();else if("function"==typeof define&&define.amd)define(e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.Discus=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
(function (process){
/*!
 * async
 * https://github.com/caolan/async
 *
 * Copyright 2010-2014 Caolan McMahon
 * Released under the MIT license
 */
/*jshint onevar: false, indent:4 */
/*global setImmediate: false, setTimeout: false, console: false */
(function () {

    var async = {};

    // global on the server, window in the browser
    var root, previous_async;

    root = this;
    if (root != null) {
      previous_async = root.async;
    }

    async.noConflict = function () {
        root.async = previous_async;
        return async;
    };

    function only_once(fn) {
        var called = false;
        return function() {
            if (called) throw new Error("Callback was already called.");
            called = true;
            fn.apply(root, arguments);
        }
    }

    //// cross-browser compatiblity functions ////

    var _toString = Object.prototype.toString;

    var _isArray = Array.isArray || function (obj) {
        return _toString.call(obj) === '[object Array]';
    };

    var _each = function (arr, iterator) {
        if (arr.forEach) {
            return arr.forEach(iterator);
        }
        for (var i = 0; i < arr.length; i += 1) {
            iterator(arr[i], i, arr);
        }
    };

    var _map = function (arr, iterator) {
        if (arr.map) {
            return arr.map(iterator);
        }
        var results = [];
        _each(arr, function (x, i, a) {
            results.push(iterator(x, i, a));
        });
        return results;
    };

    var _reduce = function (arr, iterator, memo) {
        if (arr.reduce) {
            return arr.reduce(iterator, memo);
        }
        _each(arr, function (x, i, a) {
            memo = iterator(memo, x, i, a);
        });
        return memo;
    };

    var _keys = function (obj) {
        if (Object.keys) {
            return Object.keys(obj);
        }
        var keys = [];
        for (var k in obj) {
            if (obj.hasOwnProperty(k)) {
                keys.push(k);
            }
        }
        return keys;
    };

    //// exported async module functions ////

    //// nextTick implementation with browser-compatible fallback ////
    if (typeof process === 'undefined' || !(process.nextTick)) {
        if (typeof setImmediate === 'function') {
            async.nextTick = function (fn) {
                // not a direct alias for IE10 compatibility
                setImmediate(fn);
            };
            async.setImmediate = async.nextTick;
        }
        else {
            async.nextTick = function (fn) {
                setTimeout(fn, 0);
            };
            async.setImmediate = async.nextTick;
        }
    }
    else {
        async.nextTick = process.nextTick;
        if (typeof setImmediate !== 'undefined') {
            async.setImmediate = function (fn) {
              // not a direct alias for IE10 compatibility
              setImmediate(fn);
            };
        }
        else {
            async.setImmediate = async.nextTick;
        }
    }

    async.each = function (arr, iterator, callback) {
        callback = callback || function () {};
        if (!arr.length) {
            return callback();
        }
        var completed = 0;
        _each(arr, function (x) {
            iterator(x, only_once(done) );
        });
        function done(err) {
          if (err) {
              callback(err);
              callback = function () {};
          }
          else {
              completed += 1;
              if (completed >= arr.length) {
                  callback();
              }
          }
        }
    };
    async.forEach = async.each;

    async.eachSeries = function (arr, iterator, callback) {
        callback = callback || function () {};
        if (!arr.length) {
            return callback();
        }
        var completed = 0;
        var iterate = function () {
            iterator(arr[completed], function (err) {
                if (err) {
                    callback(err);
                    callback = function () {};
                }
                else {
                    completed += 1;
                    if (completed >= arr.length) {
                        callback();
                    }
                    else {
                        iterate();
                    }
                }
            });
        };
        iterate();
    };
    async.forEachSeries = async.eachSeries;

    async.eachLimit = function (arr, limit, iterator, callback) {
        var fn = _eachLimit(limit);
        fn.apply(null, [arr, iterator, callback]);
    };
    async.forEachLimit = async.eachLimit;

    var _eachLimit = function (limit) {

        return function (arr, iterator, callback) {
            callback = callback || function () {};
            if (!arr.length || limit <= 0) {
                return callback();
            }
            var completed = 0;
            var started = 0;
            var running = 0;

            (function replenish () {
                if (completed >= arr.length) {
                    return callback();
                }

                while (running < limit && started < arr.length) {
                    started += 1;
                    running += 1;
                    iterator(arr[started - 1], function (err) {
                        if (err) {
                            callback(err);
                            callback = function () {};
                        }
                        else {
                            completed += 1;
                            running -= 1;
                            if (completed >= arr.length) {
                                callback();
                            }
                            else {
                                replenish();
                            }
                        }
                    });
                }
            })();
        };
    };


    var doParallel = function (fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [async.each].concat(args));
        };
    };
    var doParallelLimit = function(limit, fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [_eachLimit(limit)].concat(args));
        };
    };
    var doSeries = function (fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [async.eachSeries].concat(args));
        };
    };


    var _asyncMap = function (eachfn, arr, iterator, callback) {
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        if (!callback) {
            eachfn(arr, function (x, callback) {
                iterator(x.value, function (err) {
                    callback(err);
                });
            });
        } else {
            var results = [];
            eachfn(arr, function (x, callback) {
                iterator(x.value, function (err, v) {
                    results[x.index] = v;
                    callback(err);
                });
            }, function (err) {
                callback(err, results);
            });
        }
    };
    async.map = doParallel(_asyncMap);
    async.mapSeries = doSeries(_asyncMap);
    async.mapLimit = function (arr, limit, iterator, callback) {
        return _mapLimit(limit)(arr, iterator, callback);
    };

    var _mapLimit = function(limit) {
        return doParallelLimit(limit, _asyncMap);
    };

    // reduce only has a series version, as doing reduce in parallel won't
    // work in many situations.
    async.reduce = function (arr, memo, iterator, callback) {
        async.eachSeries(arr, function (x, callback) {
            iterator(memo, x, function (err, v) {
                memo = v;
                callback(err);
            });
        }, function (err) {
            callback(err, memo);
        });
    };
    // inject alias
    async.inject = async.reduce;
    // foldl alias
    async.foldl = async.reduce;

    async.reduceRight = function (arr, memo, iterator, callback) {
        var reversed = _map(arr, function (x) {
            return x;
        }).reverse();
        async.reduce(reversed, memo, iterator, callback);
    };
    // foldr alias
    async.foldr = async.reduceRight;

    var _filter = function (eachfn, arr, iterator, callback) {
        var results = [];
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        eachfn(arr, function (x, callback) {
            iterator(x.value, function (v) {
                if (v) {
                    results.push(x);
                }
                callback();
            });
        }, function (err) {
            callback(_map(results.sort(function (a, b) {
                return a.index - b.index;
            }), function (x) {
                return x.value;
            }));
        });
    };
    async.filter = doParallel(_filter);
    async.filterSeries = doSeries(_filter);
    // select alias
    async.select = async.filter;
    async.selectSeries = async.filterSeries;

    var _reject = function (eachfn, arr, iterator, callback) {
        var results = [];
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        eachfn(arr, function (x, callback) {
            iterator(x.value, function (v) {
                if (!v) {
                    results.push(x);
                }
                callback();
            });
        }, function (err) {
            callback(_map(results.sort(function (a, b) {
                return a.index - b.index;
            }), function (x) {
                return x.value;
            }));
        });
    };
    async.reject = doParallel(_reject);
    async.rejectSeries = doSeries(_reject);

    var _detect = function (eachfn, arr, iterator, main_callback) {
        eachfn(arr, function (x, callback) {
            iterator(x, function (result) {
                if (result) {
                    main_callback(x);
                    main_callback = function () {};
                }
                else {
                    callback();
                }
            });
        }, function (err) {
            main_callback();
        });
    };
    async.detect = doParallel(_detect);
    async.detectSeries = doSeries(_detect);

    async.some = function (arr, iterator, main_callback) {
        async.each(arr, function (x, callback) {
            iterator(x, function (v) {
                if (v) {
                    main_callback(true);
                    main_callback = function () {};
                }
                callback();
            });
        }, function (err) {
            main_callback(false);
        });
    };
    // any alias
    async.any = async.some;

    async.every = function (arr, iterator, main_callback) {
        async.each(arr, function (x, callback) {
            iterator(x, function (v) {
                if (!v) {
                    main_callback(false);
                    main_callback = function () {};
                }
                callback();
            });
        }, function (err) {
            main_callback(true);
        });
    };
    // all alias
    async.all = async.every;

    async.sortBy = function (arr, iterator, callback) {
        async.map(arr, function (x, callback) {
            iterator(x, function (err, criteria) {
                if (err) {
                    callback(err);
                }
                else {
                    callback(null, {value: x, criteria: criteria});
                }
            });
        }, function (err, results) {
            if (err) {
                return callback(err);
            }
            else {
                var fn = function (left, right) {
                    var a = left.criteria, b = right.criteria;
                    return a < b ? -1 : a > b ? 1 : 0;
                };
                callback(null, _map(results.sort(fn), function (x) {
                    return x.value;
                }));
            }
        });
    };

    async.auto = function (tasks, callback) {
        callback = callback || function () {};
        var keys = _keys(tasks);
        var remainingTasks = keys.length
        if (!remainingTasks) {
            return callback();
        }

        var results = {};

        var listeners = [];
        var addListener = function (fn) {
            listeners.unshift(fn);
        };
        var removeListener = function (fn) {
            for (var i = 0; i < listeners.length; i += 1) {
                if (listeners[i] === fn) {
                    listeners.splice(i, 1);
                    return;
                }
            }
        };
        var taskComplete = function () {
            remainingTasks--
            _each(listeners.slice(0), function (fn) {
                fn();
            });
        };

        addListener(function () {
            if (!remainingTasks) {
                var theCallback = callback;
                // prevent final callback from calling itself if it errors
                callback = function () {};

                theCallback(null, results);
            }
        });

        _each(keys, function (k) {
            var task = _isArray(tasks[k]) ? tasks[k]: [tasks[k]];
            var taskCallback = function (err) {
                var args = Array.prototype.slice.call(arguments, 1);
                if (args.length <= 1) {
                    args = args[0];
                }
                if (err) {
                    var safeResults = {};
                    _each(_keys(results), function(rkey) {
                        safeResults[rkey] = results[rkey];
                    });
                    safeResults[k] = args;
                    callback(err, safeResults);
                    // stop subsequent errors hitting callback multiple times
                    callback = function () {};
                }
                else {
                    results[k] = args;
                    async.setImmediate(taskComplete);
                }
            };
            var requires = task.slice(0, Math.abs(task.length - 1)) || [];
            var ready = function () {
                return _reduce(requires, function (a, x) {
                    return (a && results.hasOwnProperty(x));
                }, true) && !results.hasOwnProperty(k);
            };
            if (ready()) {
                task[task.length - 1](taskCallback, results);
            }
            else {
                var listener = function () {
                    if (ready()) {
                        removeListener(listener);
                        task[task.length - 1](taskCallback, results);
                    }
                };
                addListener(listener);
            }
        });
    };

    async.retry = function(times, task, callback) {
        var DEFAULT_TIMES = 5;
        var attempts = [];
        // Use defaults if times not passed
        if (typeof times === 'function') {
            callback = task;
            task = times;
            times = DEFAULT_TIMES;
        }
        // Make sure times is a number
        times = parseInt(times, 10) || DEFAULT_TIMES;
        var wrappedTask = function(wrappedCallback, wrappedResults) {
            var retryAttempt = function(task, finalAttempt) {
                return function(seriesCallback) {
                    task(function(err, result){
                        seriesCallback(!err || finalAttempt, {err: err, result: result});
                    }, wrappedResults);
                };
            };
            while (times) {
                attempts.push(retryAttempt(task, !(times-=1)));
            }
            async.series(attempts, function(done, data){
                data = data[data.length - 1];
                (wrappedCallback || callback)(data.err, data.result);
            });
        }
        // If a callback is passed, run this as a controll flow
        return callback ? wrappedTask() : wrappedTask
    };

    async.waterfall = function (tasks, callback) {
        callback = callback || function () {};
        if (!_isArray(tasks)) {
          var err = new Error('First argument to waterfall must be an array of functions');
          return callback(err);
        }
        if (!tasks.length) {
            return callback();
        }
        var wrapIterator = function (iterator) {
            return function (err) {
                if (err) {
                    callback.apply(null, arguments);
                    callback = function () {};
                }
                else {
                    var args = Array.prototype.slice.call(arguments, 1);
                    var next = iterator.next();
                    if (next) {
                        args.push(wrapIterator(next));
                    }
                    else {
                        args.push(callback);
                    }
                    async.setImmediate(function () {
                        iterator.apply(null, args);
                    });
                }
            };
        };
        wrapIterator(async.iterator(tasks))();
    };

    var _parallel = function(eachfn, tasks, callback) {
        callback = callback || function () {};
        if (_isArray(tasks)) {
            eachfn.map(tasks, function (fn, callback) {
                if (fn) {
                    fn(function (err) {
                        var args = Array.prototype.slice.call(arguments, 1);
                        if (args.length <= 1) {
                            args = args[0];
                        }
                        callback.call(null, err, args);
                    });
                }
            }, callback);
        }
        else {
            var results = {};
            eachfn.each(_keys(tasks), function (k, callback) {
                tasks[k](function (err) {
                    var args = Array.prototype.slice.call(arguments, 1);
                    if (args.length <= 1) {
                        args = args[0];
                    }
                    results[k] = args;
                    callback(err);
                });
            }, function (err) {
                callback(err, results);
            });
        }
    };

    async.parallel = function (tasks, callback) {
        _parallel({ map: async.map, each: async.each }, tasks, callback);
    };

    async.parallelLimit = function(tasks, limit, callback) {
        _parallel({ map: _mapLimit(limit), each: _eachLimit(limit) }, tasks, callback);
    };

    async.series = function (tasks, callback) {
        callback = callback || function () {};
        if (_isArray(tasks)) {
            async.mapSeries(tasks, function (fn, callback) {
                if (fn) {
                    fn(function (err) {
                        var args = Array.prototype.slice.call(arguments, 1);
                        if (args.length <= 1) {
                            args = args[0];
                        }
                        callback.call(null, err, args);
                    });
                }
            }, callback);
        }
        else {
            var results = {};
            async.eachSeries(_keys(tasks), function (k, callback) {
                tasks[k](function (err) {
                    var args = Array.prototype.slice.call(arguments, 1);
                    if (args.length <= 1) {
                        args = args[0];
                    }
                    results[k] = args;
                    callback(err);
                });
            }, function (err) {
                callback(err, results);
            });
        }
    };

    async.iterator = function (tasks) {
        var makeCallback = function (index) {
            var fn = function () {
                if (tasks.length) {
                    tasks[index].apply(null, arguments);
                }
                return fn.next();
            };
            fn.next = function () {
                return (index < tasks.length - 1) ? makeCallback(index + 1): null;
            };
            return fn;
        };
        return makeCallback(0);
    };

    async.apply = function (fn) {
        var args = Array.prototype.slice.call(arguments, 1);
        return function () {
            return fn.apply(
                null, args.concat(Array.prototype.slice.call(arguments))
            );
        };
    };

    var _concat = function (eachfn, arr, fn, callback) {
        var r = [];
        eachfn(arr, function (x, cb) {
            fn(x, function (err, y) {
                r = r.concat(y || []);
                cb(err);
            });
        }, function (err) {
            callback(err, r);
        });
    };
    async.concat = doParallel(_concat);
    async.concatSeries = doSeries(_concat);

    async.whilst = function (test, iterator, callback) {
        if (test()) {
            iterator(function (err) {
                if (err) {
                    return callback(err);
                }
                async.whilst(test, iterator, callback);
            });
        }
        else {
            callback();
        }
    };

    async.doWhilst = function (iterator, test, callback) {
        iterator(function (err) {
            if (err) {
                return callback(err);
            }
            var args = Array.prototype.slice.call(arguments, 1);
            if (test.apply(null, args)) {
                async.doWhilst(iterator, test, callback);
            }
            else {
                callback();
            }
        });
    };

    async.until = function (test, iterator, callback) {
        if (!test()) {
            iterator(function (err) {
                if (err) {
                    return callback(err);
                }
                async.until(test, iterator, callback);
            });
        }
        else {
            callback();
        }
    };

    async.doUntil = function (iterator, test, callback) {
        iterator(function (err) {
            if (err) {
                return callback(err);
            }
            var args = Array.prototype.slice.call(arguments, 1);
            if (!test.apply(null, args)) {
                async.doUntil(iterator, test, callback);
            }
            else {
                callback();
            }
        });
    };

    async.queue = function (worker, concurrency) {
        if (concurrency === undefined) {
            concurrency = 1;
        }
        function _insert(q, data, pos, callback) {
          if (!q.started){
            q.started = true;
          }
          if (!_isArray(data)) {
              data = [data];
          }
          if(data.length == 0) {
             // call drain immediately if there are no tasks
             return async.setImmediate(function() {
                 if (q.drain) {
                     q.drain();
                 }
             });
          }
          _each(data, function(task) {
              var item = {
                  data: task,
                  callback: typeof callback === 'function' ? callback : null
              };

              if (pos) {
                q.tasks.unshift(item);
              } else {
                q.tasks.push(item);
              }

              if (q.saturated && q.tasks.length === q.concurrency) {
                  q.saturated();
              }
              async.setImmediate(q.process);
          });
        }

        var workers = 0;
        var q = {
            tasks: [],
            concurrency: concurrency,
            saturated: null,
            empty: null,
            drain: null,
            started: false,
            paused: false,
            push: function (data, callback) {
              _insert(q, data, false, callback);
            },
            kill: function () {
              q.drain = null;
              q.tasks = [];
            },
            unshift: function (data, callback) {
              _insert(q, data, true, callback);
            },
            process: function () {
                if (!q.paused && workers < q.concurrency && q.tasks.length) {
                    var task = q.tasks.shift();
                    if (q.empty && q.tasks.length === 0) {
                        q.empty();
                    }
                    workers += 1;
                    var next = function () {
                        workers -= 1;
                        if (task.callback) {
                            task.callback.apply(task, arguments);
                        }
                        if (q.drain && q.tasks.length + workers === 0) {
                            q.drain();
                        }
                        q.process();
                    };
                    var cb = only_once(next);
                    worker(task.data, cb);
                }
            },
            length: function () {
                return q.tasks.length;
            },
            running: function () {
                return workers;
            },
            idle: function() {
                return q.tasks.length + workers === 0;
            },
            pause: function () {
                if (q.paused === true) { return; }
                q.paused = true;
                q.process();
            },
            resume: function () {
                if (q.paused === false) { return; }
                q.paused = false;
                q.process();
            }
        };
        return q;
    };
    
    async.priorityQueue = function (worker, concurrency) {
        
        function _compareTasks(a, b){
          return a.priority - b.priority;
        };
        
        function _binarySearch(sequence, item, compare) {
          var beg = -1,
              end = sequence.length - 1;
          while (beg < end) {
            var mid = beg + ((end - beg + 1) >>> 1);
            if (compare(item, sequence[mid]) >= 0) {
              beg = mid;
            } else {
              end = mid - 1;
            }
          }
          return beg;
        }
        
        function _insert(q, data, priority, callback) {
          if (!q.started){
            q.started = true;
          }
          if (!_isArray(data)) {
              data = [data];
          }
          if(data.length == 0) {
             // call drain immediately if there are no tasks
             return async.setImmediate(function() {
                 if (q.drain) {
                     q.drain();
                 }
             });
          }
          _each(data, function(task) {
              var item = {
                  data: task,
                  priority: priority,
                  callback: typeof callback === 'function' ? callback : null
              };
              
              q.tasks.splice(_binarySearch(q.tasks, item, _compareTasks) + 1, 0, item);

              if (q.saturated && q.tasks.length === q.concurrency) {
                  q.saturated();
              }
              async.setImmediate(q.process);
          });
        }
        
        // Start with a normal queue
        var q = async.queue(worker, concurrency);
        
        // Override push to accept second parameter representing priority
        q.push = function (data, priority, callback) {
          _insert(q, data, priority, callback);
        };
        
        // Remove unshift function
        delete q.unshift;

        return q;
    };

    async.cargo = function (worker, payload) {
        var working     = false,
            tasks       = [];

        var cargo = {
            tasks: tasks,
            payload: payload,
            saturated: null,
            empty: null,
            drain: null,
            drained: true,
            push: function (data, callback) {
                if (!_isArray(data)) {
                    data = [data];
                }
                _each(data, function(task) {
                    tasks.push({
                        data: task,
                        callback: typeof callback === 'function' ? callback : null
                    });
                    cargo.drained = false;
                    if (cargo.saturated && tasks.length === payload) {
                        cargo.saturated();
                    }
                });
                async.setImmediate(cargo.process);
            },
            process: function process() {
                if (working) return;
                if (tasks.length === 0) {
                    if(cargo.drain && !cargo.drained) cargo.drain();
                    cargo.drained = true;
                    return;
                }

                var ts = typeof payload === 'number'
                            ? tasks.splice(0, payload)
                            : tasks.splice(0, tasks.length);

                var ds = _map(ts, function (task) {
                    return task.data;
                });

                if(cargo.empty) cargo.empty();
                working = true;
                worker(ds, function () {
                    working = false;

                    var args = arguments;
                    _each(ts, function (data) {
                        if (data.callback) {
                            data.callback.apply(null, args);
                        }
                    });

                    process();
                });
            },
            length: function () {
                return tasks.length;
            },
            running: function () {
                return working;
            }
        };
        return cargo;
    };

    var _console_fn = function (name) {
        return function (fn) {
            var args = Array.prototype.slice.call(arguments, 1);
            fn.apply(null, args.concat([function (err) {
                var args = Array.prototype.slice.call(arguments, 1);
                if (typeof console !== 'undefined') {
                    if (err) {
                        if (console.error) {
                            console.error(err);
                        }
                    }
                    else if (console[name]) {
                        _each(args, function (x) {
                            console[name](x);
                        });
                    }
                }
            }]));
        };
    };
    async.log = _console_fn('log');
    async.dir = _console_fn('dir');
    /*async.info = _console_fn('info');
    async.warn = _console_fn('warn');
    async.error = _console_fn('error');*/

    async.memoize = function (fn, hasher) {
        var memo = {};
        var queues = {};
        hasher = hasher || function (x) {
            return x;
        };
        var memoized = function () {
            var args = Array.prototype.slice.call(arguments);
            var callback = args.pop();
            var key = hasher.apply(null, args);
            if (key in memo) {
                async.nextTick(function () {
                    callback.apply(null, memo[key]);
                });
            }
            else if (key in queues) {
                queues[key].push(callback);
            }
            else {
                queues[key] = [callback];
                fn.apply(null, args.concat([function () {
                    memo[key] = arguments;
                    var q = queues[key];
                    delete queues[key];
                    for (var i = 0, l = q.length; i < l; i++) {
                      q[i].apply(null, arguments);
                    }
                }]));
            }
        };
        memoized.memo = memo;
        memoized.unmemoized = fn;
        return memoized;
    };

    async.unmemoize = function (fn) {
      return function () {
        return (fn.unmemoized || fn).apply(null, arguments);
      };
    };

    async.times = function (count, iterator, callback) {
        var counter = [];
        for (var i = 0; i < count; i++) {
            counter.push(i);
        }
        return async.map(counter, iterator, callback);
    };

    async.timesSeries = function (count, iterator, callback) {
        var counter = [];
        for (var i = 0; i < count; i++) {
            counter.push(i);
        }
        return async.mapSeries(counter, iterator, callback);
    };

    async.seq = function (/* functions... */) {
        var fns = arguments;
        return function () {
            var that = this;
            var args = Array.prototype.slice.call(arguments);
            var callback = args.pop();
            async.reduce(fns, args, function (newargs, fn, cb) {
                fn.apply(that, newargs.concat([function () {
                    var err = arguments[0];
                    var nextargs = Array.prototype.slice.call(arguments, 1);
                    cb(err, nextargs);
                }]))
            },
            function (err, results) {
                callback.apply(that, [err].concat(results));
            });
        };
    };

    async.compose = function (/* functions... */) {
      return async.seq.apply(null, Array.prototype.reverse.call(arguments));
    };

    var _applyEach = function (eachfn, fns /*args...*/) {
        var go = function () {
            var that = this;
            var args = Array.prototype.slice.call(arguments);
            var callback = args.pop();
            return eachfn(fns, function (fn, cb) {
                fn.apply(that, args.concat([cb]));
            },
            callback);
        };
        if (arguments.length > 2) {
            var args = Array.prototype.slice.call(arguments, 2);
            return go.apply(this, args);
        }
        else {
            return go;
        }
    };
    async.applyEach = doParallel(_applyEach);
    async.applyEachSeries = doSeries(_applyEach);

    async.forever = function (fn, callback) {
        function next(err) {
            if (err) {
                if (callback) {
                    return callback(err);
                }
                throw err;
            }
            fn(next);
        }
        next();
    };

    // Node.js
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = async;
    }
    // AMD / RequireJS
    else if (typeof define !== 'undefined' && define.amd) {
        define([], function () {
            return async;
        });
    }
    // included directly via <script> tag
    else {
        root.async = async;
    }

}());

}).call(this,_dereq_("1YiZ5S"))
},{"1YiZ5S":3}],2:[function(_dereq_,module,exports){

},{}],3:[function(_dereq_,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],4:[function(_dereq_,module,exports){
var Discus = _dereq_('./discus');
_dereq_('./model');
var _super = _dereq_('./super');
var Backbone = _dereq_("backbone");

Discus.Collection = function() {
	Backbone.Collection.apply(this, arguments);
	this.discusInitialize.apply(this, arguments);
};
Discus.Collection.prototype = Backbone.Collection.prototype;
Discus.Collection.extend = Backbone.Collection.extend;

Discus.Collection = Discus.Collection.extend({
	_super: _super,
	model: Discus.Model,

	discusInitialize: function() {
		// do nothing


		// profit?
	}
});

module.exports = Discus.Collection;

},{"./discus":5,"./model":8,"./super":11}],5:[function(_dereq_,module,exports){
var Backbone = _dereq_("backbone");
var _ = _dereq_("underscore");

function CreateClone() {
	var root = this,
		_sync = root.sync,
		Module;
	function Factory(){
	}
	Factory.prototype = root;
	Factory.prototype.createClone = CreateClone;

	Module = new Factory();
	Module.VERSION_ARRAY = _(Backbone.VERSION.split('.')).map(function(val) { return parseInt(val); });

	root.sync = function() {
		if (Module.hasOwnProperty('sync')) {
			return Module.sync.apply(Module, arguments);
		}
		return _sync.apply(root, arguments);
	};

	return Module;
}

module.exports = CreateClone.apply(Backbone);

},{}],6:[function(_dereq_,module,exports){
var Discus = _dereq_('./discus'),
	async = _dereq_('async'),
	_ = _dereq_('underscore'),
	$ = _dereq_('jquery');

_dereq_('./view');
_dereq_('./model');

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
		}

		_.bindAll(this, 'refilter', 'resort', 'resetCollection', 'renderModels');

		this.stateModel = new Discus.Model({});

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
	},
	// this deconstructs and reconstructs the DOM
	// it can be kind of heavy, but generally is a good operation
	// it's somewhat important to run this at least the first time we're actually attached to the dom
	// (and all subsequent renders where we're attached to a fresh unmodified dom)
	rebuildDOM: function() {
		var target = this.getRenderTarget();

		// Start!
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

		if (this.options.renderAttached) {
			this.attachDOM();
		}

		if (this.isLoading()) {
			this._d.loadingSpinnerShown = true;
			this.renderLoading();

		} else if (this._d.listCache.length === 0) {
			this.showNoData();
			this.renderFooter();
		} else {

			// render in all of the views that should be rendered. This is the heavy-ish task..
			_(this._d.renderedViews).each(function(view) {
				view.renderTo(target);
			});

			// render footer. Ordering matters, footers DO NOT clean themselves up or maintain themselves..
			this.renderFooter();
		}

		if (!this.options.renderAttached) {
			this.attachDOM();
		}

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

		if (this.placeHolder.parent().length) {
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
								_d.renderedViews[viewOffset].$el.insertAfter(_d.renderedViews[viewOffset-1].$el);
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
					position: 'relative'
				}
			}).appendTo(this.$el);
		}

		scrollParent = nearestScrollableParent(sparse.holder.get(0));

		sparse.holder.css({
			height: 'auto'
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
			sparse.offset = Math.min(parseInt(this.collection.metadata.total) - this.options.sparseLimit, sparse.offset);
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
					}(rejects))
				}
				debugger;
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
		if (this._d.renderedViews.length === 0) {
			return;
		}
		if (!this.sparse.scrollParent) {
			return this.generateSparseRenderTarget();
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
	// getRenderOffset
	// getRenderTarget
	// getStateModel
	// getView
	// isLoading

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

		if (currentRow && !_.any(listCache, function(cache) { return cache.m.cid === currentRow.cid })) {
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

},{"./discus":5,"./model":8,"./view":14,"async":1}],7:[function(_dereq_,module,exports){
_dereq_('./discus');
_dereq_('./super');
_dereq_('./object');
_dereq_('./model');
_dereq_('./collection');
_dereq_('./view');
_dereq_('./screen');
_dereq_('./list_view');
_dereq_('./table_view');

module.exports = _dereq_('./discus');

},{"./collection":4,"./discus":5,"./list_view":6,"./model":8,"./object":9,"./screen":10,"./super":11,"./table_view":13,"./view":14}],8:[function(_dereq_,module,exports){
var Discus = _dereq_('./discus');
var _super = _dereq_('./super');
var Backbone = _dereq_("backbone");

Discus.Model = function() {
	Backbone.Model.apply(this, arguments);
	this.discusInitialize.apply(this, arguments);
};
Discus.Model.prototype = Backbone.Model.prototype;
Discus.Model.extend = Backbone.Model.extend;

Discus.Model = Discus.Model.extend({
	_super: _super,

	discusInitialize: function(data) {
		this.___list_view_shared_views = {};
		if (data && data.parent) {
			console.error("Do not give models parents!!");
			debugger;
		}
	},

	set: function(data) {
		if (data.toJSON || data.toArray) {
			debugger; //jshint ignore: line
		}
		return Backbone.Model.prototype.set.apply(this, arguments);
	},

	fetch: function() {
		var res = Backbone.Model.prototype.fetch.apply(this, arguments);

		this.promise = res.promise;
		this.trigger('fetch', res.promise());

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

},{"./discus":5,"./super":11}],9:[function(_dereq_,module,exports){
var _ = _dereq_('underscore');
var Discus = _dereq_('./discus');
var _super = _dereq_('./super');

// define base class
Discus.Object = function() {
	var self = this,
		initParams;
	this.cid = _.uniqueId('class');
	initParams = arguments;
	self.init = (function() {
		var result = self.initialize.apply(self, initParams);
		return function() { return result; };
	}());
};

_.extend(Discus.Object.prototype, Discus.Events, {
	initialize: function() { return this; },
	_super: _super
});

Discus.Object.extend = Discus.Model.extend;

module.exports = Discus.Object;

},{"./discus":5,"./super":11}],10:[function(_dereq_,module,exports){
var Discus = _dereq_('./discus');
_dereq_('./view'); // depends on view

Discus.Screen = Discus.View.extend({
	screenStateModel: function() {
		return this.stateModel;
	}
});

},{"./discus":5,"./view":14}],11:[function(_dereq_,module,exports){
var Discus = _dereq_('./discus');

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

_dereq_('underscore').each(["Collection", "Router"], function(klass) {
	Discus[klass].prototype._super = _super;
});

module.exports = _super;

},{"./discus":5}],12:[function(_dereq_,module,exports){
var _ = _dereq_('underscore');
var Discus = _dereq_('./discus');

Discus.TableEntry = Discus.View.extend({
	tagName: 'tr',

	initialize: function() {
		this._super('initialize', arguments);
		this.table = this.options.parent;
	},

	render: function() {
		var self = this;

		this.$el.empty();

		_(this.table.stateModel.get('columns')).each(function(column) {
			self.renderColumn(column, self.model.displayValue(column));
		});

		this.redelegateEvents();
	},

	renderColumn: function(name, value) {
		this.$el.append('<td>' + value + '</td>');
	}
});

module.exports = Discus.TableView;

},{"./discus":5}],13:[function(_dereq_,module,exports){
var Discus = _dereq_('./discus');
var ListView = _dereq_('./list_view');
var TableEntry = _dereq_('./table_entry');
var $ = _dereq_('jquery');
var _ = _dereq_('underscore');

Discus.TableView = ListView.extend({
	defaults: function() {
		var data = this._super("defaults", arguments);

		$.extend(data, {
			sparse: true,
			renderLimit: 12,
			renderThrottle: 150,
			sparseTagName: 'tbody',
			sparseClassName: 'tableView',
			sparseLimit: 100,

			viewClass: Discus.TableEntry
		});

		return data;
	},

	tagName: 'table',

	initialize: function() {
		if (!this.options.columns || !_.isArray(this.options.columns)) {
			throw new Error("You must pass columns in to Talbe View");
		}

		this._super("initialize", arguments);

		this.stateModel.set({
			columns: this.options.columns
		});
	}
});

module.exports = Discus.TableView;

},{"./discus":5,"./list_view":6,"./table_entry":12}],14:[function(_dereq_,module,exports){
var Discus = _dereq_('./discus');
var _super = _dereq_('./super');
var _ = _dereq_('underscore');
var Backbone = _dereq_("backbone");
var $ = _dereq_("jquery");

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
	},

	screenStateModel: function() {
		if (this.parent()) {
			return this.parent().screenStateModel();
		}
		return this.stateModel;
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
		if (!child) {
			console.warn("Tried to add a non-existent child");
			debugger;
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
			debugger;
			return;
		}
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
		if ((!this.__readyPromise || this.__readyPromise.isResolved())
			&& _.all(this.__children, function(child) { return child._checkRenderComplete(); }))
		{
			this.isRenderComplete = true;
			this.trigger('renderComplete');
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
	}
}

module.exports = Discus.View;
},{"./discus":5,"./super":11}]},{},[7])
(7)
});