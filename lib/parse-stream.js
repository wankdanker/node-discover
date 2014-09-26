var  through = require('through');

module.exports = parse;

function parse() {
	return through(function (data) {
		var s;

		try {
			s = JSON.parse(data);
		}
		catch (e) {
			return //oh well
		}

		s.rinfo = data.rinfo;

		this.queue(s);
	});
}
