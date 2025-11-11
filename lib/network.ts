import dgram from 'dgram';
import crypto from 'crypto';
import os from 'os';
import { EventEmitter } from 'events';
import { v4 as uuid } from 'uuid';

const nodeVersion = process.version.replace('v', '').split(/\./gi).map(t => parseInt(t, 10));
const procUuid = uuid();
const hostName = process.env.DISCOVERY_HOSTNAME || os.hostname();

export interface NetworkOptions {
  address?: string;
  port?: number;
  broadcast?: string | null | undefined;
  multicast?: string | null | undefined;
  multicastTTL?: number | null | undefined;
  unicast?: string | string[] | null | undefined;
  key?: string | null | undefined;
  exclusive?: boolean;
  reuseAddr?: boolean;
  ignoreProcess?: boolean;
  ignoreInstance?: boolean;
  hostname?: string | null | undefined;
  hostName?: string;
}

interface Destination {
  address: string;
  port?: string;
}

interface MessageObject {
  event?: string;
  data?: any;
  pid: string;
  iid: string;
  hostName: string;
}

class Network extends EventEmitter {
  address: string;
  port: number;
  broadcast: string | null;
  multicast: string | null;
  multicastTTL: number;
  unicast: string | string[] | null;
  key: string | null;
  exclusive: boolean;
  reuseAddr: boolean;
  ignoreProcess: boolean;
  ignoreInstance: boolean;
  hostName: string;
  socket: dgram.Socket;
  instanceUuid: string;
  processUuid: string;
  destination?: Destination[];

  constructor(options: NetworkOptions = {}) {
    super();

    this.address = options.address || '0.0.0.0';
    this.port = options.port || 12345;
    this.broadcast = options.broadcast || null;
    this.multicast = options.multicast || null;
    this.multicastTTL = options.multicastTTL || 1;
    this.unicast = options.unicast || null;
    this.key = options.key || null;
    this.exclusive = options.exclusive || false;
    this.reuseAddr = options.reuseAddr === false ? false : true;
    this.ignoreProcess = options.ignoreProcess === false ? false : true;
    this.ignoreInstance = options.ignoreInstance === false ? false : true;
    this.hostName = options.hostname || options.hostName || hostName;

    if (nodeVersion[0] === 0 && nodeVersion[1] < 12) {
      // node v0.10 does not support passing an object to dgram.createSocket
      this.socket = dgram.createSocket('udp4');
    } else {
      this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: this.reuseAddr });
    }

    this.instanceUuid = uuid();
    this.processUuid = procUuid;

    this.socket.on('message', (data: Buffer, rinfo: dgram.RemoteInfo) => {
      this.decode(data, (err, obj) => {
        if (err) {
          // most decode errors are because we tried
          // to decrypt a packet for which we do not
          // have the key
          // the only other possibility is that the
          // message was split across packet boundaries
          // and that is not handled
        } else if (obj.pid === procUuid && this.ignoreProcess && obj.iid !== this.instanceUuid) {
          return;
        } else if (obj.iid === this.instanceUuid && this.ignoreInstance) {
          return;
        } else if (obj.event && obj.data !== undefined) {
          this.emit(obj.event, obj.data, obj, rinfo);
        } else {
          this.emit('message', obj);
        }
      });
    });

    this.on('error', (err: Error) => {
      // TODO: Deal with this
    });
  }

  start(callback?: (err?: Error) => void): void {
    const bindOpts = {
      port: this.port,
      address: this.address,
      exclusive: this.exclusive
    };

    this.socket.bind(bindOpts, () => {
      if (this.unicast) {
        if (typeof this.unicast === 'string' && this.unicast.indexOf(',') !== -1) {
          this.unicast = this.unicast.split(',');
        }

        this.destination = [].concat(this.unicast as any).map((dest: string) => createDestination(dest));
      } else if (!this.multicast) {
        // Default to using broadcast if multicast address is not specified.
        this.socket.setBroadcast(true);

        // TODO: get the default broadcast address from os.networkInterfaces() (not currently returned)
        this.destination = [createDestination(this.broadcast || '255.255.255.255')];
      } else {
        try {
          // addMembership can throw if there are no interfaces available
          this.socket.addMembership(this.multicast);
          this.socket.setMulticastTTL(this.multicastTTL);
        } catch (e) {
          this.emit('error', e as Error);
          return callback && callback(e as Error);
        }

        this.destination = [createDestination(this.multicast)];
      }

      return callback && callback();
    });
  }

  stop(callback?: () => void): void {
    this.socket.close();
    return callback && callback();
  }

  send(event: string, data?: any): void {
    const obj: MessageObject = {
      event,
      pid: procUuid,
      iid: this.instanceUuid,
      hostName: this.hostName
    };

    if (arguments.length === 2) {
      obj.data = data;
    }

    this.encode(obj, (err, contents) => {
      if (err || !contents) {
        return;
      }

      const msg = Buffer.from(contents);

      if (this.destination) {
        this.destination.forEach((destination) => {
          this.socket.send(
            msg,
            0,
            msg.length,
            destination.port ? parseInt(destination.port) : this.port,
            destination.address
          );
        });
      }
    });
  }

  encode(data: any, callback: (err: Error | null, result?: string) => void): void {
    let tmp: string;

    try {
      if (this.key) {
        tmp = encrypt(JSON.stringify(data), this.key);
      } else {
        tmp = JSON.stringify(data);
      }
    } catch (e) {
      return callback(e as Error);
    }

    return callback(null, tmp);
  }

  decode(data: Buffer, callback: (err: Error | null, result?: any) => void): void {
    let tmp: any;

    try {
      if (this.key) {
        tmp = JSON.parse(decrypt(data.toString(), this.key));
      } else {
        tmp = JSON.parse(data.toString());
      }
    } catch (e) {
      return callback(e as Error);
    }

    return callback(null, tmp);
  }
}

function encrypt(str: string, key: string): string {
  const buf: string[] = [];
  // @ts-ignore - createCipher is deprecated but maintained for backward compatibility
  const cipher = crypto.createCipher('aes256', key);

  buf.push(cipher.update(str, 'utf8', 'binary'));
  buf.push(cipher.final('binary'));

  return buf.join('');
}

function decrypt(str: string, key: string): string {
  const buf: string[] = [];
  // @ts-ignore - createDecipher is deprecated but maintained for backward compatibility
  const decipher = crypto.createDecipher('aes256', key);

  buf.push(decipher.update(str, 'binary', 'utf8'));
  buf.push(decipher.final('utf8'));

  return buf.join('');
}

function createDestination(address: string, port?: string): Destination {
  let addr = address;
  let p = port;

  if (!p && address.indexOf(':') !== -1) {
    const tokens = address.split(':');
    addr = tokens[0];
    p = tokens[1];
  }

  return {
    address: addr,
    port: p
  };
}

export default Network;
