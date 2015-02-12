'use strict';

// http://i.imgur.com/8ClIADV.jpg

function DecorateWithPipe(Potok){
	Potok.prototype.pipe = function(stream){
		var pipe_potok = new Potok({
			each: function(promise){
				promise.done(stream.write.bind(stream), stream.emit.bind(stream, 'error'));
				return null;
			},
			afterAll: function(){
				stream.end();
			}
		});
		this.chain(pipe_potok);
		return stream;
	};
};

module.exports = DecorateWithPipe;