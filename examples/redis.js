var portscanner = require('portscanner'),
  dEventEmitter = require('./deventemitter.js'),
	redis	= require('redis');

var cluster = new dEventEmitter({ 
	  broadcastPort : 5550
	, port 		: 5551
	, key 		: 'something else'
});

var interval = null, hosts = {}, isMaster = false;

var redisPreferredMaster = '192.168.100.17'

cluster.on('self::promoted', function (node) {
	//copy the node that is us; we need to do that otherwise we'll start brodcasting
	//the redisClient attached to our node. DOH!
	var host = hosts[node.address] = {}
	host[node.id] = { address : node.address, id : node.id };
	
	console.log("I am master", node);
	
	isMaster = true;
	
	InitiateServices();
	interval = setInterval(CheckServices, 1000);
});

cluster.on('self::demoted', function (node) {
	console.log("I am demoted", node);
	
	isMaster = false;
	clearInterval(interval);
});

cluster.on('node::added', function (node) {
	var host = hosts[node.address] = hosts[node.address] || {};
	
	host[node.id] = node;
	
	if (isMaster) {
		cluster.emit('redis::preferredMaster', redisPreferredMaster);
		InitiateServices();
	}
});

cluster.on('node::removed', function (node) {
	var host = hosts[node.address] = hosts[node.address] || {};
	
	delete host[node.id];
});

cluster.on('redis::error', function (error) {
	console.log("redis::error ", error);
});


cluster.on('redis::added', function (node) {
	console.log("redis::added ", node.address);
});

cluster.on('redis::removed', function (node) {
	console.log("redis::removed ", node.address);
});

cluster.on('redis::newMaster', function (node) {
	console.log("redis::newMaster ", node.address);
	
	redisPreferredMaster = node;
});

cluster.on('redis::preferredMaster', function (node) {
	redisPreferredMaster = node;
});

function InitiateServices() {
	Object.keys(hosts).forEach(function (hostKey) {
		var host = hosts[hostKey];
		
		Object.keys(host).forEach(function (nodeKey) {
			var node = host[nodeKey];
			
			if (!node.redisClient) {
				//check to see if this node has redis running.
				node.redisClient = redis.createClient(6379, node.address);
				
				node.redisClient.on("ready", function () {
					cluster.emit('redis::added', node);
				});
				
				node.redisClient.on("error", function (error) {
					cluster.emit('redis::error', error);
				});
				
				node.redisClient.on("end", function () {
					cluster.emit('redis::removed', node);
				});
			}
		});
	});
}

function CheckServices() {
	Object.keys(hosts).forEach(function (hostKey) {
		var host = hosts[hostKey];
		
		Object.keys(host).forEach(function (nodeKey) {
			var node = host[nodeKey];
			
			if (node.redisClient) {
				node.redisClient.info(function (err, info) {
					var obj = {};
					
					info.split(/\r\n/gi).forEach(function (line) {
						var pair = line.split(':');
						obj[pair[0]] = pair[1];
					});
					
					console.log(obj.role, " at ", node.address, " via id: ", node.id);
				});
			}
		});
	});
}

var AppConsole = require('appconsole').AppConsole;

var a = new AppConsole();

a.commands.push({
	"" : function () {},
	quit : function () {
		process.exit();
	},
	"help" : a.showCommandHelp
});

