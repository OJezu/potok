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

module.exports = {
	PotokError: PotokError,
	WriteAfterEnd: WriteAfterEnd,
};