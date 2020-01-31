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

	discover.on('started', self.start.bind(self));
	discover.on('stopped', self.stop.bind(self));

	discover.on('added', self.onNodeAdded.bind(self));
	discover.on('removed', self.onNodeRemoved.bind(self));
	discover.on('helloReceived', self.helloReceived.bind(self));
	discover.on('master', self.onMasterAdded.bind(self));
	discover.on('check', self.check.bind(self));
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

BasicLeadershipElection.prototype.start = function () {
};

BasicLeadershipElection.prototype.stop = function () {
};

module.exports = {
	NoLeadershipElection: NoLeadershipElection,
	BasicLeadershipElection: BasicLeadershipElection
};
