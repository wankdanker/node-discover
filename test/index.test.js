import { describe, it, expect } from 'vitest';
import Discover from '../index.js';

describe('Index', () => {
  it('should export Discover module', () => {
    expect(Discover).toBeDefined();
    expect(typeof Discover).toBe('function');
  });

  it('should be able to create Discover instance', () => {
    const discover = new Discover({ start: false });
    expect(discover).toBeInstanceOf(Discover);
    discover.stop();
  });

  it('should expose static properties', () => {
    expect(Discover.weight).toBeDefined();
    expect(Discover.BasicLeadershipElection).toBeDefined();
    expect(Discover.NoLeadershipElection).toBeDefined();
  });
});
