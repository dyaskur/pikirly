export function extractJSON(content: string): string {
  const fenced = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenced) return fenced[1].trim();

  const braceIdx = content.indexOf('{');
  if (braceIdx === -1) throw new Error('No JSON object found in LLM response');

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = braceIdx; i < content.length; i++) {
    const ch = content[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    if (depth === 0) return content.slice(braceIdx, i + 1);
  }

  throw new Error('Unterminated JSON object in LLM response');
}
