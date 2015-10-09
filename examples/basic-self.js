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

var d1 = new Discover({ key : process.argv[2], ignoreProcess : false, ignoreInstance : false, weight : 11111 });

d1.join('test', function (msg) {
	console.log("d1 msg: ", msg);
});

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

setInterval(function () {
	d1.send('test', 'hello from d1');
}, 1000);

var d2 = new Discover({ key : process.argv[2], ignoreProcess : false, ignoreInstance : false, weight : 22222 });

d2.join('test', function (msg) {
	console.log("d2 msg: ", msg);
});

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

setInterval(function () {
	d2.send('test', 'hello from d2');
}, 1000);
