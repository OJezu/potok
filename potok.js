'use strict';
var Potok = require('./src/Potok.js');
require('./src/decorators/pipe.js')(Potok);
require('./src/decorators/filters.js')(Potok);
require('./src/decorators/branch.js')(Potok);
require('./src/decorators/combine.js')(Potok);

module.exports = Potok;