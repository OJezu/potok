'use strict';
var util = require('util');

function PotokError(){
	this.message = arguments[0];
	Error.captureStackTrace(this, this.constructor);
}
util.inherits(PotokError, Error);

function WriteAfterEnd(){
	this.message = 'Write after end.';
	Error.captureStackTrace(this, this.constructor);
}
util.inherits(WriteAfterEnd, PotokError);

function PotokFatalError(message){
	this.message = message;
	Error.captureStackTrace(this, this.constructor);
}
util.inherits(PotokFatalError, PotokError);

module.exports = {
	PotokError: PotokError,
	PotokFatalError: PotokFatalError,
	WriteAfterEnd: WriteAfterEnd,
};