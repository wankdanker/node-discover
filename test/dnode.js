var Discover = require('../lib/discover.js'),
	dnode = require('dnode');

var c = new Discover({ mastersRequired : 1 });

var server = null, remote

c.on("promotion", function () {
	console.log("promotion");
	
	if (server) {
		console.log("promotion: ending server");
		server.end();
		server = null;
	}
	
	if (remote) {
		console.log("promotion: ending remote");
		remote.end();
		remote = null;
	}
	
	dnode(function (client, conn) {
		server = conn
		
		this.zing = function (n, cb) {
			console.log("remote client asked for zing of " + n);
			
			cb(n*100);
		};
		
	}).listen(5555);

	c.advertise({
		dnode : {
			port : 5555
		}
	});

});

c.on("demotion", function () {
	if (server) {
		server.end();
		server = null;
	}
	
	c.advertise(null);
});

c.on("added", function (obj) { });

c.on("removed", function (obj) { });

c.on("master", function (obj) {
	console.log("new master");

	if (obj.advertisement.dnode) {
		
		console.log("new master advertising dnode");
		
		if (server) {
			console.log("master change: ending server");
			server.end();
			server = null;
		}
		
		if (remote) {
			console.log("master change: ending remote");
			remote.end();
			remote = null;
		}
		
		dnode.connect(obj.advertisement.dnode.port, function (rem, conn) {
			remote = conn;
			
			rem.zing( 66, function (n) {
				console.log("n=" + n);
			});
			
			conn.on("end", function () {
				conn.end();
				remote = null;
			});
		});
	}
	else {
		console.log("new master NOT advertising dnode");
	}
});

