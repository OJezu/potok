'use strict';
/* jshint mocha:true */
/* jshint -W030 */ // "Expected an assignment or function call and instead saw an expression." chai causes those

var chai = require('chai');
chai.use(require('chai-as-promised'));
chai.use(require('chai-things'));
chai.should();


var when = require('when');

var MultiPromise = require('../src/MultiPromise.js');
var Errors = require('../src/Errors.js'); 

describe('MultiPromise', function(){
	//this.timeout(5);
	describe('MultiPromise(handlers, options)', function(){
		it('works with "new" in front', function(){
			var each = function(){return true;};
			var mp = new MultiPromise({each: each}, {rejected: 'distil'});
			mp._handlers.each.should.be.equal(each);
			mp._reject_policy.should.be.equal('distil');
		});
		it('works without "new" in front', function(){
			var each = function(){return true;};
			var mp = MultiPromise({each: each}, {rejected: 'distil'});
			mp._handlers.each.should.be.equal(each);
			mp._reject_policy.should.be.equal('distil');
		});
		it('accepts »beforeAll« handler');
		it('accepts »each« handler');
		it('accepts »eachRejected« handler');
		it('accepts »afterAll« handler');
		it('accepts »all« handler, but not allows other handlers when it`s set handler is set', function(){
			var all = function(){};
			try {
				MultiPromise({all: all, each: all});
				throw new Error('unexpected success');
			} catch (err){
				err.message.should.match(/»all« handler is declared/);
			}
		});
		
		it('~mocks handlers when "all" handler is set', function(){
			var all = function(){return true;};
			var mp = MultiPromise({all: all}, {rejected: 'distil'});
			mp._handlers.afterAll.should.be.equal(all);
		});

		it('not allows non-function handlers', function(){
			var all = ':p';
			try {
				MultiPromise({all: all});
				throw new Error('Unexpected success.');
			} catch (err){
				err.message.should.match(/handler »all« is not a function/i);
			}
		});
		
		it('sets default reject policy', function(){
			var mp = MultiPromise({});
			mp._reject_policy.should.be.equal('rejectAll');
		});
		
		it('throws error when started without handlers argument', function(){
			try {
				MultiPromise();
				throw new Error('unexpected success');
			} catch (err){
				err.message.should.match(/handlers must be an object/i);
			}
		});
		it('runs beforeAll handler if it is defined', function(done){
			var beforeAll = function(){
				done();
			};
			
			MultiPromise({beforeAll: beforeAll});	
		});
		it('not allows unknown handler names');
		it('not allows unknown reject policies');
	});
	
	describe('.enter(promise)', function(){
		it('causes »each« handler to be run on every resolved promise entered', function(done){
			var nv = ['foo', 'bar', 'foobar'];
			var each = function(result){
				nv = nv.filter(function(e){return e !== result;});
				if(nv.length ===0) {
					done();
				}
				return true;
			};
			var mp = MultiPromise({each: each});
			mp.enter('foo');
			mp.enter(when('bar'));
			mp.enter(when('foobar'));
		});
		
		it('waits with calling each and eachRejected handlers until beforeAll finished', function(done){
			var nv = {'foo': when('foo'), 'bar': when.reject('bar')};
			var before_finished = false;
			var beforeAll = function(){
				return when().delay(2).tap(function(){
					before_finished = true;
				});
			};
			var each = function(result){
				
				if(!before_finished){
					done(new Error('Before has not finished yet!'));
				}
				delete nv[result];
				if(Object.keys(nv).length ===0) {
					done();
				}
				return true;
			};
			var mp = MultiPromise({eachRejected: each, each: each, beforeAll: beforeAll});
			mp.enter(nv.bar);
			mp.enter(nv.foo);
		});
		it('rejects with WriteAfterEnd when called after end', function(){
			var mp = MultiPromise({});
			mp.end().ended().done();
			return mp.enter().then(function(){
				throw new Error('unexpected success');
			}, function(err){
				err.should.be.instanceof(Errors.WriteAfterEnd);
			});
		});
	});
	describe('»beforeAll« handler', function(){
		it('is called when MultiPromise is constructed');
		it('can add promises with ».enter()«');
		it('other handlers wait until it finishes');
	});
	describe('»each« handler', function(){
		it('is called on each fullfiled promise');
		it('its results are in the outcome');
		it('if it returns null, promise is removed from the outcome');
		it('if it rejects rejection (even null) it is in the outcome');
	});
	describe('»eachRejected« handler', function(){
		it('is called on each fullfiled promise');
		it('its results are in the outcome');
		it('if it returns null, promise is removed from the outcome');
		it('if it rejects rejection (even null) it is in the outcome');
	});
	describe('»afterAll« handler', function(){});
	describe('»all« handler', function(){
		it('causes all promises to be passed through to it, and it\'s return value is added to outcome');
	});
	
	
	describe('.end(promise)', function(){
		it('waits for all tasks to finish', function(){
			var tasks = 0;
			var each = function(result){
				return when(true).delay(2).tap(function(){
					++tasks;
				});
			};
			var mp = MultiPromise({each: each});
			mp.enter('foo');
			mp.enter('bar');
			return mp.end().ended().then(function(){
				tasks.should.be.equal(2);
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
			
			var mp = MultiPromise({
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
		
		it('respects reject_policy=rejectAll', function(){
			var entries = [when.resolve('foo'), when.reject('bar'), when.resolve('baz')];
			var mp = MultiPromise({}, {rejected: 'rejectAll'});
			
			entries.forEach(mp.enter, mp);
			
			return mp.end().ended().then(function(res){
				console.log(res);
				throw new Error('Unexpected success'); 
			}, function(err){
				err.should.be.equal('bar');
			});
		});
		

		it('does not call »afterAll« when reject_policy=rejectAll and one of the promises rejected', function(){
			var entries = [when.resolve('foo'), when.reject('bar'), when.resolve('baz')];
			var after_all_caled = false;
			var mp = MultiPromise({
				afterAll: function(results){
					after_all_caled = true;
				}
			}, {rejected: 'rejectAll'});
			
			entries.forEach(mp.enter, mp);
			
			return mp.end().ended().then(function(res){
				console.log(res);
				throw new Error('Unexpected success'); 
			}, function(err){
				err.should.be.equal('bar');
				after_all_caled.should.be.false;
			});
		});
		
		it('respects reject_policy=rejectAll when »afterAll« rejects', function(){
			var entries = [when.resolve('foo'), when.reject('bar'), when.resolve('baz')];
			var mp = MultiPromise({}, {rejected: 'rejectAll'});
			
			entries.forEach(mp.enter, mp);
			
			return mp.end().ended().then(function(res){
				console.log(res);
				throw new Error('Unexpected success'); 
			}, function(err){
				err.should.be.equal('bar');
			});
		});

		it('respects reject_policy=rejectAll when »afterAll« pushes rejected reslt', function(){
			var entries = [when.resolve('foo'), when.resolve('baz')];
			var mp = MultiPromise({
				afterAll: function(result){
					mp.finalPushResult(when.reject('bar'));
					return when.all(result).then(function(result){
						result.should.be.deep.equal(['foo', 'baz']);
					});
				}
			}, {rejected: 'rejectAll'});
			
			entries.forEach(mp.enter, mp);
			
			return mp.end().ended().then(function(res){
				console.log(res);
				throw new Error('Unexpected success'); 
			}, function(err){
				err.should.be.equal('bar');
			});
		});

		it('respects reject_policy=filterOut', function(){
			var entries = [when.resolve('foo'), when.reject('bar'), when.resolve('baz')];
			var mp = MultiPromise({}, {rejected: 'filterOut'});
			
			entries.forEach(mp.enter, mp);
			
			return mp.end().ended().then(function(res){
				return when.all(res).then(function(res){
					res.should.be.deep.equal(['foo', 'baz']);
				});
			});
		});
		
		it('respects reject_policy=distil', function(){
			var entries = [when.resolve('foo'), when.reject('bar'), when.resolve('baz'), when.reject('fer')];
			var mp = MultiPromise({}, {rejected: 'distil'});
			
			entries.forEach(mp.enter, mp);
			
			return mp.end().ended().then(function(res){
				return when.settle(res).then(function(res){
					res.should.be.deep.equal([{reason: 'bar', state: 'rejected'}, {reason: 'fer', state: 'rejected'}]);
				});
			});
		});
		
		it('respects reject_policy=pass', function(){
			var entries = [when.resolve('foo'), when.reject('bar'), when.resolve('baz'), when.reject('fer')];
			var mp = MultiPromise({}, {rejected: 'pass'});
			
			entries.forEach(mp.enter, mp);
			
			return mp.end().ended().then(function(res){
				return when.settle(res).then(function(res){
					res.should.be.deep.equal([
						{value: 'foo', state: 'fulfilled'},
						{reason: 'bar', state: 'rejected'},
						{value: 'baz', state: 'fulfilled'},
						{reason: 'fer', state: 'rejected'},
					]);
				});
			});
		});
		it('creates result in a form of array of all promises that do not resolve to null', function(){
			var entries = [when.resolve('foo'), when.reject('bar'), when.resolve('baz'), when.reject('fer'), when.resolve(null)];
			
			var mp = MultiPromise({}, {rejected: 'pass'});
			
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
			
			var mp = MultiPromise({
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
			}, {rejected: 'pass'});
			
			entries.forEach(mp.enter, mp);
			
			return mp.end().ended().then(function(){
				after_all_called.should.be.true;
			});
		});
		
		it('appends result with outcome of »afterAll« handler', function(){
			var entries = [
				when.resolve('foo'),
				when.reject('bar'),
				when.resolve('baz'),
				when.reject('fer'),
			];
			var mp = MultiPromise({
				afterAll: function(res){return 'ugabuga';}
			}, {rejected: 'pass'});
			
			entries.forEach(mp.enter, mp);
			
			return mp.end().ended().then(function(result){
				return when.settle(result).then(function(res){
					res.should.be.deep.equal([
						{value: 'foo', state: 'fulfilled'},
						{reason: 'bar', state: 'rejected'},
						{value: 'baz', state: 'fulfilled'},
						{reason: 'fer', state: 'rejected'},
						{value: 'ugabuga', state: 'fulfilled'},
					]);
					return true;
				});
			});
		});

		it('appends its argument to outcome', function(){
			var entries = [
				when.resolve('foo'),
				when.reject('bar'),
				when.resolve('baz'),
			];
			var mp = MultiPromise({}, {rejected: 'pass'});
			
			entries.forEach(mp.enter, mp);
			
			return mp.end(when.reject('fer')).ended().then(function(result){
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
		
		it('appends its argument to outcome, unless it is null', function(){
			var entries = [
				when.resolve('foo'),
				when.reject('bar'),
				when.resolve('baz'),
			];
			var mp = MultiPromise({}, {rejected: 'pass'});
			
			entries.forEach(mp.enter, mp);
			
			return mp.end(when.resolve(null)).ended().then(function(result){
				return when.settle(result).then(function(res){
					res.should.be.deep.equal([
						{value: 'foo', state: 'fulfilled'},
						{reason: 'bar', state: 'rejected'},
						{value: 'baz', state: 'fulfilled'},
					]);
					return true;
				});
			});
		});
		
		it('appends its argument to outcome when it is null and »pass_nulls« option is on', function(){
			var entries = [
				when.resolve('foo'),
				when.reject('bar'),
				when.resolve('baz'),
			];
			var mp = MultiPromise({}, {rejected: 'pass', pass_nulls: true});
			
			entries.forEach(mp.enter, mp);
			
			return mp.end(null).ended().then(function(result){
				return when.settle(result).then(function(res){
					res.should.be.deep.equal([
						{value: 'foo', state: 'fulfilled'},
						{reason: 'bar', state: 'rejected'},
						{value: 'baz', state: 'fulfilled'},
						{value: null, state: 'fulfilled'},
					]);
					return true;
				});
			});
		});
		
		it('appends result with rejected outcome of »afterAll« handler', function(){
			var entries = [
				when.resolve('foo'),
				when.reject('bar'),
				when.resolve('baz'),
				when.reject('fer'),
			];
			var mp = MultiPromise({
				afterAll: function(res){throw 'ugabuga';}
			}, {rejected: 'pass'});
			
			entries.forEach(mp.enter, mp);
			
			return mp.end().ended().then(function(result){
				return when.settle(result).then(function(res){
					res.should.be.deep.equal([
						{value: 'foo', state: 'fulfilled'},
						{reason: 'bar', state: 'rejected'},
						{value: 'baz', state: 'fulfilled'},
						{reason: 'fer', state: 'rejected'},
						{reason: 'ugabuga', state: 'rejected'},
					]);
					return true;
				});
			});
		});
		
		it('not passes nulls', function(){
			var entries = [
				when.resolve(null),
				when.reject(null),
				when.resolve('baz'),
				when.reject('fer'),
			];
			var mp = MultiPromise({
				afterAll: function(res){return null;}
			}, {rejected: 'pass'});
			
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
			var mp = MultiPromise({
				afterAll: function(res){return null;}
			}, {rejected: 'pass', pass_nulls: true});
			
			entries.forEach(mp.enter, mp);
			
			return mp.end().ended().then(function(result){
				return when.settle(result).then(function(res){
					res.should.be.deep.equal([
						{value: null, state: 'fulfilled'},
						{reason: null, state: 'rejected'},
						{value: 'baz', state: 'fulfilled'},
						{reason: 'fer', state: 'rejected'},
						{value: null, state: 'fulfilled'},
					]);
					return true;
				});
			});
		});
	});
	
	describe('.ended()', function(){
		it('returns promise that will resolve once MultiPromise is ended', function(){
			var mp = MultiPromise({}, {});
			mp.end();
			return mp.ended();
		});
		it('resolves with full output in a form of array of promises for all tasks which did not resolve to null', function(){
			var mp = MultiPromise({
				afterAll: function(){
					mp.finalPushResult('baw');
					mp.finalPushResult(null);
					return 'baz';
				}
			});
			mp.enter('foo');
			mp.enter(null);
			mp.end('bar');
			return mp.ended().then(function(result){
				return when.all(result).then(function(res){
					res.should.be.deep.equal(['foo', 'bar', 'baz', 'baw']);
				});
			});
		});
		it('resolves with full output in a form of array of promises for all tasks if »pass_nulls« option is on', function(){
			var mp = MultiPromise({
				afterAll: function(){
					mp.finalPushResult('baw');
					mp.finalPushResult(null);
					return 'baz';
				}
			}, {pass_nulls: true});
			mp.enter('foo');
			mp.enter(null);
			mp.end('bar');
			return mp.ended().then(function(result){
				return when.all(result).then(function(res){
					res.should.be.deep.equal(['foo', null, 'bar', 'baz', 'baw', null]);
				});
			});
		});
	});
	
	describe('.pushResult(promise)', function(){
		it('adds things to the output thing', function(){
			var entries = [
				when.resolve('foo'),
				when.resolve('baz'),
			];
			
			var mp = MultiPromise({
				each: function(entry){
					mp.pushResult(entry+'_2');
					return entry;
				}
			}, {rejected: 'pass'});
			
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
			
			var mp = MultiPromise({
				each: function(entry){
					mp.pushResult(when.reject(entry+'_2'));
					return entry;
				}
			}, {rejected: 'pass'});
			
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
		
		it('throws WriteAfterEnd after end finished waiting for pushResult', function(){
			var mp = MultiPromise({}, {rejected: 'pass'});
			return mp.end().ended()
			.then(function(){
				return mp.pushResult('bar_2');
			}).then(function(){
				throw new Error('unwated success');
			}, function(error){
				error.should.be.instanceof(Errors.WriteAfterEnd);
			});
		});
		

		it('is included in output even if called asynchronously in handler', function(){
			var mp = MultiPromise({
				each: function(entry){
					when().then(mp.pushResult.bind(mp, 'bar_2')).done();
					return entry;
				}
				
			}, {rejected: 'pass'});
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
	
	describe('.chain(MultiPromise)', function(){
		it('accepts another MultiPromise as sole argument', function(){
			var mp_a = MultiPromise({});
			var mp_b = MultiPromise({});
			mp_a.chain(mp_b);
		});
		it('actually accepts anything with »enter« and »end« methods', function(){
			var mp_a = MultiPromise({});
			var mp_b = {enter: function(){}, end: function(){}};
			mp_a.chain(mp_b);
		});
		it('but accepts not anything else', function(){
			var mp_a = MultiPromise({});
			var mp_b = {enter: function(){}, end: 'foo'};
			try {
				mp_a.chain(mp_b);
				throw new Error('Unexpected error');
			} catch(err) {
				err.should.be.instanceof(Errors.MultiPromiseError);
			}
		});
		it('returns its argument', function(){
			var mp_a = MultiPromise({});
			var mp_b = {enter: function(){}, end: function(){}};
			mp_a.chain(mp_b).should.be.equal(mp_b);
		});
		it('fires handlers of chained MultiPromise as soon as possible if no »afterAll« handler is declared on earlier MultiPromise', function(){
			var hits = 0;
			var mp_a = MultiPromise({});
			var mp_b = MultiPromise({each: function(){++hits;}});
			mp_a.chain(mp_b);
			mp_a.enter('foo');
			mp_a.enter('bar');
			return when().delay(2).then(function(){
				hits.should.be.equal(2);
				mp_a.end();
			});
		});
		it('propagates end to chained MultiPromise', function(done){
			var mp_a = MultiPromise({});
			var mp_b = MultiPromise({afterAll: function(){done();}});
			mp_a.chain(mp_b);
			mp_a.end();
		});
		it('propagates entries and »end« even if chain happened after end', function(){
			var hits = 0;
			var after_all_called = false;
			var mp_a = MultiPromise({});
			var mp_b = MultiPromise({
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
		
		it('should propagate errors', function(){
			var mp_a = MultiPromise({}, {rejected: 'rejectAll'});
			var mp_b = MultiPromise({}, {rejected: 'rejectAll'});
			mp_a.end(when.reject('foo'));
			
			return mp_a.chain(mp_b).ended().should.be.rejectedWith('foo');
		});
		
		it('passes result of earlier »afterAll« handler to chained MultiPromise', function(){
			var mp_a = MultiPromise({
				afterAll: function(){
					return 'after_all';
				}
			});
			var mp_b = MultiPromise({
				each: function(value){
					return value;
				}
			});
			mp_a.enter('foo');
			mp_a.end();
			return mp_a.chain(mp_b).ended().then(function(result){
				return when.all(result).then(function(result){
					result.should.be.deep.equal(['foo', 'after_all']);
				});
			});
		});
		
		it('not passes nulls', function(){
			var mp_a = MultiPromise({});
			var mp_b = MultiPromise({}, {pass_nulls: true});
			mp_a.enter('foo');
			mp_a.enter(null);
			mp_a.end(null);
			return mp_a.chain(mp_b).ended().then(function(result){
				return when.all(result).then(function(result){
					result.should.be.deep.equal(['foo']);
				});
			});
		});

		it('passes nulls if »pass_nulls« option is on', function(){
			var mp_a = MultiPromise({}, {pass_nulls: true});
			var mp_b = MultiPromise({}, {pass_nulls: true});
			mp_a.enter('foo');
			mp_a.enter(null);
			mp_a.end(null);
			return mp_a.chain(mp_b).ended().then(function(result){
				return when.all(result).then(function(result){
					result.should.be.deep.equal(['foo', null, null]);
				});
			});
		});
	});
});