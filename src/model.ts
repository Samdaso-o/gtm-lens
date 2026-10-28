// The compiled container that gtm.js ships to every visitor.
// Google does not document this format; the shapes below are what the
// published file contains today. Everything we do not understand is kept as
// `unknown` so a format change degrades the report instead of crashing it.

/** A value inside a tag or variable: a literal, or a tagged list. */
export type Value = string | number | boolean | null | ValueList | { [key: string]: unknown };
/**
 * Tagged lists the compiler emits:
 *   ["macro", n]            reference to macros[n]
 *   ["list", a, b, ...]     array
 *   ["map", k1, v1, ...]    object
 *   ["template", p1, ...]   string concatenation
 *   ["escape", v, ...]      v with escaping applied
 */
export type ValueList = [string, ...unknown[]];

export interface RawEntity {
  function: string;
  [key: string]: unknown;
}

export interface RawPredicate {
  function: string;
  arg0?: unknown;
  arg1?: unknown;
  any_of?: boolean;
  ignore_case?: boolean;
  [key: string]: unknown;
}

/** A rule is a list of clauses such as ["if", 3, 7], ["unless", 2], ["add", 11]. */
export type RawRule = Array<[string, ...number[]]>;

export interface RawResource {
  version?: string;
  macros: RawEntity[];
  tags: RawEntity[];
  predicates: RawPredicate[];
  rules: RawRule[];
}

export interface Container {
  id?: string;
  version?: string;
  macros: RawEntity[];
  tags: RawEntity[];
  predicates: RawPredicate[];
  rules: RawRule[];
  /** The full gtm.js text, kept for lookups the structured part does not cover. */
  source: string;
}
