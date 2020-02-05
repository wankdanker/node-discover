module.exports = resolveLeadership;
module.exports.NoLeadershipElection = NoLeadershipElection;
module.exports.BasicLeadershipElection = BasicLeadershipElection;

/**
 * Resolve the leadershipElector for the discover instance
 *
 * @param {*} leadershipElector a LeadershipElection instance or constructor, or false to disable
 * @param {*} discover the discover instance from which events will be bound to LeadershipElection instance methods
 * @returns {LeadershipElection} the instance of the LeadershipElection module that was resolved or false
 */
function resolveLeadership (leadershipElector, discover) {
	let elector;

	if (leadershipElector === false) {
		elector = false;
	}
	else if (leadershipElector == null) {
		elector = new BasicLeadershipElection(discover);
	}
	else if (typeof leadershipElector == 'function') {
		elector = new leadershipElector(discover);
	}
	else {
		//assume an instance of a leadership elector
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
 * @param discover
 * @constructor
 */
function NoLeadershipElection() {
}
NoLeadershipElection.prototype.onNodeAdded = function (node, obj, rinfo) {
};
NoLeadershipElection.prototype.onNodeRemoved = function (node) {
};
NoLeadershipElection.prototype.onMasterAdded = function (node, obj, rinfo) {
};
NoLeadershipElection.prototype.helloReceived = function (node, obj, rinfo, isNew, wasMaster) {
};
NoLeadershipElection.prototype.check = function () {
};
NoLeadershipElection.prototype.start = function () {
};
NoLeadershipElection.prototype.stop = function () {
};


/**
 * Simple default leadership election.
 * @constructor
 */
function BasicLeadershipElection(discover) {
	var self = this;

	self.discover = discover;
}

BasicLeadershipElection.prototype.onNodeAdded = function (node, obj, rinfo) {
};

BasicLeadershipElection.prototype.onNodeRemoved = function (node) {
};

BasicLeadershipElection.prototype.onMasterAdded = function (node, obj, rinfo) {
};

BasicLeadershipElection.prototype.helloReceived = function (node, obj, rinfo, isNew, wasMaster) {
};

BasicLeadershipElection.prototype.check = function () {
	var mastersFound = 0, higherWeightMasters = 0, higherWeightFound = false;
	var discover = this.discover;
	var settings = discover.settings;

	var me = discover.me;
	for (var processUuid in discover.nodes) {
		if (!discover.nodes.hasOwnProperty(processUuid)) {
			continue;
		}
		var node = discover.nodes[processUuid];

		if ( node.isMaster && (+new Date() - node.lastSeen) < settings.masterTimeout ) {
			mastersFound++;
			if (node.weight > me.weight) {
				higherWeightMasters += 1;
			}
		}

		if (node.weight > me.weight && node.isMasterEligible && !node.isMaster) {
			higherWeightFound = true;
		}
	}

	var iAmMaster = me.isMaster;
	if (iAmMaster && higherWeightMasters >= settings.mastersRequired) {
		discover.demote();
	}

	if (!iAmMaster && mastersFound < settings.mastersRequired && me.isMasterEligible && !higherWeightFound) {
		//no masters found out of all our nodes, become one.
		discover.promote();
	}
};

BasicLeadershipElection.prototype.start = function (discover) {
	this.discover = discover;
};

BasicLeadershipElection.prototype.stop = function () {
};
