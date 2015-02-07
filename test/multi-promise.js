'use strict';
/* jshint mocha:true */
/* jshint -W030 */ // "Expected an assignment or function call and instead saw an expression." chai causes those

var chai = require('chai');
chai.use(require('chai-as-promised'));
chai.use(require('chai-things'));
chai.should();


var when = require('when');

var Potok = require('../src/Potok.js');
var Errors = require('../src/Errors.js'); 

describe('Potok', function(){
	this.slow(10);
	this.timeout(50);
	describe('Potok(handlers, options)', function(){
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
	});
	
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
	describe('»beforeAll« handler', function(){
		it('is called when Potok is constructed', function(done){
			var beforeAll = function(){
				done();
			};
			
			Potok({beforeAll: beforeAll});	
		});
		
		it('can add promises with ».enter()«', function(){
			var beforeAll = function(){
				mp.enter('foo');
				mp.enter(when.reject('bar'));
				mp.end();
				return null;
			};
			
			var mp = Potok({
				beforeAll: beforeAll,
				eachFulfilled: function(input){ return input+'_fulfil';},
				eachRejected: function(input){ return input+'_reject';},
			});
			return when.all(mp.ended()).then(function(results){
				results.sort().should.be.deep.equal(['bar_reject', 'foo_fulfil']);
			});
		});
		it('»each« handler waits until it finishes', function(done){
			var nv = {'foo': when('foo'), 'bar': when.reject('bar')};
			var before_finished = false;
			var beforeAll = function(){
				return when().delay(4).tap(function(){
					before_finished = true;
				});
			};
			var each = function(){
				if(!before_finished){
					done(new Error('Before has not finished yet!'));
				}
				return null;
			};
			var mp = Potok({
				each: each,
				beforeAll: beforeAll
			});
			mp.enter(nv.foo);
			mp.enter(nv.bar);
			return mp.end().ended().yield().done(done, done);
		});
		it('»eachRejected« and »eachFulfiled« handler waits until it finishes', function(done){
			var nv = {'foo': when('foo'), 'bar': when.reject('bar')};
			var before_finished = false;
			var beforeAll = function(){
				return when().delay(4).tap(function(){
					before_finished = true;
				});
			};
			var each = function(){
				if(!before_finished){
					done(new Error('Before has not finished yet!'));
				}
				return null;
			};
			var mp = Potok({
				eachRejected: each,
				eachFulfilled: each,
				beforeAll: beforeAll
			});
			mp.enter(nv.foo);
			mp.enter(nv.bar);
			return mp.end().ended().yield().done(done, done);
		});
	});
	describe('»each« handler', function(){
		it('is called on each promise', function(done){
			var nv = ['foo', 'bar', 'foobar'];
			var each = function(result){
				return when(result).then(function(result){
					nv = nv.filter(function(e){return e !== result;});
					if(nv.length ===0) {
						done();
					}
					return true;
				});
			};
			var mp = Potok({each: each});
			mp.enter('foo');
			mp.enter(when('bar'));
			mp.enter(when('foobar'));
			mp.enter(when.reject('rejected!'));
		});
		it('its called with promise as the argument', function(){
			var mp = Potok({
				each: function(promise){
					return when.isPromiseLike(promise);
				}
			});
			
			['foo', when.reject('bar'), when('foobar')].forEach(mp.enter, mp);
			
			return when.all(mp.end().ended()).then(function(result){
				result.should.be.deep.equal([true, true, true]);
			});
		});
		it('its results are in the outcome', function(){
			var vals = ['foo', when.reject('bar'), when('foobar')];
			var i=0;
			var mp = Potok({
				each: function(promise){
					return vals[i++];
				}
			});
			mp.enter('your');
			mp.enter('mom');
			mp.enter('haha');
			return when.settle(mp.end().ended()).then(function(result){
				result.should.be.deep.equal([
					{value: 'foo', state: 'fulfilled'},
					{reason: 'bar', state: 'rejected'},
					{value: 'foobar', state: 'fulfilled'},
				]);
			});
		});
		
		it('if it returns null, promise is removed from the outcome', function(){
			var i=0;
			var mp = Potok({
				each: function(promise){
					return (i++)%2 ? null : promise;
				},
			});
			
			['foo', when('foobar'), when.reject('bar')].forEach(mp.enter, mp);
			
			return when.settle(mp.end().ended()).then(function(result){
				result.should.be.deep.equal([
					{value: 'foo', state: 'fulfilled'},
					{reason: 'bar', state: 'rejected'},
				]);
			});
		});

		it('if it returns null when »pass_nulls« option is on, null is in result', function(){
			var i=0;
			var mp = Potok({
				each: function(promise){
					return (i++)%2 ? null : promise;
				},
			}, {pass_nulls: true});
			
			['foo', when('foobar'), when.reject('bar')].forEach(mp.enter, mp);
			
			return when.settle(mp.end().ended()).then(function(result){
				result.should.be.deep.equal([
					{value: 'foo', state: 'fulfilled'},
					{value: null, state: 'fulfilled'},
					{reason: 'bar', state: 'rejected'},
				]);
			});
		});
		
		it('if it rejects rejection (even null) it is in the outcome', function(){
			var mp = Potok({
				each: function(promise){
					return when.reject(null);
				},
			});
			
			['foo', when('foobar')].forEach(mp.enter, mp);
			
			return when.settle(mp.end().ended()).then(function(result){
				result.should.be.deep.equal([
					{reason: null, state: 'rejected'},
					{reason: null, state: 'rejected'},
				]);
			});
		});
	});
	describe('»eachRejected« handler', function(){
		it('is called on each rejected promise', function(done){
			var nv = ['foo', 'bar', 'foobar'];
			var eachRejected = function(result){
				return when(result).then(function(result){
					nv = nv.filter(function(e){return e !== result;});
					if(nv.length ===0) {
						done();
					}
					return true;
				});
			};
			var mp = Potok({eachRejected: eachRejected});
			mp.enter(when.reject('foo'));
			mp.enter(when.reject('bar'));
			mp.enter(when.reject('foobar'));
			mp.enter(when.resolve('fulfilled!'));
		});
		it('is passed the rejection reason of a promise');
		it('its results are in the outcome');
		it('if it returns null, promise is removed from the outcome', function(){
			var mp = Potok({
				eachRejected: function(promise){
					return null;
				},
			});
			
			[when.reject('foo'), when.reject('foobar')].forEach(mp.enter, mp);
			
			return when.settle(mp.end().ended()).then(function(result){
				result.should.be.deep.equal([]);
			});
		});
		
		it('if it rejects rejection (even null) it is in the outcome', function(){
			var mp = Potok({
				eachRejected: function(promise){
					return when.reject(null);
				},
			});
			
			[when.reject('foo'), when.reject('foobar')].forEach(mp.enter, mp);
			
			return when.settle(mp.end().ended()).then(function(result){
				result.should.be.deep.equal([
					{state: 'rejected', reason: null},
					{state: 'rejected', reason: null},
				]);
			});
		});
	});
	describe('»afterAll« handler', function(){
		it('is called when Potok is constructed', function(done){
			var beforeAll = function(){
				done();
			};
			
			Potok({beforeAll: beforeAll});	
		});
		
		it('cannot add promises with ».enter()«');
		it('cannot add results with ».push()«');
		it('can add results with ».pushFinal()«, which won`t be processed by any handlers');
		it('waits untill all »each« handlers finish');
		it('waits untill all »eachFulfilled« and »eachRejected« handlers finish');
	});
	
	describe('»all« handler', function(){
		it('causes all promises to be passed through to it, and it\'s return value is set as only member of the outcome');
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
			this.timeout(10);
			this.slow(5);
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
	
	describe('.finalPushResults', function(){
		it('can be used during »afterAll« handler');
		it('throws when used before »afterAll« handler');
		it('throws when used after »afterAll« handler');
	});
	
	describe('.chain(Potok)', function(){
		it('accepts another Potok as sole argument', function(){
			var mp_a = Potok({});
			var mp_b = Potok({});
			mp_a.chain(mp_b);
		});
		it('actually accepts anything with »enter« and »end« methods', function(){
			var mp_a = Potok({});
			var mp_b = {enter: function(){}, end: function(){}};
			mp_a.chain(mp_b);
		});
		it('but not accepts anything else', function(){
			var mp_a = Potok({});
			var mp_b = {enter: function(){}, end: 'foo'};
			try {
				mp_a.chain(mp_b);
				throw new Error('Unexpected error');
			} catch(err) {
				err.should.be.instanceof(Errors.PotokError);
			}
		});
		it('returns its argument', function(){
			var mp_a = Potok({});
			var mp_b = {enter: function(){}, end: function(){}};
			mp_a.chain(mp_b).should.be.equal(mp_b);
		});
		it('fires handlers of chained Potok as soon as possible', function(){
			var hits = 0;
			var mp_a = Potok({});
			var mp_b = Potok({each: function(){++hits;}});
			mp_a.chain(mp_b);
			mp_a.enter('foo');
			mp_a.enter('bar');
			return when().delay(2).then(function(){
				hits.should.be.equal(2);
				mp_a.end();
			});
		});
		it('propagates end to chained Potok', function(done){
			var mp_a = Potok({});
			var mp_b = Potok({afterAll: function(){done();}});
			mp_a.chain(mp_b);
			mp_a.end();
		});
		it('propagates entries and »end« even if chain happened after end', function(){
			var hits = 0;
			var after_all_called = false;
			var mp_a = Potok({});
			var mp_b = Potok({
				afterAll: function(){
					after_all_called = true;
					return null;
				},
				each: function(value){
					++hits;
					return value;
				}
			});
			mp_a.enter('foo');
			mp_a.end();
			return mp_a.chain(mp_b).ended().then(function(result){
				hits.should.be.equal(1);
				after_all_called.should.be.true;
			});
			
		});
		
		it('spropagates errors', function(){
			var mp_a = Potok({});
			var mp_b = Potok({});
			mp_a.enter(when.reject('foo'));
			mp_a.end();
			
			return when.all(mp_a.chain(mp_b).ended()).should.be.rejectedWith('foo');
		});
		
		it('passes result of earlier »afterAll« handler to chained Potok', function(){
			var mp_a = Potok({
				afterAll: function(){
					mp_a.finalPush('after_all_pushed');
					return 'after_all';
				}
			});
			var mp_b = Potok({
				each: function(value){
					return value;
				}
			});
			mp_a.enter('foo');
			mp_a.end();
			return mp_a.chain(mp_b).ended().then(function(result){
				return when.all(result).then(function(result){
					result.sort().should.be.deep.equal(['after_all', 'after_all_pushed', 'foo']);
				});
			});
		});
		
		it('not passes nulls', function(){
			var mp_a = Potok({});
			var mp_b = Potok({}, {pass_nulls: true});
			mp_a.enter('foo');
			mp_a.enter(null);
			mp_a.end();
			return mp_a.chain(mp_b).ended().then(function(result){
				return when.all(result).then(function(result){
					result.should.be.deep.equal(['foo']);
				});
			});
		});

		it('passes nulls if »pass_nulls« option is on', function(){
			var mp_a = Potok({}, {pass_nulls: true});
			var mp_b = Potok({}, {pass_nulls: true});
			mp_a.enter('foo');
			mp_a.enter(null);
			mp_a.end();
			return mp_a.chain(mp_b).ended().then(function(result){
				return when.all(result).then(function(result){
					result.should.be.deep.equal(['foo', null]);
				});
			});
		});
		
		it('does not complain if chained multi_promise is ended', function(){
			var mp_a = Potok({});
			var mp_b = Potok({});
			
			mp_a.chain(mp_b);
			mp_b.end();
			return mp_a.enter('foo');
		});
		
		it('passes through »null« promise just before receiver ends', function(){
			var mp_a = Potok({}, {pass_nulls: true});
			var mp_b = Potok({}, {pass_nulls: true});
			
			mp_a.chain(mp_b);
			mp_a.enter(null);
			mp_b.end();
			mp_a.end();
			return mp_b.ended().then(function(result){
				return when.all(result).then(function(result){
					result.should.be.deep.equal([null]);
				});
			});
		});
	});
});