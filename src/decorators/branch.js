'use strict';

function decorateWithBranch(Potok){
	Potok.prototype.branch = function(next){
		this.chain(next);
		return this;
	};
};

module.exports = decorateWithBranch;