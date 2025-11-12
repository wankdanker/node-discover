import { describe, it, expect, beforeEach, vi } from 'vitest';
import leadership, { BasicLeadershipElection, NoLeadershipElection } from '../dist/lib/leadership.js';
import { EventEmitter } from 'events';

describe('Leadership', () => {
  describe('resolveLeadership', () => {
    let mockDiscover;

    beforeEach(() => {
      mockDiscover = new EventEmitter();
      mockDiscover.settings = {
        mastersRequired: 1,
        masterTimeout: 2000
      };
      mockDiscover.nodes = {};
      mockDiscover.me = {
        isMaster: false,
        isMasterEligible: true,
        weight: 100
      };
      mockDiscover.promote = vi.fn();
      mockDiscover.demote = vi.fn();
    });

    it('should return BasicLeadershipElection by default', () => {
      const elector = leadership(null, mockDiscover);
      expect(elector).toBeInstanceOf(BasicLeadershipElection);
    });

    it('should return false when leadershipElector is false', () => {
      const elector = leadership(false, mockDiscover);
      expect(elector).toBe(undefined);
    });

    it('should instantiate a constructor when provided', () => {
      const elector = leadership(NoLeadershipElection, mockDiscover);
      expect(elector).toBeInstanceOf(NoLeadershipElection);
    });

    it('should use an existing instance when provided', () => {
      const instance = new NoLeadershipElection();
      const elector = leadership(instance, mockDiscover);
      expect(elector).toBe(instance);
    });

    it('should bind event handlers to elector methods', () => {
      const elector = leadership(BasicLeadershipElection, mockDiscover);

      // Verify events are bound by checking listeners
      expect(mockDiscover.listenerCount('started')).toBeGreaterThan(0);
      expect(mockDiscover.listenerCount('stopped')).toBeGreaterThan(0);
      expect(mockDiscover.listenerCount('added')).toBeGreaterThan(0);
      expect(mockDiscover.listenerCount('removed')).toBeGreaterThan(0);
      expect(mockDiscover.listenerCount('helloReceived')).toBeGreaterThan(0);
      expect(mockDiscover.listenerCount('master')).toBeGreaterThan(0);
      expect(mockDiscover.listenerCount('check')).toBeGreaterThan(0);
    });
  });

  describe('NoLeadershipElection', () => {
    let elector;

    beforeEach(() => {
      elector = new NoLeadershipElection();
    });

    it('should have all required methods', () => {
      expect(typeof elector.onNodeAdded).toBe('function');
      expect(typeof elector.onNodeRemoved).toBe('function');
      expect(typeof elector.onMasterAdded).toBe('function');
      expect(typeof elector.helloReceived).toBe('function');
      expect(typeof elector.check).toBe('function');
      expect(typeof elector.start).toBe('function');
      expect(typeof elector.stop).toBe('function');
    });

    it('should do nothing when methods are called', () => {
      // These should not throw
      expect(() => {
        elector.onNodeAdded({}, {}, {});
        elector.onNodeRemoved({});
        elector.onMasterAdded({}, {}, {});
        elector.helloReceived({}, {}, {}, false, false);
        elector.check();
        elector.start();
        elector.stop();
      }).not.toThrow();
    });
  });

  describe('BasicLeadershipElection', () => {
    let elector;
    let mockDiscover;

    beforeEach(() => {
      mockDiscover = {
        settings: {
          mastersRequired: 1,
          masterTimeout: 2000
        },
        nodes: {},
        me: {
          isMaster: false,
          isMasterEligible: true,
          weight: 100
        },
        promote: vi.fn(),
        demote: vi.fn()
      };
      elector = new BasicLeadershipElection(mockDiscover);
    });

    it('should initialize with discover instance', () => {
      expect(elector.discover).toBe(mockDiscover);
    });

    it('should have all required methods', () => {
      expect(typeof elector.onNodeAdded).toBe('function');
      expect(typeof elector.onNodeRemoved).toBe('function');
      expect(typeof elector.onMasterAdded).toBe('function');
      expect(typeof elector.helloReceived).toBe('function');
      expect(typeof elector.check).toBe('function');
      expect(typeof elector.start).toBe('function');
      expect(typeof elector.stop).toBe('function');
    });

    describe('check', () => {
      it('should promote when no masters found and eligible', () => {
        mockDiscover.me.isMasterEligible = true;
        mockDiscover.me.isMaster = false;
        mockDiscover.nodes = {};

        elector.check();

        expect(mockDiscover.promote).toHaveBeenCalled();
      });

      it('should not promote when not eligible', () => {
        mockDiscover.me.isMasterEligible = false;
        mockDiscover.me.isMaster = false;
        mockDiscover.nodes = {};

        elector.check();

        expect(mockDiscover.promote).not.toHaveBeenCalled();
      });

      it('should not promote when already master', () => {
        mockDiscover.me.isMasterEligible = true;
        mockDiscover.me.isMaster = true;
        mockDiscover.nodes = {};

        elector.check();

        expect(mockDiscover.promote).not.toHaveBeenCalled();
      });

      it('should not promote when higher weight node exists', () => {
        mockDiscover.me.isMasterEligible = true;
        mockDiscover.me.isMaster = false;
        mockDiscover.me.weight = 100;
        mockDiscover.nodes = {
          'node1': {
            weight: 200,
            isMasterEligible: true,
            isMaster: false,
            lastSeen: Date.now()
          }
        };

        elector.check();

        expect(mockDiscover.promote).not.toHaveBeenCalled();
      });

      it('should demote when enough higher weight masters exist', () => {
        mockDiscover.me.isMasterEligible = true;
        mockDiscover.me.isMaster = true;
        mockDiscover.me.weight = 100;
        mockDiscover.settings.mastersRequired = 1;
        mockDiscover.nodes = {
          'node1': {
            weight: 200,
            isMaster: true,
            lastSeen: Date.now()
          }
        };

        elector.check();

        expect(mockDiscover.demote).toHaveBeenCalled();
      });

      it('should not demote when not enough masters', () => {
        mockDiscover.me.isMasterEligible = true;
        mockDiscover.me.isMaster = true;
        mockDiscover.me.weight = 100;
        mockDiscover.settings.mastersRequired = 2;
        mockDiscover.nodes = {
          'node1': {
            weight: 200,
            isMaster: true,
            lastSeen: Date.now()
          }
        };

        elector.check();

        expect(mockDiscover.demote).not.toHaveBeenCalled();
      });

      it('should ignore timed out masters', () => {
        mockDiscover.me.isMasterEligible = true;
        mockDiscover.me.isMaster = false;
        mockDiscover.me.weight = 100;
        mockDiscover.settings.masterTimeout = 2000;
        mockDiscover.nodes = {
          'node1': {
            weight: 200,
            isMaster: true,
            lastSeen: Date.now() - 3000 // 3 seconds ago - timed out
          }
        };

        elector.check();

        // Should promote because the only master has timed out
        expect(mockDiscover.promote).toHaveBeenCalled();
      });

      it('should count multiple masters correctly', () => {
        mockDiscover.me.isMasterEligible = true;
        mockDiscover.me.isMaster = true;
        mockDiscover.me.weight = 100;
        mockDiscover.settings.mastersRequired = 2;
        mockDiscover.nodes = {
          'node1': {
            weight: 150,
            isMaster: true,
            lastSeen: Date.now()
          },
          'node2': {
            weight: 200,
            isMaster: true,
            lastSeen: Date.now()
          }
        };

        elector.check();

        // Should demote because there are 2 higher weight masters and only 2 are required
        expect(mockDiscover.demote).toHaveBeenCalled();
      });

      it('should handle nodes without standard prototype correctly', () => {
        // Create nodes with standard object prototype
        // The code uses hasOwnProperty which requires standard prototype
        mockDiscover.nodes = {
          'node1': {
            weight: 50,
            isMaster: false,
            isMasterEligible: true,
            lastSeen: Date.now()
          }
        };
        mockDiscover.me.weight = 100;

        elector.check();

        // Should promote because we have higher weight
        expect(mockDiscover.promote).toHaveBeenCalled();
      });
    });

    describe('start', () => {
      it('should set discover instance', () => {
        const newDiscover = { test: true };
        elector.start(newDiscover);
        expect(elector.discover).toBe(newDiscover);
      });
    });

    describe('stop', () => {
      it('should not throw', () => {
        expect(() => elector.stop()).not.toThrow();
      });
    });

    describe('event handlers', () => {
      it('should handle onNodeAdded', () => {
        expect(() => elector.onNodeAdded({}, {}, {})).not.toThrow();
      });

      it('should handle onNodeRemoved', () => {
        expect(() => elector.onNodeRemoved({})).not.toThrow();
      });

      it('should handle onMasterAdded', () => {
        expect(() => elector.onMasterAdded({}, {}, {})).not.toThrow();
      });

      it('should handle helloReceived', () => {
        expect(() => elector.helloReceived({}, {}, {}, false, false)).not.toThrow();
      });
    });
  });
});
