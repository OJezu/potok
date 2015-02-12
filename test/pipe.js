'use strict';
/* jshint mocha:true */
/* jshint -W030 */ // "Expected an assignment or function call and instead saw an expression." chai causes those
var chai = require('chai');
chai.should();
var through = require('through2');

var when = require('when');

var Potok = require('../src/Potok.js');

describe('Potok', function(){
	describe('.prototype', function(){
		describe('.pipe', function(){
			it('sends through fulfilled promises to piped stream', function(done){
				var items = ['foo', 'bar', 'foobar'];
				var stream = through.obj(function(chunk, enc, cb){
					items = items.filter(function(item){return chunk !== item;});
					if(items.length === 0){
						done();
					}
					cb();
				});
				
				var potok = Potok({});
				potok.pipe(stream);
				items.forEach(potok.enter, potok);
			});
			
			it('sends through rejected promises to piped stream as errors', function(done){
				var items = ['foo', 'bar', 'foobar'];
				var stream = through.obj(function(chunk, enc, cb){cb();});
				stream.on('error', function(chunk){
					items = items.filter(function(item){return chunk !== item;});
					if(items.length === 0){
						done();
					}
				});
				
				var potok = Potok({});
				potok.pipe(stream);
				items.map(when.reject).forEach(potok.enter, potok);
			});
			
			it('propagates end', function(done){
				var items = ['foo', 'bar', 'foobar'];
				var stream = through.obj(function(chunk, enc, cb){cb();});
				
				var potok = Potok({});
				potok.pipe(stream);
				stream.on('end', done);
				stream.on('error', done);
				
				items.forEach(potok.enter, potok);
				potok.end();
				stream.resume();
			});
		});
	});
});