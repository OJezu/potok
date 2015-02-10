'use strict';
/* jshint mocha:true */
/* jshint -W030 */ // "Expected an assignment or function call and instead saw an expression." chai causes those

var when = require('when');
require('chai').should();

var Potok = require('../potok.js');

function sortPromises(a, b){
	return (a.value || a.reason || a).localeCompare(b.value || b.reason || b);
}

describe('Potok', function(){
	describe('.combine(potok[])', function(){
		it('ends immediately if there are no potoki to combine', function(){
			var combined = Potok.combine([]);
			return combined.ended();
		});
		
		it('returns a potok', function(){
			var combined = Potok.combine([]);
			combined.end();
			combined.should.be.instanceof(Potok);
		});
		
		it('accepts multiple potoki, not throw and end', function(){
			var combined = Potok.combine([
				Potok({}).end(),
				Potok({}).end(),
				Potok({}).end(),
			]);
			return combined.ended();
		});
		
		it('collects promises from multiple potoki', function(){
			var potok_a = Potok({});
			var potok_b = Potok({});
			var potok_c = Potok({});
			
			potok_a.enter('foo');
			potok_b.enter(when.reject('bar'));
			potok_c.enter(when('foobar'));
			potok_c.enter(when.reject('spam'));
			potok_a.end();
			potok_b.end();
			potok_c.end();
			
			var combined = Potok.combine([potok_a, potok_b, potok_c]);
			return when.settle(combined.ended()).then(function(result){
				result.sort(sortPromises).should.be.deep.equal([
					{state: 'rejected',  reason: 'bar'},
					{state: 'fulfilled', value:  'foo'},
					{state: 'fulfilled', value:  'foobar'},
					{state: 'rejected',  reason: 'spam'},
				]);
			});
		});
		
		it('collects promises from multiple potoki, '+
				'even if one potok is delayed a tad', function(){
			var potok_a = Potok({});
			var potok_b = Potok({});
			var potok_c = Potok({});
			
			potok_a.enter('foo');
			potok_b.enter(when.reject('bar'));
			
			potok_a.end();
			potok_b.end();
			when().delay(2).then(function(){
				potok_c.enter(when('foobar'));
				potok_c.enter(when.reject('spam'));
				return potok_c.end();
			}).done();
			
			var combined = Potok.combine([potok_a, potok_b, potok_c]);
			return when.settle(combined.ended()).then(function(result){
				result.sort(sortPromises).should.be.deep.equal([
					{state: 'rejected',  reason: 'bar'},
					{state: 'fulfilled', value:  'foo'},
					{state: 'fulfilled', value:  'foobar'},
					{state: 'rejected',  reason: 'spam'},
				]);
			});
		});
	});
});