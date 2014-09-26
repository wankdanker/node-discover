var  through = require('through');

module.exports = stringify;

function stringify() {
	return through(function (data) {
		this.queue(JSON.stringify(data));
	});
}
