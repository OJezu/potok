'use strict';
/* jshint mocha:true */
/* jshint -W030 */ // "Expected an assignment or function call and instead saw an expression." chai causes those

var chai = require('chai');
chai.should();


var when = require('when');

var Potok = require('../src/Potok.js');
var Errors = require('../src/Errors.js');

describe('Potok', function(){
	describe('.prototype', function(){
		describe('.chain(potok)', function(){
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
			
			it('propagates errors', function(){
				var mp_a = Potok({});
				var mp_b = Potok({});
				mp_a.enter(when.reject('foo'));
				mp_a.end();
				
				return when.all(mp_a.chain(mp_b).ended()).then(function(){
					throw new Error('Unwanted success');
				}, function(error){
					error.should.be.equal('foo');
				});
			});
			
			it('does not pass result of earlier »afterAll« handler to chained Potok', function(){
				var mp_a = Potok({
					afterAll: function(){
						mp_a.pushFinal('after_all_pushed');
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
						result.sort().should.be.deep.equal(['after_all_pushed', 'foo']);
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
			
			it('does not complain if chained potok is ended', function(){
				var mp_a = Potok({});
				var mp_b = Potok({});
				
				mp_a.chain(mp_b);
				mp_b.end();
				return mp_a.enter('foo');
			});
			

			it('does not complain if chained something-potok-like is ended', function(){
				var mp_a = Potok({});
				var mp_b = {
					end: function(){},
					enter:function(){
						throw new Error('write after end');
					},
				};
				
				mp_a.chain(mp_b);
				mp_b.end();
				return mp_a.enter('foo');
			});

			it('does not race', function(){
				var p_a = Potok({
					each: function(value){
						return when(value).delay(10);
					},
				});
				var p_b = Potok({});
				
				p_a.enter('foo');
				p_a.end();
				p_a.chain(p_b);
				return when.all(p_b.ended()).then(function(result){
					result.should.be.deep.equal(['foo']);
				});
			});
			
			it('crashes process if entity throws something that does not look like »Write after end«', function(done){
				var org_onFatalRejection = when.Promise.onFatalRejection;
				after(function(){
					when.Promise.onFatalRejection = org_onFatalRejection;
				});
				when.Promise.onFatalRejection = function(rejection){
					try{
						rejection.value.should.be.instanceOf(Errors.PotokFatalError);
						done();
					} catch(err){
						done(err);
					}
				};
				
				var mp_a = Potok({});
				var mp_b = {
					end: function(){},
					enter: function(){
						throw new Error('My hoovercraft is full of eels');
					},
				};
				
				mp_a.chain(mp_b);
				mp_b.end();
				mp_a.enter('foo');
				
			});
		});
	});
});