var dEventEmitter = require('./deventemitter.js');

var dee = new dEventEmitter();

dee.on("connection::ready", function () {
	console.log("connection::ready");
	
	dee.emit("ready::hello", "Hello there!");
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