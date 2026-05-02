export function extractJSON(content: string): string {
  const fenced = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenced) return fenced[1].trim();

  const braceIdx = content.indexOf('{');
  if (braceIdx === -1) throw new Error('No JSON object found in LLM response');

  let depth = 0;
  for (let i = braceIdx; i < content.length; i++) {
    if (content[i] === '{') depth++;
    else if (content[i] === '}') depth--;
    if (depth === 0) return content.slice(braceIdx, i + 1);
  }

  throw new Error('Unterminated JSON object in LLM response');
}
