'use strict';
var when = require('when');
var Stream = require('stream');
var Errors = require('./errors.js');

function decorateStream(Stream, method_name){
	if(Stream === undefined){
		Stream = require('stream');
	}
	if(method_name === undefined){
		method_name = 'chain';
	}
	
	Stream.prototype[method_name] = function(potok) {
		if(!this._readableState.objectMode){
			throw new Errors.PotokError('.chain() can only be used with streams in object mode');
		}
		var source = this;
	
		function ondata(chunk) {
			potok.enter(chunk);
		}
		
		source.on('data', ondata);
		
		function onend() {
			potok.end();
		}
		source.once('end', onend);
		source.once('close', onend);
		
		function onerror(er) {
			potok.enter(when.reject(er));
		}
		source.on('error', onerror);
	
		// remove all the event listeners that were added.
		function cleanup() {
			source.removeListener('data', ondata);
			source.removeListener('error', onerror);
		}
	
		source.once('end', cleanup);
		source.once('close', cleanup);
		
		return potok;
	};
}

module.exports = decorateStream;
