import type { Report } from './index.js';

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code: number) => (text: string) => (useColor ? `\x1b[${code}m${text}\x1b[0m` : text);
const red = paint(31);
const yellow = paint(33);
const dim = paint(2);
const bold = paint(1);

const MARK = { error: red('✖'), warn: yellow('▲'), info: dim('ℹ') } as const;

export function renderText(report: Report, options: { verbose?: boolean } = {}): string {
  const { summary, findings } = report;
  const lines: string[] = [];
  lines.push(bold(`${summary.id ?? 'container'} · version ${summary.version ?? '?'}`));
  lines.push(
    dim(
      `${summary.counts.tags} tags (${summary.counts.paused} paused) · ${summary.counts.variables} variables · ${summary.counts.triggers} trigger rules`,
    ),
  );
  lines.push('');

  if (summary.destinations.length) {
    lines.push(bold('Sends to'));
    const width = Math.max(...summary.destinations.map((d) => d.vendor.length));
    for (const d of summary.destinations) {
      lines.push(`  ${d.vendor.padEnd(width)}  ${d.id}  ${dim(`${d.tags.length} tag(s)`)}`);
    }
    lines.push('');
  }

  const types = Object.entries(summary.tagTypes).sort((a, b) => b[1] - a[1]);
  lines.push(bold('Tag types'));
  lines.push(`  ${types.map(([type, n]) => `${type} ${n}`).join(' · ')}`);
  lines.push('');

  if (findings.length === 0) {
    lines.push('No findings.');
  } else {
    lines.push(bold('Findings'));
    for (const f of findings) {
      lines.push(`${MARK[f.severity]} ${f.title}`);
      if (f.detail) lines.push(`    ${dim(f.detail)}`);
      const items = f.items ?? [];
      const limit = options.verbose ? items.length : 5;
      for (const item of items.slice(0, limit)) lines.push(`    · ${item}`);
      if (items.length > limit) lines.push(dim(`    … ${items.length - limit} more (--verbose)`));
    }
  }
  return lines.join('\n');
}
