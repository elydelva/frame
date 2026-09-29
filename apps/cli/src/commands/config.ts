import type { RealmConfig } from "@frame/core";
import { FrameInputError } from "@frame/sdk";
import type { Container } from "../container.js";
import { setJsonMode } from "./json-mode.js";
import { getFormatter } from "./output.js";
import { fail } from "./shared.js";

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
  const config = await container.frame.config.get();
  const value = key ? getPath(config, key) : config;
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
  try {
    await container.frame.config.set(key, value);
  } catch (error) {
    if (error instanceof FrameInputError) fail(error.message);
    throw error;
  }
  const next = await container.frame.config.get();

  getFormatter(opts.json ?? false).emit({
    json: { key, value: getPath(next, key) },
    human: () => console.log(`✓ ${key} = ${value}`),
  });
}
