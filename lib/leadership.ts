import type { Discover } from './discover.js';

export interface LeadershipElector {
  onNodeAdded(node: any, obj: any, rinfo: any): void;
  onNodeRemoved(node: any): void;
  onMasterAdded(node: any, obj: any, rinfo: any): void;
  helloReceived(node: any, obj: any, rinfo: any, isNew: boolean, wasMaster: boolean | null): void;
  check(): void;
  start(discover?: Discover): void;
  stop(): void;
}

type LeadershipElectorConstructor = new (discover: Discover) => LeadershipElector;

/**
 * Resolve the leadershipElector for the discover instance
 */
function resolveLeadership(
  leadershipElector: LeadershipElector | LeadershipElectorConstructor | false | null | undefined,
  discover: Discover
): LeadershipElector | undefined {
  let elector: LeadershipElector | undefined;

  if (leadershipElector === false) {
    elector = undefined;
  } else if (leadershipElector == null) {
    elector = new BasicLeadershipElection(discover);
  } else if (typeof leadershipElector === 'function') {
    elector = new leadershipElector(discover);
  } else {
    // assume an instance of a leadership elector
    elector = leadershipElector;
  }

  if (!elector) {
    return;
  }

  discover.on('started', elector.start.bind(elector));
  discover.on('stopped', elector.stop.bind(elector));
  discover.on('added', elector.onNodeAdded.bind(elector));
  discover.on('removed', elector.onNodeRemoved.bind(elector));
  discover.on('helloReceived', elector.helloReceived.bind(elector));
  discover.on('master', elector.onMasterAdded.bind(elector));
  discover.on('check', elector.check.bind(elector));

  return elector;
}

/**
 * No leadership election
 */
export class NoLeadershipElection implements LeadershipElector {
  onNodeAdded(node: any, obj: any, rinfo: any): void {}
  onNodeRemoved(node: any): void {}
  onMasterAdded(node: any, obj: any, rinfo: any): void {}
  helloReceived(node: any, obj: any, rinfo: any, isNew: boolean, wasMaster: boolean | null): void {}
  check(): void {}
  start(): void {}
  stop(): void {}
}

interface Node {
  isMaster?: boolean;
  isMasterEligible?: boolean;
  weight: number;
  lastSeen: number;
  [key: string]: any;
}

/**
 * Simple default leadership election
 */
export class BasicLeadershipElection implements LeadershipElector {
  discover: Discover;

  constructor(discover: Discover) {
    this.discover = discover;
  }

  onNodeAdded(node: Node, obj: any, rinfo: any): void {}

  onNodeRemoved(node: Node): void {}

  onMasterAdded(node: Node, obj: any, rinfo: any): void {}

  helloReceived(node: Node, obj: any, rinfo: any, isNew: boolean, wasMaster: boolean | null): void {}

  check(): void {
    let mastersFound = 0;
    let higherWeightMasters = 0;
    let higherWeightFound = false;
    const discover = this.discover;
    const settings = discover.settings;

    const me = discover.me;
    for (const processUuid in discover.nodes) {
      if (!discover.nodes.hasOwnProperty(processUuid)) {
        continue;
      }
      const node = discover.nodes[processUuid];

      if (node.isMaster && +new Date() - node.lastSeen < settings.masterTimeout) {
        mastersFound++;
        if (node.weight > me.weight) {
          higherWeightMasters += 1;
        }
      }

      if (node.weight > me.weight && node.isMasterEligible && !node.isMaster) {
        higherWeightFound = true;
      }
    }

    const iAmMaster = me.isMaster;
    if (iAmMaster && higherWeightMasters >= settings.mastersRequired) {
      discover.demote();
    }

    if (
      !iAmMaster &&
      mastersFound < settings.mastersRequired &&
      me.isMasterEligible &&
      !higherWeightFound
    ) {
      // no masters found out of all our nodes, become one.
      discover.promote();
    }
  }

  start(discover?: Discover): void {
    if (discover) {
      this.discover = discover;
    }
  }

  stop(): void {}
}

export default resolveLeadership;
