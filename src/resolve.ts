import type { Container, RawEntity, RawPredicate } from './model.js';

function isTagged(value: unknown, tag: string): value is [string, ...unknown[]] {
  return Array.isArray(value) && value[0] === tag;
}

export function macroIndex(value: unknown): number | undefined {
  return isTagged(value, 'macro') && typeof value[1] === 'number' ? value[1] : undefined;
}

/** Every macro index referenced anywhere inside a value (one level — not transitive). */
export function macroRefs(value: unknown, out: Set<number> = new Set()): Set<number> {
  const index = macroIndex(value);
  if (index !== undefined) {
    out.add(index);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) macroRefs(item, out);
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) macroRefs(item, out);
  }
  return out;
}

/**
 * Resolve a value to a string when it is knowable without running the page:
 * literals, constant variables, and templates built only from those.
 * Returns undefined for anything that depends on the page (dataLayer, URL, JS).
 */
export function resolveConstant(container: Container, value: unknown, depth = 0): string | undefined {
  if (depth > 10) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  const index = macroIndex(value);
  if (index !== undefined) {
    const macro = container.macros[index];
    if (macro?.function === '__c') return resolveConstant(container, macro.vtp_value, depth + 1);
    return undefined;
  }
  if (isTagged(value, 'template')) {
    const parts = value.slice(1).map((part) => resolveConstant(container, part, depth + 1));
    return parts.every((part) => part !== undefined) ? parts.join('') : undefined;
  }
  if (isTagged(value, 'escape')) return resolveConstant(container, value[1], depth + 1);
  return undefined;
}

export interface Setting {
  key: string;
  value: unknown;
  /** Where the row lives: the tag itself, or a settings variable (macro index). */
  from: { kind: 'tag' } | { kind: 'variable'; macro: number };
}

/** ["list", ["map", "parameter", k, "parameterValue", v], ...] → rows */
export function settingsRows(table: unknown): Array<{ key: string; value: unknown }> {
  if (!isTagged(table, 'list')) return [];
  const rows: Array<{ key: string; value: unknown }> = [];
  for (const entry of table.slice(1)) {
    if (!isTagged(entry, 'map')) continue;
    const fields: Record<string, unknown> = {};
    for (let i = 1; i + 1 < entry.length; i += 2) {
      fields[String(entry[i])] = entry[i + 1];
    }
    const key = fields.parameter ?? fields.name ?? fields.key;
    if (typeof key === 'string') rows.push({ key, value: fields.parameterValue ?? fields.value });
  }
  return rows;
}

const TABLE_FIELDS = ['vtp_configSettingsTable', 'vtp_eventSettingsTable', 'vtp_fieldsToSet'];
const VARIABLE_FIELDS = ['vtp_configSettingsVariable', 'vtp_eventSettingsVariable'];

/** All settings a tag sends: its own tables plus any settings variables it uses. */
export function tagSettings(container: Container, tag: RawEntity): Setting[] {
  const out: Setting[] = [];
  for (const field of TABLE_FIELDS) {
    for (const row of settingsRows(tag[field])) out.push({ ...row, from: { kind: 'tag' } });
  }
  for (const field of VARIABLE_FIELDS) {
    const index = macroIndex(tag[field]);
    if (index === undefined) continue;
    const macro = container.macros[index];
    if (!macro) continue;
    for (const tableField of TABLE_FIELDS) {
      for (const row of settingsRows(macro[tableField])) {
        out.push({ ...row, from: { kind: 'variable', macro: index } });
      }
    }
  }
  return out;
}

const TAG_TYPES: Record<string, string> = {
  __googtag: 'Google tag',
  __gaawe: 'GA4 event',
  __gaawc: 'GA4 config (legacy)',
  __ua: 'Universal Analytics',
  __awct: 'Google Ads conversion',
  __sp: 'Google Ads remarketing',
  __gclidw: 'Conversion linker',
  __flc: 'Floodlight counter',
  __fls: 'Floodlight sales',
  __html: 'Custom HTML',
  __img: 'Custom image',
  __paused: 'Paused',
  __cl: 'Click listener',
  __lcl: 'Link click listener',
  __hl: 'History listener',
  __fsl: 'Form submit listener',
  __sdl: 'Scroll depth listener',
  __evl: 'Element visibility listener',
  __tl: 'Timer listener',
  __ytl: 'YouTube listener',
};

