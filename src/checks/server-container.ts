import type { Container } from '../model.js';
import { resolveConstant, tagLabel, tagSettings, variableLabel } from '../resolve.js';
import type { CheckOptions, Finding } from './types.js';

interface Route {
  url: string | undefined;
  /** Human-readable places the setting is written (tag itself or a settings variable). */
  places: Set<string>;
  tags: number[];
}

/**
 * Server-side tagging: Google tags can send hits to a server container
 * (`server_container_url`) instead of google-analytics.com. If that URL stops
 * pointing at the server container — a domain move, a CDN switch — every hit
 * is lost silently: the browser gets a 200 from whatever answers there now.
 */
export function serverRoutes(container: Container): Route[] {
  const routes = new Map<string, Route>();
  const add = (key: string, url: string | undefined, index: number, place?: string) => {
    const route = routes.get(key) ?? { url, places: new Set<string>(), tags: [] };
    if (place) route.places.add(place);
    if (!route.tags.includes(index)) route.tags.push(index);
    routes.set(key, route);
  };
  // Measurement ID → route key, for settings set on a Google tag.
  const inherited = new Map<string, string>();

  container.tags.forEach((tag, index) => {
    if (tag.function === '__paused') return;
    for (const setting of tagSettings(container, tag)) {
      if (setting.key !== 'server_container_url' && setting.key !== 'transport_url') continue;
      const url = resolveConstant(container, setting.value);
      const key = url ?? '(dynamic)';
      const place =
        setting.from.kind === 'tag'
          ? `${tagLabel(container, tag, index)} settings`
          : variableLabel(container, setting.from.macro);
      add(key, url, index, place);
      if (tag.function === '__googtag') {
        const id = resolveConstant(container, tag.vtp_tagId);
        if (id) inherited.set(id, key);
      }
    }
  });

  // GA4 event tags inherit the Google tag's settings for the same measurement ID,
  // so they use its server URL even when they set nothing themselves.
  container.tags.forEach((tag, index) => {
    if (tag.function !== '__gaawe') return;
    const id = resolveConstant(container, tag.vtp_measurementIdOverride);
    const key = id ? inherited.get(id) : undefined;
    if (key) add(key, routes.get(key)?.url, index);
  });
  return [...routes.values()];
}

export type ProbeResult =
  | { ok: true; status: number }
  | { ok: false; status?: number; reason: string };

/** A server container answers GET /healthy with 200 and the body "ok". */
export async function probeServerContainer(url: string, options: CheckOptions): Promise<ProbeResult> {
  const target = `${url.replace(/\/+$/, '')}/healthy`;
  try {
    const response = await options.fetch(target, {
      redirect: 'follow',
      signal: AbortSignal.timeout(options.timeoutMs),
    });
    const body = (await response.text()).trim();
    if (response.status === 200 && body === 'ok') return { ok: true, status: 200 };
    const type = response.headers.get('content-type') ?? 'unknown type';
    const looksLikePage = /<html|<!doctype/i.test(body);
    return {
      ok: false,
      status: response.status,
      reason: looksLikePage
        ? `answers with an HTML page (${response.status}, ${type}) — something other than a server container is serving this path`
        : `unexpected response ${response.status} (${type})`,
    };
  } catch (error) {
    return { ok: false, reason: `request failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export async function checkServerContainer(container: Container, options: CheckOptions): Promise<Finding[]> {
  const findings: Finding[] = [];
  for (const route of serverRoutes(container)) {
    const affected = route.tags.map((t) => tagLabel(container, container.tags[t]!, t));
    const places = [...route.places];

    if (places.length > 1) {
      findings.push({
        severity: 'warn',
        code: 'server-url-multiple-places',
        title: `server_container_url is set in ${places.length} places`,
        detail: 'Changing it in one place leaves the others sending to the old URL.',
        items: places,
      });
    }

    if (!route.url) {
      findings.push({
        severity: 'info',
        code: 'server-url-dynamic',
        title: 'server_container_url is computed at runtime — cannot verify it statically',
        items: affected,
      });
      continue;
    }

    if (!options.network) {
      findings.push({
        severity: 'info',
        code: 'server-url-unchecked',
        title: `${route.tags.length} tag(s) send through ${route.url} (not probed: --offline)`,
        items: affected,
      });
      continue;
    }

    const probe = await probeServerContainer(route.url, options);
    if (probe.ok) {
      findings.push({
        severity: 'info',
        code: 'server-url-healthy',
        title: `${route.tags.length} tag(s) send through ${route.url} — server container is healthy`,
      });
    } else {
      findings.push({
        severity: 'error',
        code: 'server-url-broken',
        title: `${route.tags.length} tag(s) send to ${route.url}, which is not a working server container`,
        detail: `${route.url}/healthy ${probe.reason}. Hits sent there are dropped.`,
        items: affected,
      });
    }
  }
  return findings;
}
