import { type RealmConfig, resolveEstimate } from "@frame/core";
import { writeRealmConfig } from "@frame/fs";
import { FrameInputError } from "./errors.js";

const SCALES = ["none", "linear", "fibonacci", "tshirt", "exponential", "hours"] as const;

export class ConfigApi {
  constructor(
    private readonly load: () => Promise<{ config: RealmConfig }>,
    private readonly root?: string,
    private readonly update?: (config: RealmConfig) => void | Promise<void>
  ) {}

  async get(): Promise<RealmConfig> {
    return structuredClone((await this.load()).config);
  }

  async set(key: string, value: string): Promise<unknown> {
    if (!this.root) {
      throw new FrameInputError(
        "CONFIG_STORAGE_UNAVAILABLE",
        "Writing config requires a filesystem root."
      );
    }
    const { config } = await this.load();
    const next = structuredClone(config);
    switch (key) {
      case "priority.default":
        if (!config.priority.levels.includes(value)) {
          throw new FrameInputError(
            "INVALID_CONFIG_VALUE",
            `Invalid priority: ${value} (expected ${config.priority.levels.join("|")})`
          );
        }
        next.priority.default = value;
        break;
      case "estimation.scale":
        if (!(SCALES as readonly string[]).includes(value)) {
          throw new FrameInputError(
            "INVALID_CONFIG_VALUE",
            `Invalid scale: ${value} (expected ${SCALES.join("|")})`
          );
        }
        next.estimation.scale = value as RealmConfig["estimation"]["scale"];
        break;
      case "estimation.default":
        if (value === "none" || value === "") {
          next.estimation.default = null;
        } else {
          try {
            next.estimation.default = resolveEstimate(next, value);
          } catch (error) {
            throw new FrameInputError(
              "INVALID_CONFIG_VALUE",
              error instanceof Error ? error.message : String(error)
            );
          }
        }
        break;
      default:
        throw new FrameInputError(
          "UNSUPPORTED_CONFIG_KEY",
          `Unsupported config key: ${key} (settable: priority.default, estimation.scale, estimation.default)`
        );
    }
    await writeRealmConfig(this.root, next);
    await this.update?.(next);
    return key === "priority.default"
      ? next.priority.default
      : key === "estimation.scale"
        ? next.estimation.scale
        : next.estimation.default;
  }
}
