'use strict';
var when = require('when');

var Errors = require('./Errors.js');

function noop(){};

function Potok(handlers, options){
	if( !(this instanceof Potok)){
		return new Potok(handlers, options);
	}
	if(options !== undefined && typeof(options) !== 'object'){
		throw new Errors.PotokError('»options« must be an object or undefined');
	}
	if(!options){
		options = {};
	}
	// ############# init
	this._promises = [];
	this._handlers = null;
	
	this._chained = [];
	this._closed = false; //don't accept new promises from .enter 
	this._results_closed = false; //don't accept new promises from .push
	this._pass_nulls = undefined;

	this._before_all_promise = undefined;
	
	this._deferred_end = when.defer();
	
	var handler_types = ['beforeAll', 'all', 'afterAll', 'each', 'eachRejected', 'eachFulfilled'];
	var allowed_options = ['pass_nulls'];
	
	// ############# options
	
	for(var key in options){
		if(!options.hasOwnProperty(key)){
			if(allowed_options.indexOf(key) === -1){
				//mask things that were inherited from prototype
				options.key = undefined;
			}
		} else if(key !== undefined && allowed_options.indexOf(key) === -1){
			throw new Errors.PotokError('Unknown option »'+key+'«');
		}
	}
	
	this._pass_nulls = !!options.pass_nulls;
	
	// ############# handlers
	if(typeof(handlers) !== 'object'){
		throw new Errors.PotokError('Handlers must be an object');
	}
	/* jshint -W004 */
	for(var key in handlers){
	/* jshint +W004 */
		if(!handlers.hasOwnProperty(key)){
			if(handler_types.indexOf(key) === -1){
				//mask things that were inherited from prototype
				handlers.key = undefined;
			}
		} else if(key !== undefined && handler_types.indexOf(key) === -1){
			throw new Errors.PotokError('Unknown handler type »'+key+'«');
		} else if(typeof(handlers[key]) !== 'function'){
			throw new Errors.PotokError('Handler »'+key+'« is not a function.');
		}
	}
	
	if(handlers.all){
		if(Object.keys(handlers).length !== 1){
			throw new Errors.PotokError('If »all« handler is declared, no other handlers can be declared.');
		}
		var all_promises = [];
		this._handlers = {
			afterAll: function(){
				var promise = handlers.all(all_promises);
				this.pushFinal(promise);
				return null;
			}.bind(this),
			each: function(promise){
				all_promises.push(promise);
				return null;
			}
		};
	} else {
		this._handlers = handlers;
	}
	if(handlers.each){
		if(handlers.eachRejected || handlers.eachFulfilled){
			throw new Errors.PotokError('If »each« handler is declared neither »eachRejected« nor »eachFulfilled« can be declared.');
		}
	}
	
	// ########### before all
	if(this._handlers.beforeAll){
		// when using .then() asynchronous call is guaranteed 
		this._before_all_promise = when(this).then(this._handlers.beforeAll);
	} else {
		this._before_all_promise = when();
	}
};

/* Unused */
Potok.prototype._poolForPromiseResolution = function _poolForPromiseResolution(){
	var promise_count = this._promises.length;
	return when.settle(this._promises).then(function(){
		if(this._promises.length !== promise_count){
			return this._poolForPromiseResolution();
		} else {
			return this._promises;
		}
	}.bind(this));
};

Potok.prototype._removeNullsFromResults = function(promises){
	var self = this;
	return when.settle(this._promises)
	.then(function(promises){
		promises.forEach(function(entry, i){
			entry.promise = self._promises[i];
		});
		return promises;
	}).then(function(results){
		if(self._pass_nulls === true){
			return results;
		} else {
			return results.filter(function(entry){
				//don't _pass resolved, but null promises
				return entry.state === 'rejected' || (entry !== null && entry.value !== null);
			});
		}
	}).then(function(results){
		return results.map(function(e){return e.promise;});
	});
};

