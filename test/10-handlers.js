'use strict';
/* jshint mocha:true */
/* jshint -W030 */ // "Expected an assignment or function call and instead saw an expression." chai causes those

var chai = require('chai');
chai.should();


var when = require('when');

var Potok = require('../src/Potok.js');
var Errors = require('../src/Errors.js');

function sortPromises(a, b){
	a = a && a.value || a && a.reason || a;
	b = b && b.value || b && b.reason || b;
	return String(a).localeCompare(b);
}

describe('Potok', function(){
	describe('handlers', function(){
		describe('»beforeAll« handler', function(){
			it('is called when Potok is constructed', function(done){
				var beforeAll = function(){
					done();
				};
				
				Potok({beforeAll: beforeAll});	
			});
			
			it('is called with one argument - current potok', function(){
				var p;
				var beforeAll = function(_p){
					_p.should.be.equal(p);
				};
				
				p = Potok({beforeAll: beforeAll});
				return p.end().ended();
			});
			
			it('can add promises with ».enter()«', function(){
				var mp;
				var beforeAll = function(){
					mp.enter('foo');
					mp.enter(when.reject('bar'));
					mp.end();
					return null;
				};
				
				mp = Potok({
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
			it('if returns an rejection, that rejection pops up in ».ended()«', function(){
				return Potok({
					beforeAll: function(){
						throw 'foo';
					},
				}).end().ended().then(function(){
					throw new Error('unwanted success');
				}, function(err){
					err.should.be.equal('foo');
				});	
			});
		});
		describe('»each« handler', function(){
			it('can not be declared the same time as either »eachRejected« or »eachFulfilled« handler', function(){
				try {
					Potok({each: function(){}, eachFulfilled: function(){}});
					throw new Error('Unexpected success');
				} catch (err){
					err.should.be.instanceOf(Errors.PotokError);
				}
				try {
					Potok({each: function(){}, eachRejected: function(){}});
					throw new Error('Unexpected success');
				} catch (err){
					err.should.be.instanceOf(Errors.PotokError);
				}
			});
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
			
			it('its called with two arguments - promise and current potok', function(){
				var mp = Potok({
					each: function(promise, _p){
						when.isPromiseLike(promise).should.be.true;
						_p.should.be.equal(mp);
						return true;
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
		describe('»eachFulfilled« handler', function(){
			it('is called on each fulfilled promise', function(done){
				var count = 0;
				var eachFulfilled = function(result){
					if(++count === 3){
						done();
					}
				};
				var mp = Potok({eachFulfilled: eachFulfilled});
				mp.enter(when.resolve('foo'));
				mp.enter(when.resolve('bar'));
				mp.enter(when.resolve('foobar'));
				mp.enter(when.reject('rejected!'));
			});
			
			it('has second argument of current potok', function(){
				var mp = Potok({
					eachFulfilled: function(promise, _p){
						_p.should.be.equal(mp);
						return true;
					}
				});
				
				['bar'].forEach(mp.enter, mp);
				
				return when.all(mp.end().ended());
			});
			
			it('is passed the fullfiled value of a promise', function(done){
				var nv = ['foo', 'bar', 'foobar'];
				var eachFulfilled = function(result){
					nv = nv.filter(function(e){return e !== result;});
					if(nv.length ===0) {
						done();
					}
				};
				var mp = Potok({eachFulfilled: eachFulfilled});
				mp.enter('foo');
				mp.enter('bar');
				mp.enter('foobar');
				mp.enter(when.reject('rejected!'));
			});
			
			it('its results are in the outcome', function(){
				var mp = Potok({
					eachFulfilled: function(reason){
						return reason+'_2';
					},
				});
				
				['foo', 'foobar'].forEach(mp.enter, mp);
				
				return when.all(mp.end().ended()).then(function(result){
					result.should.be.deep.equal([
						'foo_2',
						'foobar_2'
					]);
				});
			});
			
			it('if it returns null, promise is removed from the outcome', function(){
				var mp = Potok({
					eachFulfilled: function(promise){
						return null;
					},
				});
				
				['foo', 'foobar'].forEach(mp.enter, mp);
				
				return when.settle(mp.end().ended()).then(function(result){
					result.should.be.deep.equal([]);
				});
			});
			
			it('if it rejects rejection (even null) it is in the outcome', function(){
				var mp = Potok({
					eachFulfilled: function(promise){
						return when.reject(null);
					},
				});
				
				['foo', 'foobar'].forEach(mp.enter, mp);
				
				return when.settle(mp.end().ended()).then(function(result){
					result.should.be.deep.equal([
						{state: 'rejected', reason: null},
						{state: 'rejected', reason: null},
					]);
				});
			});
		});
		describe('»eachRejected« handler', function(){
			it('is called on each rejected promise', function(done){
				var count = 0;
				var eachRejected = function(result){
					if(++count === 3){
						done();
					}
				};
				var mp = Potok({eachRejected: eachRejected});
				mp.enter(when.reject('foo'));
				mp.enter(when.reject('bar'));
				mp.enter(when.reject('foobar'));
				mp.enter(when.resolve('fulfilled!'));
			});
			
			it('has second argument of current potok', function(){
				var mp = Potok({
					eachRejected: function(promise, _p){
						_p.should.be.equal(mp);
						return true;
					}
				});
				
				[when.reject('bar')].forEach(mp.enter, mp);
				
				return when.all(mp.end().ended());
			});
			
			it('is passed the rejection reason of a promise', function(done){
				var nv = ['foo', 'bar', 'foobar'];
				var eachRejected = function(result){
					nv = nv.filter(function(e){return e !== result;});
					if(nv.length ===0) {
						done();
					}
				};
				var mp = Potok({eachRejected: eachRejected});
				mp.enter(when.reject('foo'));
				mp.enter(when.reject('bar'));
				mp.enter(when.reject('foobar'));
				mp.enter(when.resolve('fulfilled!'));
			});
			
			it('its results are in the outcome', function(){
				var mp = Potok({
					eachRejected: function(reason){
						return reason+'_2';
					},
				});
				
				[when.reject('foo'), when.reject('foobar')].forEach(mp.enter, mp);
				
				return when.all(mp.end().ended()).then(function(result){
					result.should.be.deep.equal([
						'foo_2',
						'foobar_2'
					]);
				});
			});
			
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
			it('is called when Potok is ended', function(done){
				var afterAll = function(){
					done();
				};
				
				Potok({afterAll: afterAll}).end();
			});
			
			it('has argument of object with custom .push function prototyping from current potok', function(){
				var mp = Potok({
					afterAll: function(_p){
						Object.getPrototypeOf(_p).should.be.equal(mp);
						_p.push.should.be.equal(mp.pushFinal);
						return true;
					}
				});
								
				return when.all(mp.end().ended());
			});
			
			it('cannot add promises with ».enter()«', function(){
				var p = Potok({afterAll: function(){
						return p.enter();
					},
				});
				return p.end().ended().then(function(){
					throw new Error('unexpected success');
				}, function(err){
					err.should.be.instanceof(Errors.WriteAfterEnd);
				});
			});
			
			it('cannot add results with ».push()« from the original potok', function(){
					var p = Potok({afterAll: function(){
						return p.push('foo');
					},
				});
				return p.end().ended().then(function(){
					throw new Error('unexpected success');
				}, function(err){
					err.should.be.instanceof(Errors.WriteAfterEnd);
				});
			});
			

			it('can add results with ».push()« from the passed potok', function(){
				return when.all(Potok({afterAll: function(p){
						return p.push('foo');
					},
				}).end().ended()).then(function(result){
					result.should.deep.equal(['foo']);
				});
			});
			
			it('can add results with ».pushFinal()«, which won`t be processed by any handlers', function(done){
				var once = 0;
				var p = Potok({
					afterAll: function(){
						if(once++){
							done(new Error('Unwanted execution path'));
						};
						return p.pushFinal('foo');
					},
					each: function(p){
						done(new Error('Unwanted execution path'));
					},
				});
				return when.all(p.end().ended()).then(function(result){
					result.should.deep.equal(['foo']);
				}).done(done, done);
			});
			it('waits untill all »each« handlers finish', function(){
				var tasks = 0;
				var mp = Potok({
					each: function(result){
						return when(true).delay(2).tap(function(){
							++tasks;
						});
					},
					afterAll: function(){
						tasks.should.be.equal(2);
					},
				});
				mp.enter('foo');
				mp.enter('bar');
				return mp.end().ended();
			});
			
			it('if returns an rejection, that rejection pops up in ».ended()«', function(){
				return Potok({
					afterAll: function(){
						return when.reject('foo');
					},
				}).end().ended().then(function(){
					throw new Error('unwanted success');
				}, function(err){
					err.should.be.equal('foo');
				});	
			});
		});
		
		describe('»all« handler', function(){
			it('causes all promises to be passed through to it, and it\'s return value is set as only member of the outcome', function(){
				var p = Potok({
					all: function(promises){
						return when.settle(promises).then(function(result){
							result.sort(sortPromises).should.be.deep.equal([
								{state: 'fulfilled', value: 'bar'},
								{state: 'rejected', reason: 'baz'},
								{state: 'fulfilled', value: 'foo'},
								{state: 'rejected', reason: 'foobar'},
							]);
							return 'spam'; 
						});
					}
				});
				p.enter('bar');
				p.enter(when.reject('baz'));
				p.enter(when('foo'));
				p.enter(when.reject('foobar'));
				return p.end().ended().then(function(result){
					when.isPromiseLike(result[0]).should.be.true;
					return when.all(result).then(function(result){
						result.should.be.deep.equal(['spam']);
					});
				});
			});
			it('can throw or reject an error that will be only member of the outcome', function(){
				var p = Potok({
					all: function(promises){
						return when.settle(promises).then(function(result){
							result.sort(sortPromises).should.be.deep.equal([
								{state: 'fulfilled', value: 'bar'},
								{state: 'rejected', reason: 'baz'},
								{state: 'fulfilled', value: 'foo'},
								{state: 'rejected', reason: 'foobar'},
							]);
							throw 'spam'; 
						});
					}
				});
				p.enter('bar');
				p.enter(when.reject('baz'));
				p.enter(when('foo'));
				p.enter(when.reject('foobar'));
				return when.settle(p.end().ended()).then(function(result){
					result.should.be.deep.equal([{state:'rejected', reason:'spam'}]);
				});
			});
		});
	});
});