'use strict';

function decorateWithCombine(Potok){
	Potok.combine = function combine(potok_array){
		var captain_planet = new Potok({});
		var end_counter = 0;
		Object.defineProperty(captain_planet, 'end', {
			enumerable: false,
			writable: true,
			configurable: true,
			value: function(){
				// post-incrementation ftw
				if( (end_counter++) === potok_array.length ){
					Potok.prototype.end.call(this);
				}
			}
		});
		potok_array.forEach(function(potok){
			potok.chain(captain_planet);
		});
		// always run end, even if nothing was chained
		captain_planet.end();
		return captain_planet;
	};
};

module.exports = decorateWithCombine;