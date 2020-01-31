/**
 * No leadership election
 * @param discover
 * @constructor
 */
function NoLeadershipElection() {
}
NoLeadershipElection.prototype.onNodeAdded = function (node) {
};
NoLeadershipElection.prototype.onNodeRemoved = function (node) {
};
NoLeadershipElection.prototype.helloReceived = function (node, isNew, wasMaster, obj, rinfo) {
};
NoLeadershipElection.prototype.check = function () {
};
NoLeadershipElection.prototype.start = function (callback) {
	callback();
};

NoLeadershipElection.prototype.stop = function () {
};


/**
 * Simple default leadership election.
 * @constructor
 */
function BasicLeadershipElection() {
}
BasicLeadershipElection.prototype.onNodeAdded = function (node) {

};
BasicLeadershipElection.prototype.onNodeRemoved = function (node) {
	this.check();
};


BasicLeadershipElection.prototype.helloReceived = function (node, isNew, wasMaster, obj, rinfo) {
	var discover = this.discover;

	if (!node.isMaster || (!isNew && wasMaster)) {
		return;
	}

	this.check();
	discover.emit("master", node, obj, rinfo);
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

BasicLeadershipElection.prototype.start = function (discover, callback) {
	this.discover = discover;
	callback();
};

BasicLeadershipElection.prototype.stop = function () {

};

module.exports = {
	NoLeadershipElection: NoLeadershipElection,
	BasicLeadershipElection: BasicLeadershipElection
};
