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

var d = new Discover({ key : process.argv[2], weight : Date.now() * -1, mastersRequired : 2 });

console.log('I am ' + d.broadcast.instanceUuid);

d.on("added", function (obj) {
	console.log("New node discovered on the network.");
	//console.log(obj);
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
	console.log("Node lost from the network.");
	//console.log(obj);
	prompt();
});

d.on("error", function (err) {
	console.log("error", err);
	prompt();
});

// d.broadcast.on("hello", function (obj) {
// 	console.log(obj);
// });

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
			d.demote(true);
			break;
		case 'list':
			console.log(d.nodes);
			prompt();
			break;
		case 'me':
			console.log(d.me);
			prompt();
			break;
		default: 
			prompt();
	}
});

function prompt(str) {
	process.stdout.write((str || "") + '\n> ');
}
