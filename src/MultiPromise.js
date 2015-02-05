'use strict';
var when = require('when');

var Errors = require('./Errors.js');

function MultiPromise(handlers, options){
	if( !(this instanceof MultiPromise)){
		return new MultiPromise(handlers, options);
	}
	if(options !== undefined && typeof(options) !== 'object'){
		throw new Errors.MultiPromiseError('»options« must be an object or undefined');
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

	this._reject_policy = undefined;
	this._before_all_promise = undefined;
	
	this._deferred_end = when.defer();
	
	var handler_types = ['beforeAll', 'all', 'afterAll', 'each', 'eachRejected'];
	var reject_policies = ['rejectAll', 'distil', 'filterOut', 'pass'];
	var allowed_options = ['rejected', 'pass_nulls'];
	
	// ############# options
	
	for(var key in options){
		if(!options.hasOwnProperty(key)){
			if(allowed_options.indexOf(key) === -1){
				//mask things that were inherited from prototype
				options.key = undefined;
			}
		} else if(key !== undefined && allowed_options.indexOf(key) === -1){
			throw new Errors.MultiPromiseError('Unknown option »'+key+'«');
		}
	}
	
	this._pass_nulls = !!options.pass_nulls;
	var reject_policy = options.rejected;
	
	// ############# handlers
	if(typeof(handlers) !== 'object'){
		throw new Errors.MultiPromiseError('Handlers must be an object');
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
			throw new Errors.MultiPromiseError('Unknown handler type »'+key+'«');
		} else if(typeof(handlers[key]) !== 'function'){
			throw new Errors.MultiPromiseError('Handler »'+key+'« is not a function.');
		}
	}
	
	if(handlers.all){
		if(Object.keys(handlers).length !== 1){
			throw new Errors.MultiPromiseError('If »all« handler is declared, no other handlers can be declared.');
		}
		this._handlers = {afterAll: handlers.all, each: function(){return null;}, eachRejected: function(){return null;}};
	} else {
		this._handlers = handlers;
	}
	
	// ############### reject policy
	if(reject_policy === undefined){
		this._reject_policy = 'rejectAll';
	} else {
		if(reject_policies.indexOf(reject_policy) === -1){
			throw new Errors.MultiPromiseError('Invalid reject policy, allowed reject policies are: '+reject_policies.join(', '));
		}
		this._reject_policy = reject_policy;
	}
	// ########### before all
	this._before_all_promise = this._handlers.beforeAll ? when.try(this._handlers.beforeAll): when();
};

MultiPromise.prototype._processResults = function(promises){
	var self = this;
	return when.settle(promises) // all promises entered by .pushResult finished
	.then(function(promises){
		promises.forEach(function(entry, i){
			entry.promise = self._promises[i];
		});
		return promises.filter(function(entry){
			switch(self._reject_policy){
				case 'pass':      return true;
				case 'filterOut': return entry.state === 'fulfilled';
				case 'distil':    return entry.state === 'rejected';
				case 'rejectAll':
					if(entry.state === 'rejected'){
						throw entry.reason;
					}
					return true;
			};
		});
	}).then(function(results){
		if(self._pass_nulls === true){
			return results;
		} else {
			return results.filter(function(entry){
				//don't pass resolved, but null promises
				return entry.state === 'rejected' || (entry !== null && entry.value !== null);
			});
		}
	}).then(function(results){
		return results.map(function(e){return e.promise;});
	});
};

MultiPromise.prototype.end = function end(promise){
	if(promise !== undefined){
		this.enter(promise);
	}
	var self = this;
	this._closed = true;
		
	//no return
	when.settle(this._promises)// all .entry() called
	.tap(function(){
		self._results_closed = true;
	}).then(this._processResults.bind(this, this._promises)) //all promised entered
	.then(function(results){
		if(self._handlers.afterAll){
			var after_all = when.try(self._handlers.afterAll, results);
			
			self._promises.push(after_all); //for future chains			
			self._chained.forEach(self.passX.bind(self, after_all));
			
			return after_all.catch(function(){})
			.then(self._processResults.bind(self, self._promises));
		} else {
			return results;
		}
	}).tap(function(){
		self._results_closed = true;
	}).done(this._deferred_end.resolve, this._deferred_end.reject);
	
	return this;
};

MultiPromise.prototype.enter = function enter(promise){
	if(this._closed){
		return when.reject(new Errors.WriteAfterEnd());
	}
	// silence potentially unhandled rejections:
	// https://github.com/cujojs/when/blob/master/docs/api.md#edge-cases
	when(promise).catch(function(){});
	
	var task_promise = when(this._before_all_promise)
		.yield(promise)
		.catch(function(err){
			//recreate promise, so that it is potentially unhandled again
			throw err;
		}).then(this._handlers.each, this._handlers.eachRejected);
	
	this._promises.push(task_promise);
	this._chained.forEach(this.passX.bind(this, task_promise));	
	
	return when(true);
};

MultiPromise.prototype._pushResult = function _pushResult(promise){
	this._promises.push(when(promise));
	this._chained.forEach(function(chained){
		chained.enter(promise);
	});
	return true;
};

MultiPromise.prototype.pushResult = function pushResult(promise){
	if(this._results_closed){
		throw new Errors.WriteAfterEnd();
	}
	return this._pushResult(promise);
};


MultiPromise.prototype.finalPushResult = function finalPushResult(promise){
	// the below is as far as I dare to enforce proper usage of this function, anything more could get messy
	if(!this._results_closed || this._deferred_end.promise.inspect().state !== 'pending'){
		throw new Errors.MultiPromiseError('This special function must be called from afterAll handler before it resolves.');
	}
	return this._pushResult(promise);
};

MultiPromise.prototype.pass = function pass(chained, promise){
	if(this._pass_nulls){
		return chained.enter(promise);
	} else {
		return when(promise).then(function(result){
			if(result !== null){
				return chained.enter(promise);
			}
		}, chained.enter.bind(chained, promise));
	}
};
MultiPromise.prototype.passX = function passX(promise, chained){return this.pass(chained, promise);};

MultiPromise.prototype.chain = function(chained){
	if(  typeof(chained) !== 'object'
	  || !(chained.enter instanceof Function) 
	  || !(chained.end instanceof Function)
	){
		throw new Errors.MultiPromiseError('Chained object must have »enter« and »end« methods.');
	}
	// add to _chained to be bumped on future promises
	this._chained.push(chained);
	
	// enter all the promises that were initialized earlier
	this._promises.forEach(this.pass.bind(this, chained));
	this.ended().yield(undefined).finally(chained.end.bind(chained));
	
	return chained;
};

MultiPromise.prototype.ended = function(){
	return this._deferred_end.promise;
};

module.exports = MultiPromise;