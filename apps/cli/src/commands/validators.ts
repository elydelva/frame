import { ProjectId, type RealmConfig, resolveEstimate as coreResolveEstimate } from "@frame/core";
import { fail } from "./shared.js";

/** Require a CLI option to be present, failing with `<name> is required`. */
export function requireOption(value: string | undefined, name: string): string {
  if (value === undefined) {
    fail(`${name} is required`);
  }
  return value;
}

/** Require and parse a `--project` option into a ProjectId. */
export function parseProjectId(raw: string | undefined): ProjectId {
  return ProjectId.from(requireOption(raw, "--project"));
}

/**
 * Resolve the issue priority: the configured default when omitted, otherwise
 * validate the provided value against the configured levels.
 */
export function resolvePriority(priority: string | undefined, config: RealmConfig): string {
  const { levels, default: defaultPriority } = config.priority;
  if (priority === undefined) {
    return defaultPriority;
  }
  if (!levels.includes(priority)) {
    fail(`Invalid --priority: ${priority} (expected ${levels.join("|")})`);
  }
  return priority;
}

/**
 * Resolve the `--estimate` option to stored points, or undefined when omitted.
 * Wraps the core resolver, surfacing its error as a CLI failure.
 */
export function resolveEstimate(
  estimate: string | undefined,
  config: RealmConfig
): number | undefined {
  if (estimate === undefined) {
    return undefined;
  }
  try {
    return coreResolveEstimate(config, estimate);
  } catch (err) {
    fail(`Invalid --estimate: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Validate labels against a non-empty label taxonomy. When the taxonomy is
 * empty, any label is allowed (free-form).
 */
export function validateLabelsAgainstTaxonomy(labels: string[], config: RealmConfig): void {
  const taxonomy = config.labels;
  if (taxonomy.length === 0) return;
  const allowed = new Set(taxonomy.map((l) => l.name));
  const unknown = labels.filter((l) => !allowed.has(l));
  if (unknown.length > 0) {
    fail(
      `Invalid --labels: ${unknown.join(", ")} (allowed: ${taxonomy.map((l) => l.name).join(", ")})`
    );
  }
}