export function tagType(tag: RawEntity): string {
  if (tag.function.startsWith('__cvt_')) return 'Custom template';
  return TAG_TYPES[tag.function] ?? tag.function;
}

/** Best-effort human name: event name for GA4 events, tag id otherwise. */
export function tagLabel(container: Container, tag: RawEntity, index: number): string {
  const type = tag.function === '__paused' ? `Paused ${String(tag.vtp_originalTagType ?? '')}` : tagType(tag);
  const event = resolveConstant(container, tag.vtp_eventName);
  const id = tag.tag_id ?? index;
  return event ? `${type} "${event}" (#${id})` : `${type} (#${id})`;
}

const VARIABLE_TYPES: Record<string, string> = {
  __e: 'Event',
  __c: 'Constant',
  __v: 'Data layer',
  __u: 'URL',
  __jsm: 'Custom JS',
  __j: 'JS variable',
  __k: 'Cookie',
  __aev: 'Auto-event',
  __gtcs: 'Google tag config settings',
  __gtes: 'Google tag event settings',
  __smm: 'Lookup table',
  __remm: 'Regex table',
  __f: 'Referrer',
  __ctv: 'Container version',
  __cid: 'Container ID',
  __dbg: 'Debug mode',
  __r: 'Random number',
};

export function variableLabel(container: Container, index: number): string {
  const macro = container.macros[index];
  if (!macro) return `macro #${index}`;
  const type = macro.function.startsWith('__cvt_') ? 'Custom template' : VARIABLE_TYPES[macro.function] ?? macro.function;
  if (macro.function === '__v' && typeof macro.vtp_name === 'string') return `${type} "${macro.vtp_name}"`;
  if (macro.function === '__c') return `${type} "${String(macro.vtp_value)}"`;
  if (macro.function === '__u' && typeof macro.vtp_component === 'string') return `${type} ${macro.vtp_component}`;
  if (macro.function === '__e') return 'Event';
  return `${type} (macro #${index})`;
}

const OPERATORS: Record<string, string> = {
  _eq: 'equals',
  _cn: 'contains',
  _re: 'matches',
  _sw: 'starts with',
  _ew: 'ends with',
  _lt: '<',
  _le: '<=',
  _gt: '>',
  _ge: '>=',
  _css: 'matches CSS',
};

function operand(container: Container, value: unknown): string {
  const index = macroIndex(value);
  if (index !== undefined) return variableLabel(container, index);
  const constant = resolveConstant(container, value);
  return constant !== undefined ? JSON.stringify(constant) : '(dynamic)';
}

export function describePredicate(container: Container, predicate: RawPredicate): string {
  const op = OPERATORS[predicate.function] ?? predicate.function;
  return `${operand(container, predicate.arg0)} ${op} ${operand(container, predicate.arg1)}`;
}

export interface Trigger {
  all: string[];
  unless: string[];
}

/** Firing and blocking conditions for each tag, from the compiled rules. */
export function tagTriggers(container: Container): Map<number, { fire: Trigger[]; block: Trigger[] }> {
  const out = new Map<number, { fire: Trigger[]; block: Trigger[] }>();
  const entry = (tag: number) => {
    let value = out.get(tag);
    if (!value) {
      value = { fire: [], block: [] };
      out.set(tag, value);
    }
    return value;
  };
  for (const rule of container.rules) {
    const describe = (kind: string) =>
      rule
        .filter((clause) => clause[0] === kind)
        .flatMap((clause) => clause.slice(1) as number[])
        .map((p) => {
          const predicate = container.predicates[p];
          return predicate ? describePredicate(container, predicate) : `predicate #${p}`;
        });
    const trigger: Trigger = { all: describe('if'), unless: describe('unless') };
    for (const clause of rule) {
      if (clause[0] === 'add') for (const tag of clause.slice(1) as number[]) entry(tag).fire.push(trigger);
      if (clause[0] === 'block') for (const tag of clause.slice(1) as number[]) entry(tag).block.push(trigger);
    }
  }
  return out;
}
