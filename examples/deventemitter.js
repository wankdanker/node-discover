/*
 * 
 * ## Distributed Event Emitter
 * 
 * ### TODO
 * 
 * Filter events in the master so that we don't waste time/bandwidth passing messages
 * to nodes who do not have a listener for that event
 * 
 * ### Constructor
 * 
 * new dEventEmitter({
 * 	broadcastPort : port on which the Discover module should broadcast; Default: 5554
 * 	address : address to bind the dnode server; Default: '0.0.0.0'
 * 	port : port to bind the dnode server; Default: 5555
 * 	delimiter : EventEmitter2 delimiter; Default: '::'
 * 	wildcard : EventEmitter2 use wildcards; Default: true
 * 	key : Key to use for encrypting Discover hello packets; Default: "dEventEmitter"
 * });
 * 
 * ### Events
 * 
 * self::promoted
 * self::demoted
 * node::added
 * node::removed
 * connection::ready
 * connection::end
 * 
 * ### Methods
 * 
 * emit(event, data)
 * 	emit an event and data to all nodes in the cluster
 * 
 * emitLocal(event, data)
 * 	emit an event and data to only the local node
 * 
 * See other EventEmitter2 methods
 */

var Discover = require('../lib/discover.js'),
	dnode = require('dnode'),
	EventEmitter = require('eventemitter2').EventEmitter2,
	util = require('util');

var dEventEmitter = module.exports = function (options) {
	//declare locals
	var self = this, options = options || {}
	
	//This array will contain references to all remote dnode clients and connections
	self.remotes = [];
	
	//Set some defaults
	options.broadcastPort 	= options.broadcastPort || 5554
	options.address 	= options.address 	|| '0.0.0.0';
	options.port 		= options.port 		|| 5555;
	options.delimiter 	= options.delimiter 	|| "::";
	options.wildcard 	= options.wildcard 	|| true;
	options.key		= options.key		|| "dEventEmitter";
	
	//Call the EventEmitter2 constructor
	EventEmitter.call(this, { 
		delimiter	: options.delimiter, 
		wildcard	: options.wildcard 
	});
	
	//Start the Discover module
	var disc = new Discover({ 
		mastersRequired : 1,
		port 		: options.broadcastPort,
		key 		: options.key
	});
	
	//Define what to do when this process becomes the master for the cluster
	disc.on("promotion", function () {
		//end all remote connections
		self.remotes.forEach(function (client) {
			client.connection.end();
		});
		
		//define the dnode stuff
		dnode(function (client, conn) {
			//add this new client to our array of remotes
			self.remotes.push({
				client : client,
				connection : conn
			});
			
			//declare the message method available to the remote client
			this.message = function (event, data, cb) {
				self.remotes.forEach(function (c) {
					if (c.client != client) {
						//pass this message along to all other remotes
						//except itself
						c.client.message(event, data);
					}
				});
				
				//emit the event locally
				self.emitLocal(event, data);
			};
			
		}).listen(options.address, options.port);
		
		//Advertise that we are a dnode server using Discover
		disc.advertise({
			dnode : {
				port : options.port
			}
		});
		
		self.emitLocal("self" + options.delimiter + "promoted");
	});
	
	disc.on("demotion", function () {
		self.remotes.forEach(function (client) {
			//end each client connection
			client.connection.end();
		});
		
		//stop advertising the dnode server
		disc.advertise(null);
		
		self.emitLocal("self" + options.delimiter + "demoted");
	});
	
	disc.on("added", function (node) { 
		self.emitLocal("node" + options.delimiter + "added", node);
	});
	
	disc.on("removed", function (node) {
		self.emitLocal("node" + options.delimiter + "removed", node);
	});
	
	disc.on("master", function (node) {
		//a new master has been discovered
		
		//end all remote connections
		self.remotes.forEach(function (client) {
			client.connection.end();
		});
		
		//define the client dnode block
		var client = dnode({
			message : function (event, data, cb) {
				self.emitLocal(event, data);
			}
		});
		
		//connect to the master
		client.connect(node.address, node.advertisement.dnode.port, function (server, conn) {
			var objConnection = {
				client : server,
				connection : conn
			};
			
			self.remotes.push(objConnection);
			
			conn.on("end", function () {
				conn.end();
				delete self.remotes[self.remotes.indexOf(objConnection)];
				
				self.emitLocal("connection" + options.delimiter + "end");
			});
			
			self.emitLocal("connection" + options.delimiter + "ready");
		});
	});
};

util.inherits(dEventEmitter, EventEmitter);

dEventEmitter.prototype.emit = function (event, data, callback) {
	var self = this;
	
	//catch reserved newListenr event
	if (event === 'newListener') {
		return EventEmitter.prototype.emit.apply(this, arguments);
	}
	
	self.remotes.forEach(function (client) {
		client.client.message(event, data);
	});
	
	//emit the event locally.
	return EventEmitter.prototype.emit.apply(this, [event, data, callback]);
};

dEventEmitter.prototype.emitLocal = function (event, data, callback) {
	var self = this;
	
	//catch reserved newListenr event
	if (event === 'newListener') {
		return EventEmitter.prototype.emit.apply(this, arguments);
	}

	//emit the event locally.
	return EventEmitter.prototype.emit.apply(this, [event, data, callback]);
};
