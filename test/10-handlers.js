'use strict';
/* jshint mocha:true */
/* jshint -W030 */ // "Expected an assignment or function call and instead saw an expression." chai causes those

var chai = require('chai');
chai.should();


var when = require('when');

var Potok = require('../src/Potok.js');

describe('Potok', function(){
	describe('handlers', function(){
		describe('»beforeAll« handler', function(){
			it('is called when Potok is constructed', function(done){
				var beforeAll = function(){
					done();
				};
				
				Potok({beforeAll: beforeAll});	
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
	});
});