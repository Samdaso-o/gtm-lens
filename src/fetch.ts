const GTM_ID = /^GTM-[A-Z0-9]{4,10}$/;

export function isContainerId(value: string): boolean {
  return GTM_ID.test(value);
}

export async function fetchContainerSource(
  id: string,
  options: { fetch?: typeof fetch; timeoutMs?: number } = {},
): Promise<string> {
  const doFetch = options.fetch ?? fetch;
  const url = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(id)}`;
  const response = await doFetch(url, { signal: AbortSignal.timeout(options.timeoutMs ?? 15_000) });
  if (!response.ok) {
    throw new Error(`gtm.js for ${id} returned ${response.status} — is the container published?`);
  }
  return response.text();
}

/** Container IDs a page loads, read from its HTML (script src and noscript iframe). */
export async function findContainerIds(
  pageUrl: string,
  options: { fetch?: typeof fetch; timeoutMs?: number } = {},
): Promise<string[]> {
  const doFetch = options.fetch ?? fetch;
  const response = await doFetch(pageUrl, {
    redirect: 'follow',
    signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; gtm-lens; +https://github.com/Samdaso-o/gtm-lens)' },
  });
  const html = await response.text();
  return [...new Set(html.match(/GTM-[A-Z0-9]{4,10}/g) ?? [])];
}
