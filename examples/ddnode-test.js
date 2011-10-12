var ddnode = require('./ddnode.js');

var d = new ddnode({
	hello : function (what, cb) {
		return cb("hello " + what);
	}
});

setInterval(function () {
	if (d.mergedClientBlock.hello) {
		d.mergedClientBlock.hello('there', function (value, client) {
			console.log(client.node.id, "- responded: " , value);
		});
	}
}, 1000);