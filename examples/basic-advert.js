/*
 * 
 * 
 */

var Discover = require("../");

var d = new Discover();

d.advertise({
	http : "80",
	random : Math.random()
});

d.on("added", function (obj) {
	console.log("New node added to the network.");
	console.log(obj);
});

d.on("removed", function (obj) {
	console.log("Node removed from the network.");
	console.log(obj);
});
