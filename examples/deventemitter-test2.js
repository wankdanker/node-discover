var dEventEmitter = require('./deventemitter.js');

var dee = new dEventEmitter();
var count = 0;

dee.once("connection::ready", function () {
	console.log("connection::ready");
	setInterval(function () {
		dee.emit("ready::hello", "Hello there, I send this every second. " + count++);
	},1000)
});

dee.on("connection::end", function () {
	console.log("connection::end");
});

dee.on("self::promoted", function () {
	console.log("*****I am now in charge*****");
});

dee.on("*::hello", function (data) {
	console.log(data);
});