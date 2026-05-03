import { describe, it, expect } from 'vitest';
import { extractJSON } from './extract-json.js';

describe('extractJSON', () => {
  it('returns clean JSON as-is', () => {
    const input = '{"questions":[]}';
    expect(extractJSON(input)).toBe('{"questions":[]}');
  });

  it('extracts JSON from markdown code fence', () => {
    const input = '```json\n{"questions":[]}\n```';
    expect(extractJSON(input)).toBe('{"questions":[]}');
  });

  it('extracts JSON from code fence without language tag', () => {
    const input = '```\n{"questions":[]}\n```';
    expect(extractJSON(input)).toBe('{"questions":[]}');
  });

  it('extracts JSON from text with preamble', () => {
    const input = "Here's a JSON object for you:\n{\"questions\":[]}";
    expect(extractJSON(input)).toBe('{"questions":[]}');
  });

  it('extracts JSON from text with preamble and postamble', () => {
    const input = "Sure! Here it is:\n{\"questions\":[]}\nHope that helps!";
    expect(extractJSON(input)).toBe('{"questions":[]}');
  });

  it('throws when no JSON object found', () => {
    expect(() => extractJSON('no json here')).toThrow('No JSON object found');
  });

  it('throws on unterminated JSON', () => {
    expect(() => extractJSON('{"questions":[]')).toThrow('Unterminated JSON');
  });
});
