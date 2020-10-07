declare module 'node-discover' {
  import { EventEmitter } from 'events';
  import { RemoteInfo } from 'dgram';

  type Options = {
    helloInterval?: number;
    checkInterval?: number;
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
    weight?: number;
    client?: boolean;
    server?: boolean;
    reuseAddr?: boolean;
    exclusive?: boolean;
    ignoreProcess?: boolean;
    ignoreInstance?: boolean;
    start?: boolean;
    hostname?: string;
  };

  type Message<T = unknown> = {
    event: string;
    pid: string;
    iid: string;
    hostName: string;
    data?: T;
  };

  type Node<A = unknown> = {
    isMaster: boolean;
    isMasterEligible: boolean;
    weight: number;
    address: string;
    lastSeen: number;
    hostName: string;
    port: number;
    id: string;
    advertisement?: A;
  };

  type ThisNode<A = unknown> = {
    isMaster: boolean;
    isMasterEligible: boolean;
    weight: number;
    address: string;
    advertisement?: A;
  };

  type ChannelListener<D> = (data: D, obj: Message<D>, rinfo: RemoteInfo) => void;

  class Discover<A = any, C extends Record<string, any> = Record<string, any>> extends EventEmitter {
    nodes: Record<string, Node>;
    constructor(callback?: (error: Error, something: boolean) => void);
    constructor(options?: Options, callback?: (error: Error, success: boolean) => void);

    promote(): void;
    demote(permanent: boolean): void;
    join<T extends keyof C>(channel: T, cb: ChannelListener<C[T]>): boolean;
    leave<T extends keyof C>(channel: T): boolean;
    advertise(advertisement: A): void;
    send<T extends keyof C>(channel: T, obj: C[T]): boolean;
    start(callback?: (error: Error, success: boolean) => void): false | boolean;
    stop(): false | boolean;
    eachNode(fn: (node: Node<A>) => void): void;

    on(event: 'promotion', listener: (me: ThisNode<A>) => void): this;
    on(event: 'demotion', listener: (me: ThisNode<A>) => void): this;
    on(event: 'added', listener: ChannelListener<Node<A>>): this;
    on(event: 'removed', listener: (node: Node<A>) => void): this;
    on(event: 'master', listener: ChannelListener<Node<A>>): this;
    on(event: 'helloReceived', listener: (node: Node<A>, obj: Message<Node<A>>, rinfo: RemoteInfo, isNew: boolean, wasMaster: null | boolean) => void): this;
    on(event: 'helloEmitted', listener: () => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
    on(event: 'check', listener: () => void): this;
    on(event: 'started', listener: (self: Discover) => void): this;
    on(event: 'stopped', listener: (self: Discover) => void): this;
    on(channel: 'hello', listener: ChannelListener<A>): this;
    on<T extends keyof C>(channel: T, listener: ChannelListener<C[T]>): this;
  }

  export = Discover;
}