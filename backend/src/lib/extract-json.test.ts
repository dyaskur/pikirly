import { describe, it, expect } from 'vitest';
import { extractJSON } from './extract-json.js';

describe('extractJSON', () => {
  it('returns clean JSON as-is', () => {
    const input = '{"title":"Geography","count":3}';
    expect(extractJSON(input)).toBe('{"title":"Geography","count":3}');
  });

  it('extracts JSON from markdown code fence', () => {
    const inner = '{"questions":[{"text":"Capital of France?","correct":0}]}';
    expect(extractJSON('```json\n' + inner + '\n```')).toBe(inner);
  });

  it('extracts JSON from code fence without language tag', () => {
    const inner = '{"difficulty":"easy","tags":["history","ww2"]}';
    expect(extractJSON('```\n' + inner + '\n```')).toBe(inner);
  });

  it('extracts JSON from text with preamble', () => {
    const inner = '{"meta":{"model":"gpt-4","tokens":127}}';
    expect(extractJSON("Here's a JSON object for you:\n" + inner)).toBe(inner);
  });

  it('extracts JSON from text with preamble and postamble', () => {
    const inner = '{"items":[1,2,3],"ok":true}';
    expect(extractJSON('Sure! Here it is:\n' + inner + '\nHope that helps!')).toBe(inner);
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

  it('handles complex nested structure inside a string', () => {
    const input = 'Pre: {"data": "A string with { brackets } and \\"escaped quotes\\" inside."} Post';
    const extracted = extractJSON(input);
    expect(extracted).toBe('{"data": "A string with { brackets } and \\"escaped quotes\\" inside."}');
    expect(() => JSON.parse(extracted)).not.toThrow();
  });

  it('extracts JSON with braces in strings from text with preamble', () => {
    const input = 'Here you go:\n{"text":"use {curly} braces"}\nEnjoy!';
    expect(extractJSON(input)).toBe('{"text":"use {curly} braces"}');
  });
});
