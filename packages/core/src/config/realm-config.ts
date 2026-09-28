/**
 * `RealmConfig` — extensible, Linear-style realm configuration.
 *
 * v1 covers three data-only axes: estimation scales, fully-custom priority
 * levels, and a shared label taxonomy. The schema is versioned so future axes
 * (custom workflow states, cycles, alternative `next.sort` policies) can be
 * added without breaking older files.
 *
 * This module is pure: types, the `DEFAULT_CONFIG`, and stateless helpers.
 * All I/O (reading/writing the YAML file) lives in `@frame/fs`.
 */

export type EstimationScale = "none" | "linear" | "fibonacci" | "tshirt" | "exponential" | "hours";

export interface EstimatePoint {
  label: string;
  points: number;
}

export interface EstimationConfig {
  scale: EstimationScale;
  default: number | null;
  /** Optional override of the built-in scale's points/labels. */
  values?: EstimatePoint[];
}

export interface PriorityConfig {
  /** Ordered list of levels; index 0 = highest priority. */
  levels: string[];
  default: string;
}

export interface LabelConfig {
  name: string;
  color?: string;
  group?: string;
}

export interface RealmConfig {
  version: number;
  estimation: EstimationConfig;
  priority: PriorityConfig;
  labels: LabelConfig[];
}

export const DEFAULT_CONFIG: RealmConfig = {
  version: 1,
  estimation: { scale: "fibonacci", default: null },
  priority: { levels: ["urgent", "high", "medium", "low", "none"], default: "none" },
  labels: [],
};

const BUILT_IN_SCALES: Record<Exclude<EstimationScale, "none" | "hours">, EstimatePoint[]> = {
  linear: [
    { label: "1", points: 1 },
    { label: "2", points: 2 },
    { label: "3", points: 3 },
    { label: "4", points: 4 },
    { label: "5", points: 5 },
  ],
  fibonacci: [
    { label: "1", points: 1 },
    { label: "2", points: 2 },
    { label: "3", points: 3 },
    { label: "5", points: 5 },
    { label: "8", points: 8 },
    { label: "13", points: 13 },
    { label: "21", points: 21 },
  ],
  tshirt: [
    { label: "XS", points: 1 },
    { label: "S", points: 2 },
    { label: "M", points: 3 },
    { label: "L", points: 5 },
    { label: "XL", points: 8 },
  ],
  exponential: [
    { label: "1", points: 1 },
    { label: "2", points: 2 },
    { label: "4", points: 4 },
    { label: "8", points: 8 },
    { label: "16", points: 16 },
  ],
};

/**
 * Expand an estimation config into its concrete `{ label, points }` table.
 * An explicit `values` override always wins. `none` and `hours` have no
 * built-in table (`hours` accepts free-form reals at resolution time).
 */
export function expandScale(est: EstimationConfig): EstimatePoint[] {
  if (est.values && est.values.length > 0) return est.values;
  if (est.scale === "none" || est.scale === "hours") return [];
  return BUILT_IN_SCALES[est.scale];
}

/**
 * Resolve a raw `--estimate` input (a label like `"M"` or a number like `"3"`)
 * into stored points. Throws on invalid input.
 *
 * - `none` → throws ("estimation is disabled").
 * - `hours` → accepts any real ≥ 0.
 * - otherwise → matches a label (case-insensitive) or a numeric points value;
 *   unknown input throws, listing the permitted labels.
 */
export function resolveEstimate(cfg: RealmConfig, raw: string): number {
  const est = cfg.estimation;
  if (est.scale === "none" && (!est.values || est.values.length === 0)) {
    throw new Error("Estimation is disabled (scale: none).");
  }

  if (est.scale === "hours" && (!est.values || est.values.length === 0)) {
    const n = Number.parseFloat(raw);
    if (Number.isNaN(n) || n < 0) {
      throw new Error(`Invalid estimate "${raw}": expected a non-negative number of hours.`);
    }
    return n;
  }

  const points = expandScale(est);
  const trimmed = raw.trim();

  const byLabel = points.find((p) => p.label.toLowerCase() === trimmed.toLowerCase());
  if (byLabel) return byLabel.points;

  const n = Number.parseFloat(trimmed);
  if (!Number.isNaN(n) && points.some((p) => p.points === n)) return n;

  const labels = points.map((p) => p.label).join(", ");
  throw new Error(`Invalid estimate "${raw}": expected one of ${labels}.`);
}

/**
 * Format stored points back into a display label. Falls back to the numeric
 * string when no label matches; `null` → empty string.
 */
export function formatEstimate(cfg: RealmConfig, points: number | null): string {
  if (points === null) return "";
  const match = expandScale(cfg.estimation).find((p) => p.points === points);
  return match ? match.label : String(points);
}

/**
 * Build a priority-rank lookup: index in `levels` (0 = highest). Unknown values
 * rank last (`levels.length`), so legacy/foreign priorities sort gracefully.
 */
export function priorityRank(cfg: RealmConfig): (p: string) => number {
  const index = new Map(cfg.priority.levels.map((level, i) => [level, i]));
  return (p: string) => index.get(p) ?? cfg.priority.levels.length;
}

/** Whether `p` is one of the configured priority levels. */
export function validatePriority(cfg: RealmConfig, p: string): boolean {
  return cfg.priority.levels.includes(p);
}
