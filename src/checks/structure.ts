import type { Container } from '../model.js';
import { macroRefs, resolveConstant, tagLabel, tagTriggers, variableLabel } from '../resolve.js';
import type { Finding } from './types.js';

/** GA4 event tags that send to an ID no Google tag in this container configures. */
export function checkMeasurementIds(container: Container): Finding[] {
  const configured = new Set<string>();
  container.tags.forEach((tag) => {
    if (tag.function !== '__googtag') return;
    const id = resolveConstant(container, tag.vtp_tagId);
    if (id) configured.add(id);
  });
  const orphans = new Map<string, string[]>();
  container.tags.forEach((tag, index) => {
    if (tag.function !== '__gaawe') return;
    const id = resolveConstant(container, tag.vtp_measurementIdOverride);
    if (!id || configured.has(id)) return;
    const list = orphans.get(id) ?? [];
    list.push(tagLabel(container, tag, index));
    orphans.set(id, list);
  });
  return [...orphans].map(([id, tags]) => ({
    severity: 'warn' as const,
    code: 'ga4-id-without-google-tag',
    title: `${tags.length} GA4 event tag(s) send to ${id}, but no Google tag configures it`,
    detail: 'Settings on the Google tag (server URL, user properties, consent defaults) will not apply to these events.',
    items: tags,
  }));
}

export function checkDuplicateGoogleTags(container: Container): Finding[] {
  const byId = new Map<string, string[]>();
  container.tags.forEach((tag, index) => {
    if (tag.function !== '__googtag') return;
    const id = resolveConstant(container, tag.vtp_tagId) ?? '(dynamic)';
    const list = byId.get(id) ?? [];
    list.push(tagLabel(container, tag, index));
    byId.set(id, list);
  });
  return [...byId]
    .filter(([, tags]) => tags.length > 1)
    .map(([id, tags]) => ({
      severity: 'warn' as const,
      code: 'duplicate-google-tag',
      title: `${tags.length} Google tags configure ${id}`,
      detail: 'If their triggers overlap, page views and sessions can be counted twice.',
      items: tags,
    }));
}

export function checkPausedTags(container: Container): Finding[] {
  const paused = container.tags
    .map((tag, index) => ({ tag, index }))
    .filter(({ tag }) => tag.function === '__paused')
    .map(({ tag, index }) => tagLabel(container, tag, index));
  if (paused.length === 0) return [];
  return [
    {
      severity: 'info',
      code: 'paused-tags',
      title: `${paused.length} paused tag(s) are still published`,
      items: paused,
    },
  ];
}

/** Tags with no firing rule and not used as setup/teardown of another tag. */
export function checkTagsWithoutTriggers(container: Container): Finding[] {
  const triggers = tagTriggers(container);
  const sequenced = new Set<number>();
  for (const tag of container.tags) {
    for (const field of ['setup_tags', 'teardown_tags']) {
      const value = tag[field];
      if (!Array.isArray(value)) continue;
      for (const item of value.flat(3)) if (typeof item === 'number') sequenced.add(item);
    }
  }
  const idle = container.tags
    .map((tag, index) => ({ tag, index }))
    .filter(({ tag, index }) => tag.function !== '__paused' && !triggers.get(index)?.fire.length && !sequenced.has(index))
    .map(({ tag, index }) => tagLabel(container, tag, index));
  if (idle.length === 0) return [];
  return [
    {
      severity: 'info',
      code: 'tags-never-fire',
      title: `${idle.length} tag(s) have no firing trigger`,
      items: idle,
    },
  ];
}

/**
 * Variables nothing reaches. The compiler already drops most unused variables,
 * so the ones left are usually referenced only by paused tags — or by nothing,
 * when a container was copied from another one.
 */
export function checkUnusedVariables(container: Container): Finding[] {
  const reachable = new Set<number>();
  const queue: number[] = [];
  const visit = (value: unknown) => {
    for (const ref of macroRefs(value)) {
      if (!reachable.has(ref)) {
        reachable.add(ref);
        queue.push(ref);
      }
    }
  };
  container.tags.forEach((tag) => {
    if (tag.function !== '__paused') visit(tag);
  });
  for (const predicate of container.predicates) visit(predicate);
  while (queue.length) {
    const macro = container.macros[queue.pop()!];
    if (macro) visit(macro);
  }
  const unused = container.macros
    .map((_, index) => index)
    .filter((index) => !reachable.has(index))
    .map((index) => variableLabel(container, index));
  if (unused.length === 0) return [];
  // Settings variables that nothing uses but still hold a server URL are worth calling out.
  const staleServerUrl = container.macros
    .map((macro, index) => ({ macro, index }))
    .filter(({ macro, index }) => !reachable.has(index) && /server_container_url/.test(JSON.stringify(macro)))
    .map(({ index }) => variableLabel(container, index));
  const findings: Finding[] = [
    {
      severity: 'info',
      code: 'unused-variables',
      title: `${unused.length} variable(s) are not used by any active tag or trigger`,
      items: unused,
    },
  ];
  if (staleServerUrl.length) {
    findings.push({
      severity: 'info',
      code: 'unused-server-url-variable',
      title: 'An unused settings variable still holds a server_container_url',
      detail: 'Harmless today, but attaching it to a tag later will route hits to that URL.',
      items: staleServerUrl,
    });
  }
  return findings;
}
