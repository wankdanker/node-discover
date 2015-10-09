/*
 * This is the most basic example of using Discover.
 * 
 * In this example all we are interested in is when new nodes are added to the
 * network or when they are removed. The master selection stuff happens behind
 * the scenes but we can completely ignore it and just handle the events for 
 * new nodes added or removed from the network.
 * 
 */

var Discover = require("../");

var d1 = new Discover({ key : process.argv[2], ignoreProcess : false, weight : 11111 });

d1.on("added", function (obj) {
	console.log("d1: New node added to the network.");
	console.log(obj);
});

d1.on("removed", function (obj) {
	console.log("d1: Node removed from the network.");
	console.log(obj);
});

d1.on("error", function (err) {
	console.log("d1: error", err);
});

var d2 = new Discover({ key : process.argv[2], ignoreProcess : false, weight : 22222 });

d2.on("added", function (obj) {
	console.log("d2: New node added to the network.");
	console.log(obj);
});

d2.on("removed", function (obj) {
	console.log("d2: Node removed from the network.");
	console.log(obj);
});

d2.on("error", function (err) {
	console.log("d2: error", err);
});
