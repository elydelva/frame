import { readRealmFormat } from "@frame/fs";

/** Reject a realm before its config or entities are read by this CLI. */
export async function assertRealmCompatible(realmRoot: string): Promise<void> {
  await readRealmFormat(realmRoot);
}
