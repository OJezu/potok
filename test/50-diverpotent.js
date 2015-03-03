'use strict';
/* jshint mocha:true */
/* jshint -W030 */ // "Expected an assignment or function call and instead saw an expression." chai causes those

var when = require('when');
require('chai').should();

var Potok = require('../potok.js');

describe('Potok when diverpotent', function(){
	it('accepts diverpotent option', function(){
		new Potok({}, {diverpotent: true});
	});
	it('calls handlers on each passed promise', function(done){
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
		var mp = Potok({each: each}, {diverpotent: true});
		mp.enter('foo');
		mp.enter(when('bar'));
		mp.enter(when('foobar'));
		mp.enter(when.reject('rejected!'));
	});
	describe('.ended()', function(){
		it('does not return results from potok', function(){
			var p = new Potok({}, {diverpotent: true});
			p.enter('foo');
			p.enter('foobar');
			p.enter(when.reject('bar'));
			p.end();
			return when.all(p.ended()).then(function(results){
				results.should.be.deep.equal([]);
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
	});
	describe('.lazyEnd()', function(){
		it('allows adding tasks with ».enter()« until all already added ones are resolved', function(){
			var called = 0;
			var mp = new Potok({
				each: function(entry){
					return when(entry).then(function(entry){
						called++;
						if(entry > 0){
							mp.enter(--entry);
							return entry+1;
						} else {
							return entry;
						}
					});
				}
			}, {diverpotent: true});
			mp.enter(9);
			mp.lazyEnd();
			
			return when.all(mp.ended()).then(function(result){
				result.should.be.deep.equal([]);
				called.should.be.equal(10);
			});
		});
	});
	describe('.chain()', function(){
		it('propagates only entries that happened after the call to .chain()', function(){
			var mp_a = Potok({}, {diverpotent: true});
			var mp_b = Potok({});
			mp_a.enter('foobar');
			mp_a.chain(mp_b);
			mp_a.enter('bar');
			mp_a.enter('foo');
			mp_a.end();
			
			return when.all(mp_b.ended()).then(function(result){
				result.sort().should.be.deep.equal(['bar', 'foo']);
			});
		});
		it('propagates end even if it happend before the call to .chain()', function(){
			var mp_a = Potok({}, {diverpotent: true});
			var mp_b = Potok({});
			mp_a.end();
			mp_a.chain(mp_b);
			
			return when.all(mp_b.ended());
		});
	});
});