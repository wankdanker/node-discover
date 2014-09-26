var dgram = require('dgram'),
    crypto = require('crypto'),
    os = require('os'),
    EventEmitter = require('events').EventEmitter,
    util = require('util'),
    encrypt = require('crypt-decrypt').Encrypt,
    decrypt = require('crypt-decrypt').Decrypt,
    stringify = require('newline-json').Stringifier,
    parse = require('newline-json').Parser,
    passThrough = require('stream').PassThrough,
    udpStream = require('datagram-stream');

var procUuid = uuid();
var hostName = os.hostname();

module.exports = Network; 
 
function Network (options) {
    if (!(this instanceof Network)) {
        return new Network(options, callback);
    }

    EventEmitter.call(this);

    var self = this, options = options || {};
    self.options      = options;
    self.key          = options.key || null;
    self.instanceUuid = uuid();
    self.processUuid  = procUuid;

    self.input = passThrough({ objectMode : true });
    self.output = passThrough({ objectMode : true });
    self.encode = stringify();
    self.decode = parse();

    self.input.on("data", function (obj) {
        //this can be removed when udpStream supports loopback suppression
        if (obj.pid == procUuid) {
            return false;
        }
        else if (obj.event && obj.data) {
            self.emit(obj.event, obj.data, obj, obj.rinfo || {});
        }
        else {
            self.emit("message", obj);
        }
    });

    self.on("error", function (err) {
        //TODO: Deal with this
        /*console.log("Network error: ", err.stack);*/
    });
};

util.inherits(Network, EventEmitter);

Network.prototype.start = function (callback) {
    var self = this, options = self.options;
    //TODO: check for errors from instantion of udpStream and callback accordingly
    //TODO: unpipe things first??

    self.socket = udpStream({
        address      : options.address      || '0.0.0.0',
        port         : options.port         || 12345,
        broadcast    : options.broadcast    || '255.255.255.255', //TODO: get real network bcast address
        multicast    : options.multicast    || null,
        multicastTTL : options.multicastTTL || 1,
        loopback     : false
    }, function (err) {
        if (err) {
            self.emit('error', err);
            return callback(err);
        }

        var p = self.output.pipe(self.encode);

        if (self.key) {
            p = p.pipe(new encrypt({ pass : self.key }));
        }

        p = p.pipe(self.socket);

        if (self.key) {
            p = p.pipe(new decrypt({ pass : self.key }));
        }

        p.pipe(self.decode).pipe(self.input);

        return callback && callback();    
    });
};

Network.prototype.stop = function (callback) {
    var self = this;

    //TODO:    self.socket.close();

    return callback && callback();
};

Network.prototype.send = function (event) {
    var self = this;

    var obj = {
        event : event,
        pid : procUuid,
        iid : self.instanceUuid,
        hostName : hostName
    };

    if (arguments.length == 2) {
        obj.data = arguments[1];
    }
    else {
        //TODO: splice the arguments array and remove the first element
        //setting data to the result array
    }

    return self.output.write(obj);
};

//TODO: this may need to be improved
function uuid() {
    var str = [
          hostName
        , ":"
        , process.pid
        , ":"
        , (+new Date)
        , ":"
        , (Math.floor(Math.random() * 100000000000))
        , (Math.floor(Math.random() * 100000000000))
    ].join('');

    return md5(str);
}

function md5 (str) {
    var hash = crypto.createHash('md5');

    hash.update(str);

    return hash.digest('hex');
};

