'use strict';
var when = require('when');
var Stream = require('stream');
var Errors = require('./Errors.js');

function decorateStream(Stream){
	Stream.prototype.chain = function(potok) {
		if(!this.objectMode){
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

Stream && decorateStream(Stream);

module.exports = decorateStream;
