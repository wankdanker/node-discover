import Network, { NetworkOptions } from './network.js';
import resolveLeadership, { BasicLeadershipElection, NoLeadershipElection, LeadershipElector } from './leadership.js';
import { EventEmitter } from 'events';
import type dgram from 'dgram';

const reservedEvents = ['promotion', 'demotion', 'added', 'removed', 'master', 'hello'];

export interface DiscoverOptions {
  helloInterval?: number | (() => number);
  checkInterval?: number | (() => number);
  nodeTimeout?: number;
  masterTimeout?: number;
  address?: string;
  port?: number;
  broadcast?: string;
  multicast?: string;
  multicastTTL?: number;
  unicast?: string | string[];
  key?: string;
  mastersRequired?: number;
  leadershipElector?: LeadershipElector | (new (discover: Discover) => LeadershipElector) | false | null;
  weight?: number;
  client?: boolean;
  server?: boolean;
  reuseAddr?: boolean;
  exclusive?: boolean;
  ignoreProcess?: boolean;
  ignoreInstance?: boolean;
  ignore?: boolean;
  start?: boolean;
  hostname?: string;
  hostName?: string;
  advertisement?: any;
}

export interface DiscoverSettings {
  helloInterval: number | (() => number);
  checkInterval: number | (() => number);
  nodeTimeout: number;
  masterTimeout: number;
  address: string;
  port: number;
  broadcast: string | null;
  multicast: string | null;
  multicastTTL: number | null | undefined;
  unicast: string | string[] | null | undefined;
  key: string | null;
  mastersRequired: number;
  leadershipElector: any;
  weight: number;
  client: boolean;
  server: boolean;
  reuseAddr: boolean | undefined;
  exclusive: boolean;
  ignoreProcess: boolean;
  ignoreInstance: boolean;
  start: boolean;
  hostname: string | null | undefined;
}

export interface Node {
  id: string;
  isMaster?: boolean;
  isMasterEligible?: boolean;
  weight: number;
  address: string;
  hostName: string;
  port: number;
  lastSeen: number;
  advertisement?: any;
  [key: string]: any;
}

export interface MeObject {
  isMaster: boolean;
  isMasterEligible: boolean;
  weight: number;
  address: string;
  advertisement?: any;
}

export type ReadyCallback = (error: Error | null, success: boolean) => void;

/**
 * This is the default automatically assigned weight function
 */
export function defaultWeight(): number {
  // default to negative, decimal now value
  return -(Date.now() / Math.pow(10, String(Date.now()).length));
}

export class Discover extends EventEmitter {
  static weight = defaultWeight;
  static BasicLeadershipElection = BasicLeadershipElection;
  static NoLeadershipElection = NoLeadershipElection;

  settings: DiscoverSettings;
  leadershipElector: LeadershipElector | undefined;
  broadcast: Network;
  me: MeObject;
  nodes: { [uuid: string]: Node };
  channels: string[];
  private checkId?: NodeJS.Timeout;
  private helloId?: NodeJS.Timeout;
  private running = false;

  constructor(options?: DiscoverOptions | ReadyCallback, callback?: ReadyCallback) {
    super();

    if (typeof options === 'function') {
      callback = options;
      options = undefined;
    }

    const opts = options || {};

    this.settings = {
      helloInterval: opts.helloInterval || 1000,
      checkInterval: opts.checkInterval || 2000,
      nodeTimeout: opts.nodeTimeout || 2000,
      masterTimeout: opts.masterTimeout || opts.nodeTimeout || 2000,
      address: opts.address || '0.0.0.0',
      port: opts.port || 12345,
      broadcast: opts.broadcast || null,
      multicast: opts.multicast || null,
      multicastTTL: opts.multicastTTL || null,
      unicast: opts.unicast || null,
      key: opts.key || null,
      mastersRequired: opts.mastersRequired || 1,
      leadershipElector: opts.leadershipElector || null,
      weight: opts.weight !== undefined ? opts.weight : Discover.weight(),
      client: opts.client || (!opts.client && !opts.server),
      server: opts.server || (!opts.client && !opts.server),
      reuseAddr: opts.reuseAddr,
      exclusive: opts.exclusive || false,
      ignoreProcess: opts.ignoreProcess === false ? false : true,
      ignoreInstance: opts.ignoreInstance === false ? false : true,
      start: opts.start === false ? false : true,
      hostname: opts.hostname || opts.hostName || null
    };

    // resolve the leadershipElector
    this.leadershipElector = resolveLeadership(opts.leadershipElector, this);

    // this is for backwards compatibility with v0.1.0
    // TODO: should be removed in the next major release
    if (opts.ignore === false) {
      this.settings.ignoreProcess = false;
      this.settings.ignoreInstance = false;
    }

    if (!(this.settings.nodeTimeout >= (typeof this.settings.checkInterval === 'function' ? 0 : this.settings.checkInterval))) {
      throw new Error('nodeTimeout must be greater than or equal to checkInterval.');
    }

    if (!(this.settings.masterTimeout >= this.settings.nodeTimeout)) {
      throw new Error('masterTimeout must be greater than or equal to nodeTimeout.');
    }

    this.broadcast = new Network({
      address: this.settings.address,
      port: this.settings.port,
      broadcast: this.settings.broadcast,
      multicast: this.settings.multicast,
      multicastTTL: this.settings.multicastTTL,
      unicast: this.settings.unicast,
      key: this.settings.key,
      exclusive: this.settings.exclusive,
      reuseAddr: this.settings.reuseAddr,
      ignoreProcess: this.settings.ignoreProcess,
      ignoreInstance: this.settings.ignoreInstance,
      hostname: this.settings.hostname
    });

    // This is the object that gets broadcast with each hello packet.
    this.me = {
      isMaster: false,
      isMasterEligible: this.settings.server, // Only master eligible by default if we are a server
      weight: this.settings.weight,
      address: '127.0.0.1', // TODO: get the real local address?
      advertisement: opts.advertisement
    };

    this.nodes = {};
    this.channels = [];

    this.evaluateHello = this.evaluateHello.bind(this);
    this.check = this.check.bind(this);

    this.broadcast.on('hello', this.evaluateHello);

    this.broadcast.on('error', (error: Error) => {
      this.emit('error', error);
    });

    // check if auto start is enabled
    if (this.settings.start) {
      this.start(callback);
    }
  }

