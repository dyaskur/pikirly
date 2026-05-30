import { describe, it, expect } from 'vitest';
import { seededShuffle } from '@kahoot/shared';

describe('seededShuffle', () => {
  it('is deterministic for the same seed', () => {
    const input = ['A', 'B', 'C', 'D', 'E', 'F'];
    const a = seededShuffle(input, 'player-1:0');
    const b = seededShuffle(input, 'player-1:0');
    expect(a).toEqual(b);
  });

  it('produces different orderings for different seeds', () => {
    const input = ['A', 'B', 'C', 'D', 'E', 'F'];
    const a = seededShuffle(input, 'player-1:0');
    const b = seededShuffle(input, 'player-2:0');
    expect(a).not.toEqual(b);
  });

  it('preserves the multiset of elements', () => {
    const input = ['A', 'B', 'C', 'D', 'E', 'F'];
    const shuffled = seededShuffle(input, 'seed');
    const cmp = (a: string, b: string) => a.localeCompare(b);
    expect([...shuffled].sort(cmp)).toEqual([...input].sort(cmp));
    expect(shuffled).toHaveLength(input.length);
  });

  it('does not mutate the input array', () => {
    const input = ['A', 'B', 'C', 'D'];
    const snapshot = [...input];
    seededShuffle(input, 'seed');
    expect(input).toEqual(snapshot);
  });

  it('returns a copy for single-element and empty arrays', () => {
    expect(seededShuffle([], 'seed')).toEqual([]);
    expect(seededShuffle(['only'], 'seed')).toEqual(['only']);
  });

  it('handles 2-element arrays (true/false choices)', () => {
    const tf = ['True', 'False'];
    const a = seededShuffle(tf, 'p:0');
    const cmp = (x: string, y: string) => x.localeCompare(y);
    expect([...a].sort(cmp)).toEqual([...tf].sort(cmp));
  });
});
