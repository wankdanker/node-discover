/*
 * 
 * Node Discover
 * 
 * Attributes
 *   Nodes
 * 
 * Methods
 *   Promote
 *   Demote
 *   Join
 *   Leave
 *   Advertise
 *   Start
 *   Stop
 *   EachNode(fn)
 * 
 * Events
 *   Promotion
 *   Demotion
 *   Added
 *   Removed
 *   Master
 * 
 * 
 * checkInterval should be greater than hello interval or you're just wasting cpu
 * nodeTimeout must be greater than checkInterval
 * masterTimeout must be greater than nodeTimeout
 * 
 */

var Broadcast = require('./broadcast.js');

var Discover = module.exports = function(options) {
	var self = this, options = options || {};
	
	var settings = self.settings = {
		helloInterval	: options.helloInterval	|| 1000,
		checkInterval	: options.checkInterval	|| 2000,
		nodeTimeout	: options.nodeTimeout	|| 2000,
		masterTimeout	: options.masterTimeout	|| 2000,
		address		: options.address	|| '0.0.0.0',
		port		: options.port		|| 12345,
		destination	: options.destination	|| '255.255.255.255',
		key		: options.key		|| null
	};
	
	if (!(settings.nodeTimeout >= settings.checkInterval)) {
		throw new Error("nodeTimeout must be greater than or equal to checkInterval.");
	}
	
	if (!(settings.masterTimeout >= settings.nodeTimeout)) {
		throw new Error("masterTimeout must be greater than or equal to nodeTimeout.");
	}
	
	self.broadcast = new Broadcast({
		address 	: settings.address,
		port 		: settings.port,
		destination 	: settings.destination,
		key 		: settings.key
	});

	self.me = {
		isMaster : false,
		isMasterEligible : true
	};
	
	self.nodes = {};
	
	self.broadcast.on("hello", function (data, obj, rinfo) {
		data.lastSeen = +new Date();
		data.address = rinfo.address;
		data.port = rinfo.port;
		data.id = obj.pid;
		
		var isNew = !self.nodes[obj.pid]
		
		self.nodes[obj.pid] = data;
		
		if (isNew) {
			//new node found
			
			self.emit("added", data, obj, rinfo)
		}
		
		if (data.isMaster) {
			//if we have this node and it was not previously a master then it is a new master node
			if (!(!isNew && self.nodes[obj.pid].isMaster)) {
				//this is a new master
				
				if (self.me.isMaster) {
					self.demote();
				}
				
				self.emit("master", data, obj, rinfo);
			}
			
		}
	});
	
	var checkId, helloId;
	
	self.start = function () {
		checkId = setInterval(function () {
			var node = null, foundMaster = false;
			
			for (var processUuid in self.nodes) {
				node = self.nodes[processUuid];
				
				if ( +new Date() - node.lastSeen > settings.nodeTimeout ) {
					//we haven't seen the node recently
					
					//Become master 
					if ( node.isMaster && +new Date() - node.lastSeen > settings.masterTimeout && self.me.isMasterEligible) {
						//master is lost, become the master
						self.promote();
					}
					
					//delete the node from our nodes list
					delete self.nodes[processUuid]
					
					self.emit("removed", node);
				}
				else if (node.isMaster) {
					foundMaster = true;
				}
			}
			
			if (!self.me.isMaster && !foundMaster && self.me.isMasterEligible) {
				//no masters found out of all our nodes, become one.
				self.promote();
			}
		}, settings.checkInterval);
		
		//send hello every helloInterval
		helloId = setInterval(function () {
			self.broadcast.send("hello", self.me)
		}, settings.helloInterval);
	};
	
	self.stop = function () {
		clearInterval(checkId);
		clearInterval(helloId);
	};
	
	self.start();
};

Discover.prototype = new process.EventEmitter();

Discover.prototype.promote = function () {
	var self = this;
	
	self.me.isMasterEligible = true;
	self.me.isMaster = true;
	self.hello();
	self.emit("promotion", true);
};

Discover.prototype.demote = function (permanent) {
	var self = this;
	
	self.me.isMasterEligible = !permanent;
	self.me.isMaster = false;
	self.hello();
	self.emit("demotion", true);
};

Discover.prototype.hello = function () {
	var self = this;
	
	self.broadcast.send("hello", self.me);
};

Discover.prototype.advertise = function (obj) {
	var self = this;
	
	self.me.advertisement = obj;
};

Discover.prototype.eachNode = function (fn) {
	var self = this;
	
	for ( var uuid in self.nodes ) {
		fn(self.nodes[uuid]);
	}
};

