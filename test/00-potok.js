'use strict';
/* jshint mocha:true */
/* jshint -W030 */ // "Expected an assignment or function call and instead saw an expression." chai causes those

var chai = require('chai');
chai.should();


var when = require('when');

var Potok = require('../src/Potok.js');
var Errors = require('../src/Errors.js');

describe('Potok', function(){
	it('works with "new" in front', function(){
		var each = function(){return true;};
		var mp = new Potok({each: each});
		mp._handlers.each.should.be.equal(each);
	});
	it('works without "new" in front', function(){
		var each = function(){return true;};
		var mp = Potok({each: each});
		mp._handlers.each.should.be.equal(each);
	});
	it('accepts »beforeAll« handler', function(){
		Potok({beforeAll: function(){}});
	});
	it('accepts »each« handler', function(){
		Potok({each: function(){}});
	});
	it('accepts »eachFulfilled« handler', function(){
		Potok({eachFulfilled: function(){}});
	});
	it('accepts »eachRejected« handler', function(){
		Potok({eachRejected: function(){}});
	});
	it('accepts »afterAll« handler', function(){
		Potok({afterAll: function(){}});
	});
	it('accepts »all« handler', function(){
		Potok({all: function(){}});
	});
	it('accepts »all« handler, but not allows other handlers when it is set', function(){
		var all = function(){};
		try {
			Potok({all: all, each: all});
			throw new Error('unexpected success');
		} catch (err){
			err.message.should.match(/»all« handler is declared/);
		}
	});
	
	it('~mocks handlers when "all" handler is set', function(){
		try{
			var all = function(){return true;};
			var mp = Potok({all: all});
			mp._handlers.afterAll.should.be.instanceOf(Function);
			mp._handlers.each.should.be.instanceOf(Function);
		} catch (err){
			throw err;
		}
	});

	it('not allows non-function handlers', function(){
		var all = ':p';
		try {
			Potok({all: all});
			throw new Error('Unexpected success.');
		} catch (err){
			err.message.should.match(/handler »all« is not a function/i);
		}
	});

	it('throws error when started without handlers argument', function(){
		try {
			Potok();
			throw new Error('unexpected success');
		} catch (err){
			err.message.should.match(/handlers must be an object/i);
		}
	});
	it('not allows unknown handler names', function(){
		try{
			Potok({uga: function(){}});
			throw new Error('unexpected success');
		} catch (err){
			err.should.be.instanceof(Errors.PotokError);
		}
	});
	it('can add promises with ».enter()«', function(){
		var mp = Potok({
			eachFulfilled: function(input){ return input+'_fulfil';},
			eachRejected: function(input){ return input+'_reject';},
		});
		mp.enter('foo');
		mp.enter(when.reject('bar'));
		mp.end();
		return when.all(mp.ended()).then(function(results){
			results.sort().should.be.deep.equal(['bar_reject', 'foo_fulfil']);
		});
	});
	
	describe('.prototype', function(){
		describe('.enter(promise)', function(){
			it('rejects with WriteAfterEnd when called after end', function(){
				var mp = Potok({});
				mp.end().ended().done();
				return mp.enter().then(function(){
					throw new Error('unexpected success');
				}, function(err){
					err.should.be.instanceof(Errors.WriteAfterEnd);
				});
			});
			it('passes through unhandled rejected promises', function(){
				var nv = {'foo': when('foo'), 'bar': when.reject('bar')};
				var mp = new Potok({
					eachFulfilled: function(enter){return enter;},
				});
				for(var key in nv){
					mp.enter(nv[key]);
				}
				return when.settle(mp.end().ended()).then(function(res){
					res.should.be.deep.equal([
						{value: 'foo', state: 'fulfilled'},
						{reason: 'bar', state: 'rejected'},
					]);
				});
			});
			it('passes through unhandled resolved promises', function(){
				var nv = {'foo': when('foo'), 'bar': when.reject('bar')};
				var mp = new Potok({
					eachRejected: function(enter){return enter;},
				});
				for(var key in nv){
					mp.enter(nv[key]);
				}
				return when.settle(mp.end().ended()).then(function(res){
					res.should.be.deep.equal([
						{value: 'foo', state: 'fulfilled'},
						{value: 'bar', state: 'fulfilled'},
					]);
				});
			});
			it('passes through all unhandled promises', function(){
				var nv = {'foo': when('foo'), 'bar': when.reject('bar')};
				var mp = new Potok({});
				for(var key in nv){
					mp.enter(nv[key]);
				}
				return when.settle(mp.end().ended()).then(function(res){
					res.should.be.deep.equal([
						{value: 'foo', state: 'fulfilled'},
						{reason: 'bar', state: 'rejected'},
					]);
				});
			});
			it('can be quite recursive', function(){
				var mp = new Potok({
					each: function(entry){
						return when(entry).then(function(entry){
							if(entry > 0){
								mp.enter(--entry);
								return entry+1;
							} else {
								mp.end();
								return entry;
							}
						});
					}
				});
				mp.enter(10);
				
				return when.all(mp.ended()).then(function(result){
					result.should.be.deep.equal([10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
				});
			});
			
			it('can be quite recursive with lazy_end', function(){
				var mp = new Potok({
					each: function(entry){
						return when(entry).then(function(entry){
							if(entry > 0){
								mp.enter(--entry);
								return entry+1;
							} else {
								return entry;
							}
						});
					}
				});
				mp.enter(10);
				mp.lazyEnd();
				
				return when.all(mp.ended()).then(function(result){
					result.should.be.deep.equal([10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
				});
			});
		});
		
		describe('.end()', function(){
			it('waits for all tasks to finish', function(){
				var tasks = 0;
				var each = function(result){
					return when(true).delay(2).tap(function(){
						++tasks;
					});
				};
				var mp = Potok({each: each});
				mp.enter('foo');
				mp.enter('bar');
				return mp.end().ended().then(function(){
					tasks.should.be.equal(2);
				});
			});
			
			it('waits for »beforeAll« handler before ending', function(){
				var before_all_finished = false;
				var mp = Potok({
					beforeAll: function(){
						return when().delay(3).tap(function(){
							before_all_finished = true;
						});
					}
				});
				
				return mp.end().ended().then(function(){
					before_all_finished.should.be.true;
				});
			});
	
			it('waits for all tasks to finish before calling afterAll', function(){
				var tasks = 0;
				var each = function(result){
					return when(true).delay(2).tap(function(){
						++tasks;
					});
				};
				var after_all_called = false;
				
				var mp = Potok({
					each: each,
					afterAll: function(){
						after_all_called = true;
						tasks.should.be.equal(2);
					}
				});
				mp.enter('foo');
				mp.enter('bar');
				return mp.end().ended().then(function(){
					after_all_called.should.be.true;
					tasks.should.be.equal(2);
				});
			});
			
			it('creates result in a form of array of all promises that do not resolve to null', function(){
				var entries = [when.resolve('foo'), when.reject('bar'), when.resolve('baz'), when.reject('fer'), when.resolve(null)];
				
				var mp = Potok({});
				
				entries.forEach(mp.enter, mp);
				
				return mp.end().ended().then(function(result){
					return when.settle(result).then(function(res){
						res.should.be.deep.equal([
							{value: 'foo', state: 'fulfilled'},
							{reason: 'bar', state: 'rejected'},
							{value: 'baz', state: 'fulfilled'},
							{reason: 'fer', state: 'rejected'},
						]);
						return true;
					});
				});
			});
			it('passes result to »afterAll« handler', function(){
				var entries = [when.resolve('foo'), when.reject('bar'), when.resolve('baz'), when.reject('fer'), when.resolve(null)];
				
				var after_all_called = false;
				
				var mp = Potok({
					afterAll: function(res){
						return when.settle(res).then(function(res){
							res.should.be.deep.equal([
								{value: 'foo', state: 'fulfilled'},
								{reason: 'bar', state: 'rejected'},
								{value: 'baz', state: 'fulfilled'},
								{reason: 'fer', state: 'rejected'},
							]);
							after_all_called = true;
							return true;
						});
					}
				});
				
				entries.forEach(mp.enter, mp);
				
				return mp.end().ended().then(function(){
					after_all_called.should.be.true;
				});
			});
			
			it('not passes nulls', function(){
				var entries = [
					when.resolve(null),
					when.reject(null),
					when.resolve('baz'),
					when.reject('fer'),
				];
				var mp = Potok({});
				
				entries.forEach(mp.enter, mp);
				
				return mp.end().ended().then(function(result){
					return when.settle(result).then(function(res){
						res.should.be.deep.equal([
							{reason: null, state: 'rejected'},
							{value: 'baz', state: 'fulfilled'},
							{reason: 'fer', state: 'rejected'},
						]);
						return true;
					});
				});
			});
			
	
			it('passes nulls when »pass_nulls« option is on', function(){
				var entries = [
					when.resolve(null),
					when.reject(null),
					when.resolve('baz'),
					when.reject('fer'),
				];
				var mp = Potok({}, {pass_nulls: true});
				
				entries.forEach(mp.enter, mp);
				
				return mp.end().ended().then(function(result){
					return when.settle(result).then(function(res){
						res.should.be.deep.equal([
							{value: null, state: 'fulfilled'},
							{reason: null, state: 'rejected'},
							{value: 'baz', state: 'fulfilled'},
							{reason: 'fer', state: 'rejected'},
						]);
						return true;
					});
				});
			});
		});
		
		describe('.lazyEnd()', function(){
			it('allows adding tasks with ».enter()« until all already added ones are resolved');
		});
		
		describe('.ended()', function(){
			it('returns promise that will resolve once Potok is ended', function(){
				var mp = Potok({}, {});
				mp.end();
				return mp.ended();
			});
			it('resolves with full output in a form of array of promises for all tasks which did not resolve to null', function(){
				var mp = Potok({
					afterAll: function(){
						mp.finalPushResult('baw');
						mp.finalPushResult(null);
						return 'baz';
					}
				});
				mp.enter('foo');
				mp.enter(null);
				mp.enter('bar');
				mp.end();
				return mp.ended().then(function(result){
					return when.all(result).then(function(res){
						res.should.be.deep.equal(['foo', 'bar', 'baw']);
					});
				});
			});
			it('resolves with full output in a form of array of promises for all tasks if »pass_nulls« option is on', function(){
				var mp = Potok({
					afterAll: function(){
						mp.finalPushResult('baw');
						mp.finalPushResult(null);
					}
				}, {pass_nulls: true});
				mp.enter('foo');
				mp.enter(null);
				mp.enter('bar');
				mp.end();
				return mp.ended().then(function(result){
					return when.all(result).then(function(res){
						res.should.be.deep.equal(['foo', null, 'bar', 'baw', null]);
					});
				});
			});
		});
		
		describe('.push(promise)', function(){
			it('adds things to the output thing', function(){
				var entries = [
					when.resolve('foo'),
					when.resolve('baz'),
				];
				
				var mp = Potok({
					eachFulfilled: function(entry){
						mp.push(entry+'_2');
						return entry;
					}
				});
				
				entries.forEach(mp.enter, mp);
				
				return mp.end().ended().then(function(result){
					return when.all(result).then(function(result){
						result.sort().should.be.deep.equal(['baz', 'baz_2', 'foo', 'foo_2']);
					});
				});
			});
			
			it('adds rejected things to the output thing', function(){
				var entries = [
					when.resolve('foo'),
					when.resolve('baz'),
				];
				
				var mp = Potok({
					eachFulfilled: function(entry){
						mp.push(when.reject(entry+'_2'));
						return entry;
					}
				});
				
				entries.forEach(mp.enter, mp);
				
				return mp.end().ended().then(function(result){
					return when.settle(result).then(function(res){
						res.sort(function(a, b){return (a.value || a.reason).localeCompare(b.value || b.reason);});
						//yeah, I know localeCompare is slow.
						
						res.should.be.deep.equal([
	  						{value: 'baz', state: 'fulfilled'},
	  						{reason: 'baz_2', state: 'rejected'},
	  						{value: 'foo', state: 'fulfilled'},
	  						{reason: 'foo_2', state: 'rejected'},
	  					]);
					});
				});
			});
			
			it('throws WriteAfterEnd after end finished waiting for tasks', function(){
				var mp = Potok({});
				return mp.end().ended()
				.then(function(){
					return mp.push('bar_2');
				}).then(function(){
					throw new Error('unwated success');
				}, function(error){
					error.should.be.instanceof(Errors.WriteAfterEnd);
				});
			});
			
	
			it('is included in output even if called asynchronously in handler', function(){
				var mp = Potok({
					each: function(entry){
						when().then(mp.push.bind(mp, 'bar_2')).done();
						return entry;
					}
					
				});
				mp.enter('bar');
				return mp.end().ended().then(function(result){
					return when.all(result).then(function(result){
						result.should.be.deep.equal(['bar', 'bar_2']);
					});
				});
			});
		});
		
		describe('.finalPushResults()', function(){
			it('can be used during »afterAll« handler');
			it('throws when used before »afterAll« handler');
			it('throws when used after »afterAll« handler');
		});
		
	});
});