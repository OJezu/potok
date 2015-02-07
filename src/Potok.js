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
	this._results_closed = false; //don't accept new promises from .pushResult
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
				this.pushFinal.bind(promise);
				return promise;
			},
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
		this._before_all_promise = when.try(this._handlers.beforeAll);
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

Potok.prototype._processResults = function(promises){
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
	when(this._before_all_promise).with(this).then(function(){
		return this._poolForPromiseResolution(); // all .entry() called
	}).tap(function(){
		this._closed = true;
		this._results_closed = true;
	}).then(this._processResults.bind(this, this._promises)) //all promised entered
	.then(function(results){
		if(this._handlers.afterAll){
			var after_all = when.try(this._handlers.afterAll, results);
			
			//this._promises.push(after_all); //for future chains			
			this._chained.forEach(this._passX.bind(this, after_all));
			
			return after_all
				.catch(noop)
				.then(this._processResults.bind(this, this._promises));
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
		return when.reject(new Errors.WriteAfterEnd());
	}
	
	// silence potentially unhandled rejections:
	// https://github.com/cujojs/when/blob/master/docs/api.md#edge-cases
	when(value).catch(noop);
	if(this._handlers.each){
		this.push(when(this._before_all_promise)
			.then(this._handlers.each.bind(null, when(value)))
		);
	} else {	
		this.push(when(this._before_all_promise)
			.yield(value)
			.then(this._handlers.eachFulfilled, this._handlers.eachRejected)
		);
	}
	return when(true);
};

Potok.prototype._pushResult = function _pushResult(value){
	this._promises.push(when(value));
	this._chained.forEach(this._passX.bind(this, value));
	return true;
};

Potok.prototype.pushResult = function pushResult(value){
	if(this._results_closed){
		throw new Errors.WriteAfterEnd();
	}
	return this._pushResult(value);
};
Potok.prototype.push = Potok.prototype.pushResult;


Potok.prototype.finalPushResult = function finalPushResult(value){
	// the below is as far as I dare to enforce proper usage of this function, anything more could get messy
	if(!this._results_closed || this._deferred_end.promise.inspect().state !== 'pending'){
		throw new Errors.PotokError('This special function must be called from afterAll handler before it resolves.');
	}
	return this._pushResult(value);
};
Potok.prototype.finalPush = Potok.prototype.finalPushResult;

Potok.prototype._pass = function _pass(chained, value){
	var pass_promise;
	var promise = when(value);
	if(this._pass_nulls){
		pass_promise =  chained.enter(promise);
	} else {
		pass_promise = when(promise).then(function(result){
			if(result !== null){
				return chained.enter(promise);
			}
		}, chained.enter.bind(chained, promise));
	}
	return pass_promise
	.catch(Errors.WriteAfterEnd, noop)
	.catch(function(error){
		if( !(/Write after end/i.test(error.message)) ){
			throw error;
		}
	});
};
Potok.prototype._passX = function _passX(promise, chained){return this._pass(chained, promise);};

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
	this._promises.forEach(this._pass.bind(this, chained));
	this.ended().yield(undefined).finally(chained.end.bind(chained));
	
	return chained;
};

Potok.prototype.ended = function(){
	return this._deferred_end.promise;
};

module.exports = Potok;