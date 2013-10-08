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

var d = new Discover({ key : process.argv[2] });

d.on("added", function (obj) {
	console.log("New node added to the network.");
	console.log(obj);
	prompt();
});

d.on("promotion", function (obj) {
	console.log("I was promoted");
	prompt();
});

d.on("demotion", function (obj) {
	console.log('I was demoted');
	prompt();
});

d.on("removed", function (obj) {
	console.log("Node removed from the network.");
	console.log(obj);
	prompt();
});

d.on("error", function (err) {
	console.log("error", err);
	prompt();
});

prompt()

process.stdin.resume();

process.stdin.on('data', function (chunk) {
	var data = chunk.toString().toLowerCase().trim();

	switch(data) {
		case 'promote':
			prompt("Promoting");
			d.promote();
			break;
		case 'demote':
			prompt("Demoting");
			d.demote();
			break;
		case 'demote true':
			prompt('Demoting permanently');
			break;
		default: 
			prompt();
	}
});

function prompt(str) {
	process.stdout.write((str || "") + '\n> ');
}
