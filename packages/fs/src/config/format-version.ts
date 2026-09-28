import * as fs from "node:fs/promises";
import * as path from "node:path";
import { FRAME_DIR, REALM_MANIFEST_FILE } from "../constants.js";

export const CURRENT_REALM_FORMAT = 1;

type RealmFormatErrorCode = "INVALID_REALM_MANIFEST" | "UNSUPPORTED_REALM_FORMAT";

export class RealmFormatError extends Error {
  constructor(
    readonly code: RealmFormatErrorCode,
    readonly detectedVersion: number | null,
    manifestPath: string,
    detail: string
  ) {
    super(`${detail}: ${manifestPath}. Supported realm format: ${CURRENT_REALM_FORMAT}.`);
    this.name = "RealmFormatError";
  }
}

function manifestPath(realmRoot: string): string {
  return path.join(realmRoot, FRAME_DIR, REALM_MANIFEST_FILE);
}

export async function readRealmFormat(realmRoot: string): Promise<number> {
  const filePath = manifestPath(realmRoot);
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return CURRENT_REALM_FORMAT;
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new RealmFormatError(
      "INVALID_REALM_MANIFEST",
      null,
      filePath,
      "Manifest is not valid JSON; repair it or restore it from version control"
    );
  }

  const version =
    typeof parsed === "object" && parsed !== null && "formatVersion" in parsed
      ? (parsed as { formatVersion?: unknown }).formatVersion
      : undefined;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    throw new RealmFormatError(
      "INVALID_REALM_MANIFEST",
      typeof version === "number" ? version : null,
      filePath,
      "Manifest must contain a positive integer formatVersion; repair it or restore it from version control"
    );
  }

  if (version !== CURRENT_REALM_FORMAT) {
    throw new RealmFormatError(
      "UNSUPPORTED_REALM_FORMAT",
      version,
      filePath,
      `This realm uses format ${version}; this frame supports format ${CURRENT_REALM_FORMAT}; install a compatible frame version or migrate the realm`
    );
  }

  return version;
}

export async function writeRealmFormat(
  realmRoot: string,
  formatVersion = CURRENT_REALM_FORMAT
): Promise<void> {
  const filePath = manifestPath(realmRoot);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify({ formatVersion }, null, 2)}\n`, "utf-8");
}
