'use strict';
/* jshint mocha:true */
/* jshint -W030 */ // "Expected an assignment or function call and instead saw an expression." chai causes those

var when = require('when');
require('chai').should();

var Potok = require('../potok.js');

describe('Potok', function(){
	describe('.prototype', function(){
		describe('.branch(potok)', function(){
			it('returns original potok', function(){
				var potok = Potok({});
				var potok_b = Potok({});
				potok.branch(potok_b).should.be.equal(potok);
			});
			
			it('passes tasks to branch', function(done){
				var nv = {'foo': when('foo'), 'bar': when.reject('bar')};
				var potok = Potok({});
				var potok_b = Potok({each:function(promise){
					return promise
						.otherwise(function(error){return error;})
						.then(function(i){
							delete nv[i];
						});
				}});
				
				potok_b.ended().then(function(){
					Object.keys(nv).length.should.be.equal(0);
				}).yield().done(done, done);
				
				for(var key in nv){
					potok.enter(nv[key]);
				}
				potok.end();
				potok.branch(potok_b).should.be.equal(potok);
			});
		});
	});
});