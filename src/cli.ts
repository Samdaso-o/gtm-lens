#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { extractContainer, fetchContainerSource, findContainerIds, inspect, isContainerId } from './index.js';
import { renderText } from './render.js';

const HELP = `gtm-lens — inspect a published Google Tag Manager container

Usage
  gtm-lens <GTM-XXXX | https://site | ./gtm.js> [options]

Options
  --json       print the report as JSON
  --offline    do not probe server container URLs
  --verbose    show every finding and every item
  -h, --help   show this help

Exit code is 1 when any finding has severity "error".`;

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      json: { type: 'boolean', default: false },
      offline: { type: 'boolean', default: false },
      verbose: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  const target = positionals[0];
  if (values.help || !target) {
    console.log(HELP);
    return target ? 0 : 2;
  }

  const sources: Array<{ id?: string; text: string }> = [];
  if (isContainerId(target)) {
    sources.push({ id: target, text: await fetchContainerSource(target) });
  } else if (/^https?:\/\//.test(target)) {
    const ids = await findContainerIds(target);
    if (ids.length === 0) {
      console.error(`No GTM container found in the HTML of ${target}.`);
      return 2;
    }
    for (const id of ids) sources.push({ id, text: await fetchContainerSource(id) });
  } else {
    sources.push({ text: await readFile(target, 'utf8') });
  }

  let failed = false;
  const reports = [];
  for (const source of sources) {
    const report = await inspect(extractContainer(source.text, source.id), { network: !values.offline });
    failed ||= report.findings.some((f) => f.severity === 'error');
    reports.push(report);
  }

  if (values.json) {
    console.log(JSON.stringify(reports.length === 1 ? reports[0] : reports, null, 2));
  } else {
    console.log(reports.map((r) => renderText(r, { verbose: values.verbose })).join('\n\n'));
  }
  return failed ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  },
);
