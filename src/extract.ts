import type { Container, RawResource } from './model.js';

export class ExtractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExtractError';
  }
}

/**
 * Find the JSON value that starts at `start` (an `{` or `[`) and return its end
 * index (exclusive). Strings are skipped so brackets inside them do not count.
 */
function scanBalanced(text: string, start: number): number {
  const open = text[start];
  if (open !== '{' && open !== '[') {
    throw new ExtractError(`expected { or [ at ${start}`);
  }
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === '\\') {
        i++;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === '{' || ch === '[') {
      depth++;
    } else if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 0) {
        return i + 1;
      }
    }
  }
  throw new ExtractError('unbalanced JSON block');
}

/** Pull the `"resource": {...}` block out of a gtm.js file and parse it. */
export function extractContainer(source: string, id?: string): Container {
  const marker = source.search(/"resource"\s*:\s*\{/);
  if (marker < 0) {
    throw new ExtractError('no "resource" block — is this a gtm.js file?');
  }
  const start = source.indexOf('{', marker);
  const end = scanBalanced(source, start);
  let resource: Partial<RawResource>;
  try {
    resource = JSON.parse(source.slice(start, end)) as Partial<RawResource>;
  } catch (error) {
    throw new ExtractError(`resource block is not valid JSON: ${String(error)}`);
  }
  return {
    id: id ?? source.match(/GTM-[A-Z0-9]{4,10}/)?.[0],
    version: resource.version,
    macros: resource.macros ?? [],
    tags: resource.tags ?? [],
    predicates: resource.predicates ?? [],
    rules: resource.rules ?? [],
    source,
  };
}
