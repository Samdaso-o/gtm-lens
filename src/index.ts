import { checkServerContainer } from './checks/server-container.js';
import {
  checkDuplicateGoogleTags,
  checkMeasurementIds,
  checkPausedTags,
  checkTagsWithoutTriggers,
  checkUnusedVariables,
} from './checks/structure.js';
import type { CheckOptions, Finding } from './checks/types.js';
import { extractContainer } from './extract.js';
import type { Container } from './model.js';
import { type Summary, summarize } from './summary.js';

export { extractContainer, ExtractError } from './extract.js';
export { fetchContainerSource, findContainerIds, isContainerId } from './fetch.js';
export { serverRoutes, probeServerContainer } from './checks/server-container.js';
export { tagTriggers, tagLabel, tagSettings, resolveConstant } from './resolve.js';
export { summarize } from './summary.js';
export type { Container } from './model.js';
export type { Finding, Severity } from './checks/types.js';
export type { Summary, Destination } from './summary.js';

export interface Report {
  summary: Summary;
  findings: Finding[];
}

const ORDER = { error: 0, warn: 1, info: 2 } as const;

export async function inspect(container: Container, options: Partial<CheckOptions> = {}): Promise<Report> {
  const opts: CheckOptions = {
    network: options.network ?? true,
    fetch: options.fetch ?? fetch,
    timeoutMs: options.timeoutMs ?? 10_000,
  };
  const findings = [
    ...(await checkServerContainer(container, opts)),
    ...checkMeasurementIds(container),
    ...checkDuplicateGoogleTags(container),
    ...checkTagsWithoutTriggers(container),
    ...checkPausedTags(container),
    ...checkUnusedVariables(container),
  ].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
  return { summary: summarize(container), findings };
}

export async function inspectSource(source: string, options: Partial<CheckOptions> = {}): Promise<Report> {
  return inspect(extractContainer(source), options);
}
