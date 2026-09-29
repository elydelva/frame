import type { IRealmRepository, RealmConfig } from "@frame/core";

export interface FrameOptions {
  root?: string;
  repository?: IRealmRepository;
  config?: RealmConfig;
}

export function assertFrameOptions(options: FrameOptions): void {
  if (!options.root && !options.repository) {
    throw new TypeError("Frame requires either a root path or a repository adapter.");
  }
}
