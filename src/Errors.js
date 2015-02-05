'use strict';
var util = require('util');

function MultiPromiseError(){
	this.message = arguments[0];
	Error.captureStackTrace(this, this.constructor);
}
util.inherits(MultiPromiseError, Error);

function WriteAfterEnd(){
	this.message = 'Write after end.';
	Error.captureStackTrace(this, this.constructor);
}
util.inherits(WriteAfterEnd, MultiPromiseError);

module.exports = {
	MultiPromiseError: MultiPromiseError,
	WriteAfterEnd: WriteAfterEnd,
};