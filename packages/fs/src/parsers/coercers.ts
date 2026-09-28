/**
 * Shared frontmatter coercers. Parsers read untyped YAML values and must coerce
 * them into domain types defensively (malformed files are tolerated, not
 * fatal). These helpers centralize the coercion logic that was previously
 * duplicated across every entity parser.
 */

import type { Rule } from "@frame/core";

export function toDate(val: unknown): Date {
  if (val instanceof Date) return val;
  if (typeof val === "string" || typeof val === "number") {
    const d = new Date(val);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

export function toDateOrNull(val: unknown): Date | null {
  if (val instanceof Date) return val;
  if (typeof val === "string" || typeof val === "number") {
    const d = new Date(val);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

export function toNumber(val: unknown): number {
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (typeof val === "string") {
    const n = Number(val);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

export function toNumberOrNull(val: unknown): number | null {
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (typeof val === "string" && val.length > 0) {
    const n = Number(val);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function toStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.filter((v): v is string => typeof v === "string");
}

export function toStringOrNull(val: unknown): string | null {
  if (typeof val === "string" && val.length > 0) return val;
  return null;
}

/** Coerce to one of a known set of enum values, falling back to a default. */
export function toEnumValue<T extends string>(val: unknown, valid: readonly T[], dflt: T): T {
  if (typeof val === "string" && (valid as readonly string[]).includes(val)) {
    return val as T;
  }
  return dflt;
}

/** Coerce a string into a branded id via its `from` constructor, or null. */
export function toIdOrNull<T>(val: unknown, from: (s: string) => T): T | null {
  if (typeof val !== "string" || val.length === 0) return null;
  try {
    return from(val);
  } catch {
    return null;
  }
}

/** Coerce an array of strings into branded ids, dropping any that fail. */
export function toIdArray<T>(val: unknown, from: (s: string) => T): T[] {
  if (!Array.isArray(val)) return [];
  return val.flatMap((v) => {
    const id = toIdOrNull(v, from);
    return id !== null ? [id] : [];
  });
}

/** Coerce a YAML array into well-formed inline rules, dropping malformed ones. */
export function toRuleArray(val: unknown): Rule[] {
  if (!Array.isArray(val)) return [];
  return val.filter(
    (v): v is Rule =>
      typeof v === "object" &&
      v !== null &&
      typeof (v as Record<string, unknown>).trigger === "string" &&
      typeof (v as Record<string, unknown>).instruction === "string"
  );
}
