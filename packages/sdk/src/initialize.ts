import { initializeRealm } from "@frame/fs";

export async function initializeFrame<T>(root: string, create: (root: string) => T): Promise<T> {
  await initializeRealm(root);
  return create(root);
}
