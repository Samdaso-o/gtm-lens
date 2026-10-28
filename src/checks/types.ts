export type Severity = 'error' | 'warn' | 'info';

export interface Finding {
  severity: Severity;
  code: string;
  title: string;
  detail?: string;
  items?: string[];
}

export interface CheckOptions {
  /** Probe URLs found in the container (server container health). Default true. */
  network: boolean;
  fetch: typeof fetch;
  timeoutMs: number;
}