Potok.prototype._end = function _end(lazy_end){
	this._closed = !lazy_end;

	//no return
	when(this._before_all_promise)
	.with(this)
	.then(function(){
		return this._poolForPromiseResolution(); // all .entry() called
	}).tap(function(){
		this._closed = true;
		this._results_closed = true;
	}).then(this._removeNullsFromResults.bind(this, this._promises)) //all promised entered
	.then(function(results){
		if(this._handlers.afterAll){
			var overwrite_push = Object.create(this);
			overwrite_push.push = this.pushFinal;
			var after_all = when.try(this._handlers.afterAll, overwrite_push);
			
			return after_all
				.then(this._removeNullsFromResults.bind(this, this._promises));
		} else {
			return results;
		}
	}).tap(function(){
		this._results_closed = true;
	}).done(this._deferred_end.resolve, this._deferred_end.reject);
	
	return this;
};

Potok.prototype.end = function end(promise){
	return this._end(false);
};

Potok.prototype.lazyEnd = function lazyEnd(){
	return this._end(true);
};

Potok.prototype.enter = function enter(value){
	if(this._closed){
		throw new Errors.WriteAfterEnd();
	}
	
	// silence potentially unhandled rejections:
	// https://github.com/cujojs/when/blob/master/docs/api.md#edge-cases
	when(value).catch(noop);
	
	if(this._handlers.each){
		this.push(
			when(this._before_all_promise)
				.then(this._handlers.each.bind(null, when(value), this))
		);
	} else {
		var wrappedEachFulfilled = this._handlers.eachFulfilled
			&& function(value){
				return this._handlers.eachFulfilled(value, this);
			}.bind(this);
		
		var wrappedEachRejected = this._handlers.eachRejected
			&& function(reason){
				return this._handlers.eachRejected(reason, this);
			}.bind(this);
		
		this.push(
			when(this._before_all_promise)
				.yield(value)
				.then(wrappedEachFulfilled, wrappedEachRejected)
		);
	}
	return true;
};

Potok.prototype._push = function _push(value){
	this._promises.push(when(value));
	this._chained.forEach(function(chained){
		this._pass(chained, value).done();
	}, this);
	return true;
};

Potok.prototype.push = function push(value){
	if(this._results_closed){
		throw new Errors.WriteAfterEnd();
	}
	return this._push(value);
};


Potok.prototype.pushFinal = function pushFinal(value){
	// the below is as far as I dare to enforce proper usage of this function, anything more could get messy
	if(!this._results_closed || this._deferred_end.promise.inspect().state !== 'pending'){
		throw new Errors.PotokError('This special function must be called from afterAll handler before it resolves.');
	}
	return this._push(value);
};

Potok.prototype._pass = function _pass(chained, value){
	return when.try(function(){
		var promise = when(value);
		if(this._pass_nulls){
			return chained.enter(promise);
		} else {
			return when(promise).then(function(result){
				if(result !== null){
					return chained.enter(promise);
				}
			}, chained.enter.bind(chained, promise));
		}
	}.bind(this))
	.catch(Errors.WriteAfterEnd, noop)
	.catch(function(error){
		if( !(/Write after end/i.test(error.message)) ){
			var message_prefix = 'Chained potok ».enter()« method threw a non-write-after-end error:\n';
			var trans = new Errors.PotokFatalError(message_prefix+'\t'+(error.message || error || ''));
			trans.stack = (error.stack && message_prefix+error.stack )|| trans.stack;
			throw trans;
		}
	});
};

Potok.prototype.chain = function(chained){
	if(  typeof(chained) !== 'object'
	  || !(chained.enter instanceof Function) 
	  || !(chained.end instanceof Function)
	){
		throw new Errors.PotokError('Chained object must have »enter« and »end« methods.');
	}
	// add to _chained to be bumped on future promises
	this._chained.push(chained);
	
	// enter all the promises that were initialized earlier
	this._promises.forEach(function(promise){
		this._pass(chained, promise).done();
	}, this);
	this.ended().yield(undefined).finally(chained.end.bind(chained));
	
	return chained;
};

Potok.prototype.ended = function(){
	return this._deferred_end.promise;
};

module.exports = Potok;