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

var Network = require('./network.js'),
	leadership = require("./leadership.js"),
	EventEmitter = require('events').EventEmitter,
	util = require('util');

var reservedEvents = ['promotion', 'demotion', 'added', 'removed', 'master', 'hello'];

module.exports = Discover;

/*
 * This is the default automatically assigned weight function in the case that
 * you do not specify a weight, this function will be called. You can override
 * this function if you want to change the default behavior.
 *
 * Example:
 *
 * ```js
 * var Discover = require('discover');
 * Discover.weight = function () {
 * 	return Math.random();
 * }
 *
 * var d = new Discover();
 * ```
 */
Discover.weight = function () {
	//default to negative, decimal now value
	return -(Date.now() / Math.pow(10,String(Date.now()).length));
};

//expose the leadership election types
Discover.BasicLeadershipElection = leadership.BasicLeadershipElection;
Discover.NoLeadershipElection = leadership.NoLeadershipElection;

/**
 * Callback for when the Discover instance has started up.
 *
 * @callback readyCallback
 * @param {Object} [error] - if an error occured during setup, then this will be an error object with information about the error
 * @param {boolean} success - whether or not everything is good to go
 */

/**
 * Create an instance of a node-discover
 * 
 * @param {Object} options
 * @param {number} [options.helloInterval=1000] - How often to broadcast a hello packet in milliseconds
 * @param {number} [options.checkInterval=2000] - How often to to check for missing nodes in milliseconds
 * @param {number} [options.nodeTimeout=2000] - Consider a node dead if not seen in this many milliseconds
 * @param {number} [options.masterTimeout=2000] - Consider a master node dead if not seen in this many milliseconds
 * @param {string} [options.address='0.0.0.0'] - Address to bind to
 * @param {number} [options.port=12345] - Port on which to bind and communicate with other node-discover processes
 * @param {string} [options.broadcast='255.255.255.255'] - Broadcast address if using broadcast
 * @param {string} [options.multicast] - Multicast address if using multicast. If net set, broadcast or unicast is used.
 * @param {number} [options.mulitcastTTL=1] - Multicast TTL for when using multicast
 * @param {string|string[]} [options.unicast] - Comma separated String or String Array of Unicast addresses of known nodes
 *        It is advised to specify the address of the local interface when using unicast and expecting local discovery to work
 * @param {string} [options.key] - Encryption key if your broadcast packets should be encrypted
 * @param {number} [options.mastersRequired] - The count of master processes that should always be available
 * @param {number} [options.weight=Discover.weight()] - A number used to determine the preference for a specific process to become master. Higher numbers win.
 * @param {boolean} [options.client=false] - When true operate in client only mode (don't broadcast existence of node, just listen and discover)
 * @param {boolean} [options.reuseAddr=true] - Allow multiple processes on the same host to bind to the same address and port.
 * @param {string} [options.ignoreProcess=true] - If set to false, will not ignore messages from other Discover instances within the same process (on non-reserved channels), join() will receive them.
 * @param {boolean} [options.ignoreInstance=true] - If set to false, will not ignore messages from self (on non-reserved channels), join() will receive them.
 * @param {*} [options.advertisement] - The initial advertisement which is sent with each hello packet.
 * @param {string} [options.hostname=os.hostname()] - Override the OS hostname with a custom value.
 *        may also use use DISCOVERY_HOSTNAME environment variable
 * 
 * @param {Function} [readyCallback] - a function which is called when discovery services have started
 * @returns
 */
