# gtm-lens

**English** | [한국어](README.ko.md)

**Inspect a published Google Tag Manager container from its public `gtm.js` — see where every tag sends data, and catch delivery paths that are silently broken.** No GTM account access needed.

```
$ npx gtm-lens GTM-XXXXXXX

GTM-XXXXXXX · version 84
196 tags (23 paused) · 97 variables · 109 trigger rules

Sends to
  GA4         G-XXXXXXXXXX       95 tag(s)
  Meta Pixel  1234567890123456   4 tag(s)
  Google Ads  AW-1234567890      1 tag(s)

Findings
✖ 95 tag(s) send to https://shop.example/metrics, which is not a working server container
    https://shop.example/metrics/healthy answers with an HTML page (200, text/html) —
    something other than a server container is serving this path. Hits sent there are dropped.
    · Google tag (#4)
    · GA4 event "purchase" (#28)
    … 93 more (--verbose)
▲ server_container_url is set in 2 places
    Changing it in one place leaves the others sending to the old URL.
    · Google tag config settings (macro #2)
    · Google tag event settings (macro #21)
```

## Why

After a site moved to new infrastructure, GA4 purchases dropped to zero. The browser was still sending events, and the other tags in the same container worked fine.

The cause was not visible in the GTM UI. A `server_container_url` setting routed GA4 hits to `site/metrics` (a server container) instead of Google. The migration had turned that path into the site's 404 page — which answers with status 200, so nothing anywhere reported an error. On top of that, the same setting lived in two variables: fixing one still left every ecommerce event going to the dead path.

The GTM UI makes you open tags one at a time, so questions that cut across the container — *how many tags send to this URL? is that URL even alive?* — are hard to answer. gtm-lens answers them in one command.

## What it checks

| Check | Severity | What it means |
|---|---|---|
| `server-url-broken` | error | `server_container_url` does not point at a server container (probes `/healthy`) |
| `server-url-multiple-places` | warn | The same server URL is set in several places — fixing one leaves the rest |
| `ga4-id-without-google-tag` | warn | A GA4 event tag sends to a measurement ID no Google tag configures |
| `duplicate-google-tag` | warn | Several Google tags for the same ID (risk of double counting) |
| `tags-never-fire` | info | Tags with no firing trigger |
| `paused-tags` | info | Paused tags that are still published |
| `unused-variables` | info | Variables no active tag or trigger uses |
| `unused-server-url-variable` | info | An unused settings variable still holds a server URL |

The summary lists every destination the container sends to (GA4, Google Ads, Meta / TikTok / X / Kakao pixels) and a count per tag type.

GA4 event tags inherit the settings of the Google tag with the same measurement ID. gtm-lens follows that inheritance, so an event tag is counted as affected even when it sets no server URL itself.

## Usage

```bash
npx gtm-lens GTM-XXXXXXX             # container ID
npx gtm-lens https://www.example.com # every container the page loads
npx gtm-lens ./gtm.js                # a saved file

--json      JSON output (CI, other tools)
--offline   do not probe server URLs
--verbose   show every item
```

Exits with code 1 when any finding is an `error`, so it drops straight into a post-deploy check or CI.

As a library:

```ts
import { fetchContainerSource, extractContainer, inspect } from 'gtm-lens';

const container = extractContainer(await fetchContainerSource('GTM-XXXXXXX'));
const { summary, findings } = await inspect(container);
```

## Does / does not

- ✔ Reads the public `gtm.js`, rebuilds how tags, triggers and variables connect, and finds configuration problems
- ✔ Makes one request to each server container URL it finds, to check it is alive (turn off with `--offline`)
- ✘ Does not run the page in a browser — use GTM Preview to see what actually fired
- ✘ Does not change anything in GTM
- ✘ Does not analyse collected data (GA4 reports and so on)

## Caveats

The data format inside `gtm.js` is not documented by Google and can change. When it does, gtm-lens reports what it could read instead of failing. If a result looks wrong, please open an issue.

Please do not use it to crawl other people's sites in bulk. gtm-lens only requests the container you name and the server URLs that container points to.

## Development

```bash
npm install
npm test          # node:test with a synthetic container fixture
npm run dev -- GTM-XXXXXXX
npm run build
```

## Roadmap

- `gtm-lens diff` — what changed between two published versions
- Watch mode — fetch daily, alert on change (GitHub Actions example)
- MCP server — let AI agents inspect containers with the same engine
- Consent mode analysis

## License

MIT
