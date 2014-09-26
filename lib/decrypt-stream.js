var crypto = require('crypto')
	, through = require('through')
	;

module.exports = encrypt;

function encrypt(key, cipher) {
	var cipher = cipher || 'aes256';
	
	return through(function (data) {
		var c = crypto.createDecipher(cipher, key);
		
		var buf = Buffer.concat([
			c.update(data)
			, c.final()
		]);

		this.queue(buf);
	});
}