  /*
   * When receiving hello messages we need things to happen in the following order:
   *  - make sure the node is in the node list
   *  - if hello is from new node, emit added
   *  - if hello is from new master and we are master, demote
   *  - if hello is from new master emit master
   *
   * need to be careful not to over-write the old node object before we have information
   * about the old instance to determine if node was previously a master.
   */
  evaluateHello(data: Partial<Node>, obj: any, rinfo: dgram.RemoteInfo): void {
    // prevent processing hello message from self
    if (obj.iid === this.broadcast.instanceUuid) {
      return;
    }

    data.lastSeen = +new Date();
    data.address = rinfo.address;
    data.hostName = obj.hostName;
    data.port = rinfo.port;
    data.id = obj.iid;
    const isNew = !this.nodes[obj.iid];
    let wasMaster: boolean | null = null;

    if (!isNew) {
      wasMaster = !!this.nodes[obj.iid].isMaster;
    }

    const node = this.nodes[obj.iid] = this.nodes[obj.iid] || ({} as Node);

    Object.getOwnPropertyNames(data).forEach((key) => {
      (node as any)[key] = (data as any)[key];
    });

    if (isNew) {
      // new node found
      this.emit('added', node, obj, rinfo);
    }

    if (node.isMaster) {
      // if we have this node and it was not previously a master then it is a new master node
      if (isNew || !wasMaster) {
        // this is a new master
        this.emit('master', node, obj, rinfo);
      }
    }

    this.emit('helloReceived', node, obj, rinfo, isNew, wasMaster);
  }

  check(): void {
    for (const processUuid in this.nodes) {
      if (!this.nodes.hasOwnProperty(processUuid)) {
        continue;
      }
      const node = this.nodes[processUuid];

      if (+new Date() - node.lastSeen > (node.isMaster ? this.settings.masterTimeout : this.settings.nodeTimeout)) {
        // we haven't seen the node recently
        // delete the node from our nodes list
        delete this.nodes[processUuid];
        this.emit('removed', node);
      }
    }

    this.emit('check');
  }

  start(callback?: ReadyCallback): boolean | undefined {
    if (this.running) {
      callback && callback(null, false);
      return false;
    }

    this.broadcast.start((err?: Error) => {
      if (err) {
        return callback && callback(err, false);
      }

      this.running = true;

      this.checkId = setInterval(this.check, this.getCheckInterval());

      if (this.settings.server) {
        // send hello every helloInterval
        this.helloId = setInterval(() => {
          this.hello();
        }, this.getHelloInterval());
        this.hello();
      }

      this.emit('started', this);

      return callback && callback(null, true);
    });

    return undefined;
  }

  stop(): boolean {
    if (!this.running) {
      return false;
    }

    this.broadcast.stop();

    if (this.checkId) clearInterval(this.checkId);
    if (this.helloId) clearInterval(this.helloId);

    this.emit('stopped', this);

    this.running = false;
    return true;
  }

  private getHelloInterval(): number {
    if (typeof this.settings.helloInterval === 'function') {
      return this.settings.helloInterval.call(this);
    }
    return this.settings.helloInterval;
  }

  private getCheckInterval(): number {
    if (typeof this.settings.checkInterval === 'function') {
      return this.settings.checkInterval.call(this);
    }
    return this.settings.checkInterval;
  }

  promote(): void {
    this.me.isMasterEligible = true;
    this.me.isMaster = true;
    this.emit('promotion', this.me);
    this.hello();
  }

  demote(permanent?: boolean): void {
    this.me.isMasterEligible = !permanent;
    this.me.isMaster = false;
    this.emit('demotion', this.me);
    this.hello();
  }

  master(node: Node): void {
    this.emit('master', node);
  }

  hello(): void {
    this.broadcast.send('hello', this.me);
    this.emit('helloEmitted');
  }

  advertise(obj: any): void {
    this.me.advertisement = obj;
  }

  eachNode(fn: (node: Node) => void): void {
    for (const uuid in this.nodes) {
      fn(this.nodes[uuid]);
    }
  }

  join(channel: string, fn?: (...args: any[]) => void): boolean {
    if (reservedEvents.indexOf(channel) !== -1) {
      return false;
    }

    if (this.channels.indexOf(channel) !== -1) {
      return false;
    }

    if (fn) {
      this.on(channel, fn);
    }

    this.broadcast.on(channel, (data: any, obj: any, rinfo: dgram.RemoteInfo) => {
      this.emit(channel, data, obj, rinfo);
    });

    this.channels.push(channel);

    return true;
  }

  leave(channel: string): boolean {
    this.broadcast.removeAllListeners(channel);

    const index = this.channels.indexOf(channel);
    if (index !== -1) {
      delete this.channels[index];
    }

    return true;
  }

  send(channel: string, obj: any): boolean {
    if (reservedEvents.indexOf(channel) !== -1) {
      return false;
    }

    this.broadcast.send(channel, obj);

    return true;
  }
}

export default Discover;
