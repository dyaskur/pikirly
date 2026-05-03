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

  it('ignores braces inside quoted strings', () => {
    const input = '{"text": "use { and } in questions"}';
    expect(extractJSON(input)).toBe('{"text": "use { and } in questions"}');
  });

  it('ignores braces inside nested quoted strings', () => {
    const input = '{"questions":[{"text":"a {b} c","choices":["x","y","z","w"],"correct":0,"id":"1","limitMs":20000}]}';
    expect(JSON.parse(extractJSON(input)).questions[0].text).toBe('a {b} c');
  });

  it('handles escaped quotes inside strings', () => {
    const input = '{"text": "say \\"hello\\" with {braces}"}';
    expect(JSON.parse(extractJSON(input)).text).toBe('say "hello" with {braces}');
  });

  it('extracts JSON with braces in strings from text with preamble', () => {
    const input = 'Here you go:\n{"text":"use {curly} braces"}\nEnjoy!';
    expect(extractJSON(input)).toBe('{"text":"use {curly} braces"}');
  });
});
