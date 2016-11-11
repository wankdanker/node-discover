/*
 * This is the most basic example of using Discover.
 * 
 * In this example all we are interested in is when new nodes are added to the
 * network or when they are removed. The master selection stuff happens behind
 * the scenes but we can completely ignore it and just handle the events for 
 * new nodes added or removed from the network.
 * 
 */

var argv = require('optimist').argv;
var Discover = require("../");

delete argv._;
delete argv.$0;

var d = new Discover(argv);

console.log('d.me:' , d.me);
console.log('instanceUuid', d.broadcast.instanceUuid);
console.log('processUuid', d.broadcast.processUuid);
d.advertise({ testing : Math.random() });

d.on("added", function (obj) {
	console.log("New node added to the network.");
	console.log(obj);
});

d.on("removed", function (obj) {
	console.log("Node removed from the network.");
	console.log(obj);
});

d.on("error", function (err) {
	console.log("error", err);
});

module.exports = d;
