import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { extractContainer, inspect, serverRoutes, summarize, tagTriggers } from '../src/index.js';

const source = readFileSync(new URL('./fixtures/broken-server-route.gtm.js', import.meta.url), 'utf8');
const container = extractContainer(source, 'GTM-TEST');

/** Fake network: `pages` maps URL → [status, content-type, body]. */
function fakeFetch(pages: Record<string, [number, string, string]>): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = String(input);
    const page = pages[url];
    if (!page) throw new Error(`unexpected request ${url}`);
    const [status, type, body] = page;
    return new Response(body, { status, headers: { 'content-type': type } });
  }) as typeof fetch;
}

describe('extractContainer', () => {
  it('reads the resource block even with brackets inside strings', () => {
    assert.equal(container.version, '42');
    assert.equal(container.tags.length, 9);
    assert.equal(container.macros.length, 8);
    assert.equal(container.rules.length, 4);
  });

  it('rejects files that are not gtm.js', () => {
    assert.throws(() => extractContainer('console.log(1)'), /no "resource" block/);
  });
});

describe('summarize', () => {
  it('lists destinations from structured fields, custom HTML and templates', () => {
    const summary = summarize(container);
    const ids = summary.destinations.map((d) => `${d.vendor} ${d.id}`).sort();
    assert.deepEqual(ids, ['GA4 G-OTHER00002', 'GA4 G-TEST000001', 'Meta Pixel 1234567890123456']);
    const meta = summary.destinations.find((d) => d.vendor === 'Meta Pixel');
    assert.deepEqual(meta?.tags.sort(), [4, 8]);
    assert.equal(summary.counts.paused, 1);
  });
});

describe('triggers', () => {
  it('maps tags to their firing conditions', () => {
    const triggers = tagTriggers(container);
    assert.deepEqual(triggers.get(1)?.fire[0]?.all, ['Event equals "view_item"']);
    assert.equal(triggers.get(7), undefined);
  });
});

describe('server container routes', () => {
  it('finds every place the server URL is set and every tag that uses it', () => {
    const [route, ...rest] = serverRoutes(container);
    assert.equal(rest.length, 0);
    assert.equal(route?.url, 'https://example.com/metrics');
    // 0 Google tag, 1-2 event settings variable, 3 inherits from the Google tag. 6 sends to another ID.
    assert.deepEqual(route?.tags.sort(), [0, 1, 2, 3]);
    assert.equal(route?.places.size, 2);
  });

  it('flags a server URL that answers with an HTML page', async () => {
    const report = await inspect(container, {
      fetch: fakeFetch({
        'https://example.com/metrics/healthy': [200, 'text/html; charset=utf-8', '<!DOCTYPE html><title>404</title>'],
      }),
    });
    const broken = report.findings.find((f) => f.code === 'server-url-broken');
    assert.ok(broken, 'expected server-url-broken');
    assert.equal(broken.severity, 'error');
    assert.match(broken.detail ?? '', /HTML page/);
    assert.equal(broken.items?.length, 4);
    assert.equal(report.findings[0]?.code, 'server-url-broken', 'errors sort first');
    assert.ok(report.findings.some((f) => f.code === 'server-url-multiple-places'));
  });

  it('reports a healthy server container as info', async () => {
    const report = await inspect(container, {
      fetch: fakeFetch({ 'https://example.com/metrics/healthy': [200, 'text/plain', 'ok'] }),
    });
    assert.ok(report.findings.some((f) => f.code === 'server-url-healthy'));
    assert.ok(!report.findings.some((f) => f.severity === 'error'));
  });

  it('does not touch the network with network: false', async () => {
    const report = await inspect(container, { network: false, fetch: fakeFetch({}) });
    assert.ok(report.findings.some((f) => f.code === 'server-url-unchecked'));
  });
});

describe('structure checks', () => {
  it('flags GA4 events sent to an ID with no Google tag', async () => {
    const report = await inspect(container, { network: false });
    const orphan = report.findings.find((f) => f.code === 'ga4-id-without-google-tag');
    assert.match(orphan?.title ?? '', /G-OTHER00002/);
  });

  it('flags tags that never fire, paused tags and unused variables', async () => {
    const report = await inspect(container, { network: false });
    const codes = report.findings.map((f) => f.code);
    assert.ok(codes.includes('tags-never-fire'));
    assert.ok(codes.includes('paused-tags'));
    assert.ok(codes.includes('unused-server-url-variable'));
    const never = report.findings.find((f) => f.code === 'tags-never-fire');
    assert.deepEqual(never?.items, ['Custom HTML (#17)']);
  });
});
