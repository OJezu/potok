'use strict';
/* jshint mocha:true */
/* jshint -W030 */ // "Expected an assignment or function call and instead saw an expression." chai causes those

var when = require('when');
require('chai').should();

var Potok = require('../potok.js');

describe('Potok', function(){
	describe('.prototype', function(){
		describe('.failOnReject()', function(){
			it('returns promise', function(){
				var potok = Potok({});
				return when.isPromiseLike(potok.failOnReject()).should.be.true;
			});
			
			it('if there are no rejected tasks returns promise fulfilling '+ 
					'with the array of tasks', function(){
				var potok = Potok({});
				potok.enter('foo');
				potok.enter(when('bar'));
				potok.end();
				return potok.failOnReject().then(function(result){
					result.sort().should.be.deep.equal([
						'bar',
						'foo'
					]);
				});
			});
			
			it('if any task was rejected returns promise rejecting with '+ 
					'one of the rejection reasons', function(){
				var potok = Potok({});
				potok.enter('foo');
				potok.enter(when.reject('bar'));
				potok.end();
				return potok.failOnReject().then(function(result){
					throw new Error('Unwated success.');
				}, function(error){
					error.should.be.equal('bar');
				});
			});
			
			it('if some task were rejected returns promise rejecting with '+ 
					'one of the rejection reasons', function(){
				var potok = Potok({});
				potok.enter('foo');
				potok.enter(when.reject('bar'));
				potok.enter(when.reject('foobar'));
				potok.end();
				return potok.failOnReject().then(function(result){
					throw new Error('Unwated success.');
				}, function(error){
					error.should.satisfy(function(e){
						return e === 'bar' || e === 'foobar';
					});
				});
			});
		});
		
		describe('.onlyFulfilled()', function(){
			it('returns promise', function(){
				var potok = Potok({});
				return when.isPromiseLike(potok.onlyFulfilled()).should.be.true;
			});
			
			it('returns promise resolving to array of results of all tasks '+ 
					'that fulfilled', function(){
				var potok = Potok({});
				potok.enter('foo');
				potok.enter(when('bar'));
				potok.enter(when.reject('foobar'));
				potok.end();
				return potok.onlyFulfilled().then(function(result){
					result.sort().should.be.deep.equal([
						'bar',
						'foo'
					]);
				});
			});
			
			it('if no tasks where fullfiled, resolves to empty array', function(){
				var potok = Potok({});
				potok.enter(when.reject('foo'));
				potok.enter(when.reject('bar'));
				potok.end();
				return potok.onlyFulfilled().then(function(result){
					result.should.be.deep.equal([]);
				});
			});
		});
		
		describe('.onlyRejected()', function(){
			it('returns promise', function(){
				var potok = Potok({});
				return when.isPromiseLike(potok.onlyRejected()).should.be.true;
			});
			
			it('returns promise resolving to array of results of all tasks '+ 
					'that fulfilled', function(){
				var potok = Potok({});
				potok.enter('foo');
				potok.enter(when('bar'));
				potok.enter(when.reject('foobar'));
				potok.enter(when.reject('spam'));
				potok.end();
				return potok.onlyRejected().then(function(result){
					result.sort().should.be.deep.equal([
						'foobar',
						'spam',
					]);
				});
			});
			
			it('if no tasks where rejected, resolves to empty array', function(){
				var potok = Potok({});
				potok.enter('foo');
				potok.enter('bar');
				potok.end();
				return potok.onlyRejected().then(function(result){
					result.should.be.deep.equal([]);
				});
			});
		});
	});
});