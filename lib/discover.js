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
 *   Send
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

var reservedEvents = ['promotion', 'demotion', 'added', 'removed', 'master', 'hello'];

var Discover = module.exports = function(options) {
	var self = this, checkId, helloId, running = false, options = options || {}
	
	var settings = self.settings = {
		helloInterval	: options.helloInterval		|| 1000,
		checkInterval	: options.checkInterval		|| 2000,
		nodeTimeout	: options.nodeTimeout		|| 2000,
		masterTimeout	: options.masterTimeout		|| 2000,
		address		: options.address		|| '0.0.0.0',
		port		: options.port			|| 12345,
		destination	: options.destination		|| '255.255.255.255',
		key		: options.key			|| null,
		mastersRequired	: options.mastersRequired	|| 1
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
	self.channels = [];
	
	/*
	 * When receiving hello messages we need things to happen in the following order:
	 * 	- make sure the node is in the node list
	 * 	- if hello is from new node, emit added
	 * 	- if hello is from new master and we are master, demote
	 * 	- if hello is from new master emit master
	 * 
	 * need to be careful not to over-write the old node object before we have information
	 * about the old instance to determine if node was previously a master.
	 */
	self.broadcast.on("hello", function (data, obj, rinfo) {
		data.lastSeen = +new Date();
		data.address = rinfo.address;
		data.port = rinfo.port;
		data.id = obj.pid;
		
		var isNew = !self.nodes[obj.pid]
		var wasMaster = null;
		
		if (!isNew) {
			wasMaster = !!self.nodes[obj.pid].isMaster;
		}
		
		self.nodes[obj.pid] = data;
		
		if (isNew) {
			//new node found
			
			self.emit("added", data, obj, rinfo)
		}
		
		if (data.isMaster) {
			//if we have this node and it was not previously a master then it is a new master node
			if ((isNew || !wasMaster )) {
				//this is a new master
				
				//count up how many masters we have now
				var masterCount = 0;
				for (var uuid in self.nodes) {
					if (self.nodes[uuid].isMaster) {
						masterCount++;
					}
				}
				
				if (self.me.isMaster && masterCount > settings.mastersRequired) {
					self.demote();
				}
				
				self.emit("master", data, obj, rinfo);
			}
		}
	});
	
	self.start = function () {
		if (running) {
			return false;
		}
		
		running = true;
		
		checkId = setInterval(function () {
			var node = null, mastersFound = 0;
			
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
					mastersFound++
				}
			}
			
			if (!self.me.isMaster && mastersFound < settings.mastersRequired && self.me.isMasterEligible) {
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
		if (!running) {
			return false;
		}
		
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
	self.emit("promotion", self.me);
};

Discover.prototype.demote = function (permanent) {
	var self = this;
	
	self.me.isMasterEligible = !permanent;
	self.me.isMaster = false;
	self.hello();
	self.emit("demotion", self.me);
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

Discover.prototype.join = function (channel, fn) {
	var self = this;
	
	if (~reservedEvents.indexOf(channel)) {
		return false;
	}
	
	if (~self.channels.indexOf(channel)) {
		return false;
	}
	
	if (fn) {
		self.on(channel, fn);
	}
	
	
	self.broadcast.on(channel, function (obj) {
		self.emit(channel, obj);
	});
	
	self.channels.push(channel);
	
	return true;
}

Discover.prototype.leave = function (channel) {
	var self = this;
	
	self.broadcast.removeAllListeners(channel);
	
	delete self.channels[self.channels.indexOf(channel)];
	
	return true;
}

Discover.prototype.send = function (channel, obj) {
	var self = this;
	
	if (~reservedEvents.indexOf(channel)) {
		return false;
	}
	
	self.broadcast.send(channel, obj);
	
	return true;
}