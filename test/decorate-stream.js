'use strict';
/* jshint mocha:true */
/* jshint -W030 */ // "Expected an assignment or function call and instead saw an expression." chai causes those
var fs = require('fs');
var Stream = require('stream');
var chai = require('chai');
chai.should();
var through = require('through2');

var when = require('when');

var Potok = require('../src/Potok.js');
var Errors = require('../src/Errors.js');
require('../decorate-stream.js')();

describe('Stream', function(){
	it('has .chain() method in prototype', function(){
		Stream.prototype.chain.should.be.a('function');
	});
	
	it('exposes .chain() method on various streams', function(){
		var stream = fs.createReadStream(__filename, {flags: 'r'});
		stream.chain.should.be.a('function');
	});
	describe('.chain()', function(){
		it('does not work on streams not in object mode', function(){
			var stream = fs.createReadStream(__filename, {flags: 'r'});
			stream.chain.bind(stream).should.throw(Errors.PotokError);
		});
		
		it('can be called as method of stream in object mode', function(){
			var stream = through.obj(function(chunk, enc, cb){});
			stream.chain(Potok({}));
		});

		it('sends through objects to chained potok', function(done){
			var items = ['foo', 'bar', 'foobar'];
			var stream = through.obj(function(chunk, enc, cb){cb(undefined, chunk);});
			stream.chain(
				Potok({
					each: function(promise){
						return when(promise).then(function(value){
							items = items.filter(function(entry){
								return entry !== value;
							});
							if(items.length === 0){
								done();
							}
						});
					},
				})
			).ended().done(undefined, done);
			
			items.forEach(stream.write, stream);
		});
		
		it('sends through errors to chained potok as rejections', function(done){
			var items = ['foo', 'bar', 'foobar'];
			var stream = through.obj(function(chunk, enc, cb){cb(chunk, undefined);});
			stream.chain(
				Potok({
					each: function(promise){
						return when(promise).catch(function(value){
							items = items.filter(function(entry){
								return entry !== value;
							});
							if(items.length === 0){
								done();
							}
						});
					},
				})
			).ended().done(undefined, done);
			
			items.forEach(stream.write, stream);
		});
		
		it('propagates end', function(){
			var items = ['foo', 'bar', 'foobar'];
			var stream = through.obj(function(chunk, enc, cb){cb(undefined, chunk);});
			items.forEach(stream.write, stream);
			stream.end();
			return stream.chain(Potok({})).ended();
		});
	});
});