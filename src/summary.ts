import type { Container } from './model.js';
import { resolveConstant, tagType } from './resolve.js';

export interface Destination {
  vendor: string;
  id: string;
  /** Tag indices that send to this destination. */
  tags: number[];
}

export interface Summary {
  id?: string;
  version?: string;
  counts: { tags: number; paused: number; variables: number; triggers: number };
  tagTypes: Record<string, number>;
  destinations: Destination[];
}

// IDs we can read out of custom HTML or template fields. Ordered: first match wins per string.
const ID_PATTERNS: Array<{ vendor: string; re: RegExp }> = [
  { vendor: 'GA4', re: /\b(G-[A-Z0-9]{6,12})\b/g },
  { vendor: 'Google Ads', re: /\b(AW-\d{6,12})\b/g },
  { vendor: 'Meta Pixel', re: /fbq\(\s*\\?["']init\\?["']\s*,\s*\\?["'](\d{10,20})/g },
  { vendor: 'TikTok Pixel', re: /ttq\.load\(\s*\\?["']([A-Z0-9]{10,30})/g },
  { vendor: 'X (Twitter) Pixel', re: /twq\(\s*\\?["']config\\?["']\s*,\s*\\?["']([a-z0-9]{4,10})/g },
  { vendor: 'Kakao Pixel', re: /kakaoPixel\(\s*\\?["'](\d{10,25})/g },
];

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const item of value) collectStrings(item, out);
  else if (value && typeof value === 'object') for (const item of Object.values(value)) collectStrings(item, out);
  return out;
}

function addDestination(map: Map<string, Destination>, vendor: string, id: string, tag: number) {
  const key = `${vendor}:${id}`;
  const entry = map.get(key) ?? { vendor, id, tags: [] };
  if (!entry.tags.includes(tag)) entry.tags.push(tag);
  map.set(key, entry);
}

export function summarize(container: Container): Summary {
  const tagTypes: Record<string, number> = {};
  const destinations = new Map<string, Destination>();

  container.tags.forEach((tag, index) => {
    const type = tagType(tag);
    tagTypes[type] = (tagTypes[type] ?? 0) + 1;
    if (tag.function === '__paused') return;

    // Structured fields first: they are exact.
    if (tag.function === '__googtag') {
      const id = resolveConstant(container, tag.vtp_tagId);
      if (id) addDestination(destinations, id.startsWith('AW-') ? 'Google Ads' : 'GA4', id, index);
    }
    if (tag.function === '__gaawe') {
      const id = resolveConstant(container, tag.vtp_measurementIdOverride);
      if (id) addDestination(destinations, 'GA4', id, index);
    }
    if (tag.function === '__awct' || tag.function === '__sp') {
      const id = resolveConstant(container, tag.vtp_conversionId);
      if (id) addDestination(destinations, 'Google Ads', id.startsWith('AW-') ? id : `AW-${id}`, index);
    }
    // Custom HTML and templates: scan their text, including constant variables they reference.
    if (tag.function === '__html' || tag.function.startsWith('__cvt_')) {
      const text = collectStrings(tag).join('\n');
      for (const { vendor, re } of ID_PATTERNS) {
        for (const match of text.matchAll(re)) if (match[1]) addDestination(destinations, vendor, match[1], index);
      }
      for (const [field, value] of Object.entries(tag)) {
        if (!/pixel/i.test(field)) continue;
        const id = resolveConstant(container, value);
        if (id && /^\d{10,20}$/.test(id)) addDestination(destinations, 'Meta Pixel', id, index);
      }
    }
  });

  return {
    id: container.id,
    version: container.version,
    counts: {
      tags: container.tags.length,
      paused: tagTypes.Paused ?? 0,
      variables: container.macros.length,
      triggers: container.rules.length,
    },
    tagTypes,
    destinations: [...destinations.values()].sort((a, b) => b.tags.length - a.tags.length),
  };
}