function Discover (options, callback) {
	if (!(this instanceof Discover)) {
		return new Discover(options, callback);
	}

	EventEmitter.call(this);

	if (typeof options === 'function') {
		callback = options;
		options = null;
	}

	var self = this, checkId, helloId, running = false, options = options || {}

	var settings = self.settings = {
		helloInterval	: options.helloInterval		|| 1000,
		checkInterval	: options.checkInterval		|| 2000,
		nodeTimeout		: options.nodeTimeout		|| 2000,
		masterTimeout	: options.masterTimeout		|| options.nodeTimeout || 2000,
		address			: options.address			|| '0.0.0.0',
		port			: options.port				|| 12345,
		broadcast		: options.broadcast 		|| null,
		multicast		: options.multicast 		|| null,
		multicastTTL 	: options.multicastTTL 		|| null,
		unicast			: options.unicast		|| null,
		key				: options.key				|| null,
		mastersRequired	: options.mastersRequired	|| 1,
		leadershipElector: options.leadershipElector || null,
		weight			: options.weight			|| Discover.weight(),
		client			: options.client			|| (!options.client && !options.server),
		server			: options.server			|| (!options.client && !options.server),
		reuseAddr		: options.reuseAddr, 		//default is set at the network layer (true)
		exclusive		: options.exclusive || false,
		ignoreProcess   : (options.ignoreProcess ===  false) ? false : true,
		ignoreInstance  : (options.ignoreInstance ===  false) ? false : true,
		start           : (options.start === false) ? false : true,
		hostname        : options.hostname || options.hostName || null
	};

	//resolve the leadershipElector
	self.leadershipElector = leadership(self.leadershipElector, self);

	//this is for backwards compatibilty with v0.1.0
	//TODO: should be removed in the next major release
	if (options.ignore === false) {
		settings.ignoreProcess = false;
		settings.ignoreInstance = false;
	}

	if (!(settings.nodeTimeout >= settings.checkInterval)) {
		throw new Error("nodeTimeout must be greater than or equal to checkInterval.");
	}

	if (!(settings.masterTimeout >= settings.nodeTimeout)) {
		throw new Error("masterTimeout must be greater than or equal to nodeTimeout.");
	}

	self.broadcast = new Network({
		address 	: settings.address,
		port 		: settings.port,
		broadcast 	: settings.broadcast,
		multicast	: settings.multicast,
		multicastTTL: settings.multicastTTL,
		unicast		: settings.unicast,
		key 		: settings.key,
		exclusive 		: settings.exclusive,
		reuseAddr	: settings.reuseAddr,
		ignoreProcess  : settings.ignoreProcess,
		ignoreInstance  : settings.ignoreInstance,
		hostname : settings.hostname
	});

	//This is the object that gets broadcast with each hello packet.
	self.me = {
		isMaster 	: false,
		isMasterEligible: self.settings.server, //Only master eligible by default if we are a server
		weight 		: settings.weight,
		address 	: '127.0.0.1', //TODO: get the real local address?
		advertisement	: options.advertisement
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
	self.evaluateHello = function (data, obj, rinfo) {
		//prevent processing hello message from self
		if (obj.iid === self.broadcast.instanceUuid) {
			return;
		}

		data.lastSeen = +new Date();
		data.address = rinfo.address;
		data.hostName = obj.hostName;
		data.port = rinfo.port;
		data.id = obj.iid;
		var isNew = !self.nodes[obj.iid];
		var wasMaster = null;

		if (!isNew) {
			wasMaster = !!self.nodes[obj.iid].isMaster;
		}

		var node = self.nodes[obj.iid] = self.nodes[obj.iid] || {};

		Object.getOwnPropertyNames(data).forEach(function (key) {
			node[key] = data[key];
		});

		if (isNew) {
			//new node found

			self.emit("added", node, obj, rinfo);
		}

		if (node.isMaster) {
			//if we have this node and it was not previously a master then it is a new master node
			if ((isNew || !wasMaster )) {
				//this is a new master

				self.emit("master", node, obj, rinfo);
			}
		}

		self.emit("helloReceived", node, obj, rinfo, isNew, wasMaster);
	};

	self.broadcast.on("hello", self.evaluateHello);

	self.broadcast.on("error", function (error) {
		self.emit("error", error);
	});

	self.check = function () {
		var node = null;
		for (var processUuid in self.nodes) {
			if (!self.nodes.hasOwnProperty(processUuid)) {
				continue;
			}
			node = self.nodes[processUuid];

			if ( +new Date() - node.lastSeen > (node.isMaster ? settings.masterTimeout : settings.nodeTimeout) ) {
				//we haven't seen the node recently
				//delete the node from our nodes list
				delete self.nodes[processUuid];
				self.emit("removed", node);
			}
		}
		
		self.emit('check');
	};

	self.start = function (callback) {
		if (running) {
			callback && callback(null, false);

			return false;
		}
		
		self.broadcast.start(function (err) {
			if (err) {
				return callback && callback(err, false);
			}

			running = true;

			checkId = setInterval(self.check, checkInterval());

			if (self.settings.server) {
				//send hello every helloInterval
				helloId = setInterval(function () {
					self.hello();
				}, helloInterval());
				self.hello();
			}

			self.emit('started', self);

			return callback && callback(null, true);
		});
	};

	self.stop = function () {
		if (!running) {
			return false;
		}

		self.broadcast.stop();

		clearInterval(checkId);
		clearInterval(helloId);

		self.emit('stopped', self);

		running = false;
	};

	//check if auto start is enabled
	if (self.settings.start) {
		self.start(callback);
	}

	function helloInterval () {
		if (typeof settings.helloInterval === 'function') {
			return settings.helloInterval.call(self);
		}
		//else
		return settings.helloInterval;
	}

	function checkInterval () {
		if (typeof settings.checkInterval === 'function') {
			return settings.checkInterval.call(self);
		}
		//else
		return settings.checkInterval;
	}
};

util.inherits(Discover, EventEmitter);

Discover.prototype.promote = function () {
	var self = this;

	self.me.isMasterEligible = true;
	self.me.isMaster = true;
	self.emit("promotion", self.me);
	self.hello();
};

Discover.prototype.demote = function (permanent) {
	var self = this;

	self.me.isMasterEligible = !permanent;
	self.me.isMaster = false;
	self.emit("demotion", self.me);
	self.hello();
};

Discover.prototype.master = function (node) {
	var self = this;

	self.emit('master', node)
}

Discover.prototype.hello = function () {
	var self = this;

	self.broadcast.send("hello", self.me);
	self.emit("helloEmitted");
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

	self.broadcast.on(channel, function (data, obj, rinfo) {
		self.emit(channel, data, obj, rinfo);
	});

	self.channels.push(channel);

	return true;
};

Discover.prototype.leave = function (channel) {
	var self = this;

	self.broadcast.removeAllListeners(channel);

	delete self.channels[self.channels.indexOf(channel)];

	return true;
};

Discover.prototype.send = function (channel, obj) {
	var self = this;

	if (~reservedEvents.indexOf(channel)) {
		return false;
	}

	self.broadcast.send(channel, obj);

	return true;
};
