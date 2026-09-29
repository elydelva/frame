import { type EstimationScale, type RealmConfig, resolveEstimate } from "@frame/core";
import { writeRealmConfig } from "@frame/fs";
import type { Container } from "../container.js";
import { setJsonMode } from "./json-mode.js";
import { getFormatter } from "./output.js";
import { fail } from "./shared.js";

const SCALES: readonly EstimationScale[] = [
  "none",
  "linear",
  "fibonacci",
  "tshirt",
  "exponential",
  "hours",
];

/** Read a dotted path out of the config object, or undefined if absent. */
function getPath(config: RealmConfig, key: string): unknown {
  return key.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object" && part in acc) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, config);
}

export async function runConfigGet(
  container: Container,
  key: string | undefined,
  opts: { json?: boolean }
): Promise<void> {
  setJsonMode(opts.json ?? false);
  const value = key ? getPath(container.config, key) : container.config;
  if (key && value === undefined) fail(`Unknown config key: ${key}`);

  getFormatter(opts.json ?? false).emit({
    json: value,
    human: () => console.log(typeof value === "string" ? value : JSON.stringify(value, null, 2)),
  });
}

/**
 * Set a whitelisted scalar config key and persist `.frameconfig`. Only safe,
 * non-structural keys are writable here; edit the YAML directly for the rest.
 */
export async function runConfigSet(
  container: Container,
  key: string,
  value: string,
  opts: { json?: boolean }
): Promise<void> {
  setJsonMode(opts.json ?? false);
  const config = container.config;
  const next: RealmConfig = structuredClone(config);

  switch (key) {
    case "priority.default":
      if (!config.priority.levels.includes(value)) {
        fail(`Invalid priority: ${value} (expected ${config.priority.levels.join("|")})`);
      }
      next.priority.default = value;
      break;
    case "estimation.scale": {
      if (!(SCALES as readonly string[]).includes(value)) {
        fail(`Invalid scale: ${value} (expected ${SCALES.join("|")})`);
      }
      next.estimation.scale = value as EstimationScale;
      break;
    }
    case "estimation.default": {
      if (value === "none" || value === "") {
        next.estimation.default = null;
      } else {
        try {
          next.estimation.default = resolveEstimate(next, value);
        } catch (err) {
          fail(err instanceof Error ? err.message : String(err));
        }
      }
      break;
    }
    default:
      fail(
        `Unsupported config key: ${key} (settable: priority.default, estimation.scale, estimation.default)`
      );
  }

  await writeRealmConfig(container.realmRoot, next);

  getFormatter(opts.json ?? false).emit({
    json: { key, value: getPath(next, key) },
    human: () => console.log(`✓ ${key} = ${value}`),
  });
}
