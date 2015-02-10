'use strict';

var when = require('when');

function decorateWithFilters(Potok){
	Potok.prototype.failOnReject = function failOnReject(){
		return when.all(this.ended());
	};
	Potok.prototype.all = Potok.prototype.failOnReject;

	Potok.prototype.onlyFulfilled = function onlyFulfilled(){
		return when.settle(this.ended()).then(function(promises){
			return promises.filter(function(promise){
				return promise.state === 'fulfilled';
			}).map(function(promise){
				return promise.value;
			});
		});
	};
	Potok.prototype.some = Potok.prototype.onlyFullfiled;

	Potok.prototype.onlyRejected = function onlyRejected(){
		return when.settle(this.ended()).then(function(promises){
			return promises.filter(function(promise){
				return promise.state === 'rejected';
			}).map(function(promise){
				return promise.reason;
			});
		});
	};
	Potok.prototype.distil = Potok.prototype.onlyRejected;
};

module.exports = decorateWithFilters;