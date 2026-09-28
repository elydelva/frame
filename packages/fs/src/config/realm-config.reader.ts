import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  DEFAULT_CONFIG,
  type EstimatePoint,
  type EstimationScale,
  type LabelConfig,
  type RealmConfig,
} from "@frame/core";
import yaml from "js-yaml";
import { CONFIG_FILE } from "../constants.js";

const VALID_SCALES: readonly EstimationScale[] = [
  "none",
  "linear",
  "fibonacci",
  "tshirt",
  "exponential",
  "hours",
];

function asRecord(val: unknown): Record<string, unknown> | null {
  return typeof val === "object" && val !== null && !Array.isArray(val)
    ? (val as Record<string, unknown>)
    : null;
}

function parseEstimateValues(val: unknown): EstimatePoint[] | undefined {
  if (!Array.isArray(val)) return undefined;
  const points: EstimatePoint[] = [];
  for (const entry of val) {
    const rec = asRecord(entry);
    if (!rec) continue;
    if (typeof rec.label === "string" && typeof rec.points === "number") {
      points.push({ label: rec.label, points: rec.points });
    }
  }
  return points.length > 0 ? points : undefined;
}

function parseEstimation(val: unknown): RealmConfig["estimation"] {
  const rec = asRecord(val);
  if (!rec) return { ...DEFAULT_CONFIG.estimation };

  const scale =
    typeof rec.scale === "string" && VALID_SCALES.includes(rec.scale as EstimationScale)
      ? (rec.scale as EstimationScale)
      : DEFAULT_CONFIG.estimation.scale;

  const def = typeof rec.default === "number" && Number.isFinite(rec.default) ? rec.default : null;

  const values = parseEstimateValues(rec.values);

  return values ? { scale, default: def, values } : { scale, default: def };
}

function parsePriority(val: unknown): RealmConfig["priority"] {
  const rec = asRecord(val);
  if (!rec) return { ...DEFAULT_CONFIG.priority };

  const levels =
    Array.isArray(rec.levels) && rec.levels.every((l) => typeof l === "string")
      ? (rec.levels as string[])
      : null;

  if (!levels || levels.length === 0) return { ...DEFAULT_CONFIG.priority };

  // `default` must be one of the levels; otherwise fall back to the first level.
  const def =
    typeof rec.default === "string" && levels.includes(rec.default)
      ? rec.default
      : (levels[0] as string);

  return { levels, default: def };
}

function parseLabels(val: unknown): LabelConfig[] {
  if (!Array.isArray(val)) return [];
  const labels: LabelConfig[] = [];
  for (const entry of val) {
    const rec = asRecord(entry);
    if (!rec || typeof rec.name !== "string") continue;
    const label: LabelConfig = { name: rec.name };
    if (typeof rec.color === "string") label.color = rec.color;
    if (typeof rec.group === "string") label.group = rec.group;
    labels.push(label);
  }
  return labels;
}

/**
 * Read `.frameconfig`, defensively. Any missing/unknown/malformed section falls
 * back to `DEFAULT_CONFIG`. Legacy ADRKit keys (`idFormat`/`types`/`templates`)
 * are simply ignored, so existing realms load with defaults — zero breakage.
 */
export async function readRealmConfig(realmRoot: string): Promise<RealmConfig> {
  const configPath = path.join(realmRoot, CONFIG_FILE);
  try {
    const raw = await fs.readFile(configPath, "utf-8");
    const parsed = yaml.load(raw);
    const rec = asRecord(parsed);
    if (!rec) return structuredClone(DEFAULT_CONFIG);

    return {
      version: typeof rec.version === "number" ? rec.version : DEFAULT_CONFIG.version,
      estimation: parseEstimation(rec.estimation),
      priority: parsePriority(rec.priority),
      labels: parseLabels(rec.labels),
    };
  } catch {
    return structuredClone(DEFAULT_CONFIG);
  }
}

export async function writeRealmConfig(realmRoot: string, config: RealmConfig): Promise<void> {
  const configPath = path.join(realmRoot, CONFIG_FILE);
  await fs.writeFile(configPath, yaml.dump(config), "utf-8");
}
