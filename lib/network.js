var dgram = require('dgram'),
    crypto = require('crypto'),
    os = require('os'),
    EventEmitter = require('events').EventEmitter,
    util = require('util'),
    encrypt = require('./encrypt-stream'),
    decrypt = require('./decrypt-stream'),
    stringify = require('./stringify-stream'),
    parse = require('./parse-stream'),
    passThrough = require('stream').PassThrough,
    udpStream = require('datagram-stream');

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

    self.input = passThrough({ objectMode : true });
    self.output = passThrough({ objectMode : true });
    self.encode = stringify();
    self.decode = parse();

    self.decode.on('error', function (err) {
        //TODO: care about this, sometimes
        console.log(err);
    });

    self.input.on("data", function (obj) {
        //if obj is an array, then the new packet format
        //is being used, so do some compatibility stuff
        if (Array.isArray(obj)) { 
            obj = {
                event : obj[0]
                , iid : obj[1]
                , hostName : obj[2]
                , data : obj[3] || null
		, rinfo : obj.rinfo
            };
        }

        //this can be removed when udpStream supports loopback suppression
        if (obj.iid == self.instanceUuid) {
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

    self.socket = udpStream({
        address      : options.address      || '0.0.0.0',
        port         : options.port         || 12345,
        broadcast    : options.broadcast    || '255.255.255.255', //TODO: get real network bcast address
        multicast    : options.multicast    || null,
        multicastTTL : options.multicastTTL || 1,
        reuseAddr    : (options.reuseAddr === false) ? false : true,
        loopback     : false
    }, function (err) {
        if (err) {
            self.emit('error', err);
            return callback(err);
        }

        //TODO: unpipe things first??
        //HACK: for some reason our custom streams need to pipe to passThrough()
        //in order to start....
        var p = self.output.pipe(self.encode).pipe(passThrough());

        if (self.key) {
            p = p.pipe(encrypt(self.key)).pipe(passThrough());
        }

        p = p.pipe(self.socket);

        if (self.key) {
            p = p.pipe(decrypt(self.key));
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

    obj = [ event, self.instanceUuid, hostName ];

    if (arguments.length == 2) {
        obj.push(arguments[1]);
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

