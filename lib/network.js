var dgram = require('dgram'),
   crypto = require('crypto'),
       os = require('os'),
        EventEmitter = require('events').EventEmitter,
        util = require('util');

var procUuid = uuid();
var hostName = os.hostname();

var Network = module.exports = function (options) {
    EventEmitter.call(this);

    var self = this, options = options || {};

    self.address    = options.address   || '0.0.0.0';
    self.port       = options.port      || 12345;
    self.broadcast  = options.broadcast || null;
    self.multicast  = options.multicast || null;
    self.multicastTTL = options.multicastTTL || 1;
    self.key        = options.key       || null;

    self.socket = dgram.createSocket('udp4');

    self.socket.bind(self.port, self.address);

    process.nextTick(function() {
        if (!self.multicast) {
            //console.error("[node-discover]: Using broadcast");
            //Default to using broadcast if multicast address is not specified.
            self.socket.setBroadcast(true);

            //TODO: get the default broadcast address from os.networkInterfaces() (not currently returned)
            self.destination = self.broadcast || "255.255.255.255";
        }
        else {
            //console.error("[node-discover]: Using multicast");
            self.socket.addMembership(self.multicast);
            self.socket.setMulticastTTL(self.multicastTTL);

            self.destination = self.multicast;
        }
    });

    self.instanceUuid = uuid();
    self.processUuid = procUuid;

    self.socket.on("message", function ( data, rinfo ) {
        self.decode(data, function (err, obj) {
            if (err) {
                self.emit("error", err);
            }
            else if (obj.pid == procUuid) {
                return false;
            }
            else if (obj.event && obj.data) {

                self.emit(obj.event, obj.data, obj, rinfo);
            }
            else {
                self.emit("message", obj)
            }
        });
    });

    self.on("error", function (err) {
        //TODO: Deal with this
        /*console.log("Network error: ", err.stack);*/
    });
};
util.inherits(Network, EventEmitter);

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

    self.encode(obj, function (err, contents) {
        if (err) {
            return false;
        }

        var msg = new Buffer(contents);

        self.socket.send(
            msg
            , 0
            , msg.length
            , self.port
            , self.destination
        );
    });
};

Network.prototype.encode = function (data, callback) {
    var self = this;

    try {
        return callback(
              null
            , (self.key) ?
                  encrypt(JSON.stringify(data),self.key)
                : JSON.stringify(data)
        );
    }
    catch (e) {
        return callback(e, null);
    }
};

Network.prototype.decode = function (data, callback) {
    var self = this;

    try {
        if (self.key) {
            return callback(
                  null
                , JSON.parse(decrypt(data.toString(),self.key))
            );
        }
        else {
            return callback(null, JSON.parse(data));
        }
    }
    catch (e) {
        return callback(e, null);
    }
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

function encrypt (str, key) {
    var buf = [];
    var cipher = crypto.createCipher('aes256', key);

    buf.push(cipher.update(str, 'utf8', 'binary'));
    buf.push(cipher.final('binary'));

    return buf.join('');
};

function decrypt (str, key) {
    var buf = [];
    var decipher = crypto.createDecipher('aes256', key);

    buf.push(decipher.update(str, 'binary', 'utf8'));
    buf.push(decipher.final('utf8'));

    return buf.join('');
};
