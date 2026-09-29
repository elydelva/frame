import { randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type {
  ClaimStoreErrorCode,
  ClaimStoreErrorInfo,
  WorktreeClaim,
  WorktreeClaimEntry,
} from "./types.js";

const CLAIM_PROTOCOL_VERSION = 1;
const ISSUE_ID_PATTERN = /^ISSUE-\d{4}$/;
const CLAIM_LOCK_TIMEOUT_MS = 10_000;

export class ClaimStoreError extends Error implements ClaimStoreErrorInfo {
  constructor(
    readonly code: ClaimStoreErrorCode,
    readonly path: string,
    message: string
  ) {
    super(`${message}: ${path}`);
    this.name = "ClaimStoreError";
  }

  toInfo(): ClaimStoreErrorInfo {
    return { code: this.code, path: this.path, message: this.message };
  }
}

export class IssueAlreadyClaimedError extends Error {
  constructor(readonly claim: WorktreeClaim) {
    super(`Issue ${claim.issueId} is already claimed by ${claim.actor} at ${claim.path}`);
    this.name = "IssueAlreadyClaimedError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class WorktreeClaimStore {
  private readonly claimsDir: string;

  constructor(commonDir: string) {
    this.claimsDir = path.join(commonDir, "frame", "claims");
  }

  async list(): Promise<WorktreeClaimEntry[]> {
    let entries: string[];
    try {
      entries = await fs.readdir(this.claimsDir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }

    const result: WorktreeClaimEntry[] = [];
    for (const entry of entries.filter((name) => name.endsWith(".json")).sort()) {
      const filePath = path.join(this.claimsDir, entry);
      const issueId = entry.slice(0, -".json".length);
      try {
        const claim = await this.readClaim(filePath, issueId);
        result.push({ issueId, path: filePath, claim, error: null });
      } catch (error) {
        if (!(error instanceof ClaimStoreError)) throw error;
        result.push({ issueId, path: filePath, claim: null, error: error.toInfo() });
      }
    }
    return result;
  }

  async get(issueId: string): Promise<WorktreeClaim | null> {
    const filePath = this.claimPath(issueId);
    try {
      return await this.readClaim(filePath, issueId);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async claim(
    input: Omit<WorktreeClaim, "protocolVersion" | "claimId" | "createdAt">
  ): Promise<WorktreeClaim> {
    const filePath = this.claimPath(input.issueId);
    await fs.mkdir(this.claimsDir, { recursive: true });
    return this.withIssueLock(input.issueId, async () => {
      const existing = await this.get(input.issueId);
      if (existing) throw new IssueAlreadyClaimedError(existing);
      const claim: WorktreeClaim = {
        protocolVersion: CLAIM_PROTOCOL_VERSION,
        claimId: randomUUID(),
        ...input,
        createdAt: new Date().toISOString(),
      };
      const tempPath = path.join(this.claimsDir, `.${input.issueId}.${randomUUID()}.tmp`);

      try {
        await fs.writeFile(tempPath, `${JSON.stringify(claim, null, 2)}\n`, "utf-8");
        // Linking publishes a fully-written record atomically and fails if a
        // concurrent process has already claimed this issue.
        await fs.link(tempPath, filePath);
        return claim;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        const existing = await this.get(input.issueId);
        if (!existing) {
          throw new ClaimStoreError(
            "INVALID_CLAIM",
            filePath,
            "Claim file appeared during acquisition but could not be read"
          );
        }
        throw new IssueAlreadyClaimedError(existing);
      } finally {
        await fs.rm(tempPath, { force: true });
      }
    });
  }

  async release(issueId: string, expectedClaimId?: string): Promise<WorktreeClaim> {
    const filePath = this.claimPath(issueId);
    await fs.mkdir(this.claimsDir, { recursive: true });
    return this.withIssueLock(issueId, async () => {
      const claim = await this.get(issueId);
      if (!claim) {
        throw new ClaimStoreError("INVALID_CLAIM", filePath, "No claim exists");
      }
      if (expectedClaimId && claim.claimId !== expectedClaimId) {
        throw new ClaimStoreError("INVALID_CLAIM", filePath, "Claim changed while releasing");
      }
      await fs.rm(filePath);
      return claim;
    });
  }

  private async withIssueLock<T>(issueId: string, operation: () => Promise<T>): Promise<T> {
    const lockPath = path.join(this.claimsDir, `.${issueId}.lock`);
    const deadline = Date.now() + CLAIM_LOCK_TIMEOUT_MS;
    while (true) {
      try {
        await fs.mkdir(lockPath);
        try {
          await fs.writeFile(
            path.join(lockPath, "owner.json"),
            JSON.stringify({ pid: process.pid })
          );
        } catch (error) {
          await fs.rm(lockPath, { recursive: true, force: true });
          throw error;
        }
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        if (await this.reapDeadLock(lockPath)) continue;
        if (Date.now() >= deadline) {
          throw new ClaimStoreError(
            "CLAIM_LOCK_TIMEOUT",
            lockPath,
            "Timed out waiting for issue claim lock"
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    }

    try {
      return await operation();
    } finally {
      await fs.rm(lockPath, { recursive: true, force: true });
    }
  }

  private async reapDeadLock(lockPath: string): Promise<boolean> {
    let pid: unknown;
    try {
      const owner = JSON.parse(await fs.readFile(path.join(lockPath, "owner.json"), "utf-8")) as {
        pid?: unknown;
      };
      pid = owner.pid;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") return false;
      try {
        const lockStat = await fs.stat(lockPath);
        const ownerAgeMs = Date.now() - lockStat.mtimeMs;
        if (ownerAgeMs < 2_000) return false;
        return this.moveStaleLock(lockPath);
      } catch {
        return true;
      }
    }
    if (typeof pid !== "number" || !Number.isInteger(pid) || pid < 1) return false;
    try {
      process.kill(pid, 0);
      return false;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") return false;
    }
    return this.moveStaleLock(lockPath);
  }

  private async moveStaleLock(lockPath: string): Promise<boolean> {
    const stalePath = `${lockPath}.stale-${randomUUID()}`;
    try {
      await fs.rename(lockPath, stalePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return true;
      return false;
    }
    await fs.rm(stalePath, { recursive: true, force: true });
    return true;
  }

  private claimPath(issueId: string): string {
    if (!ISSUE_ID_PATTERN.test(issueId)) {
      throw new ClaimStoreError("INVALID_CLAIM", this.claimsDir, `Invalid issue ID ${issueId}`);
    }
    return path.join(this.claimsDir, `${issueId}.json`);
  }

  private async readClaim(
    filePath: string,
    expectedIssueId: string,
    attempts = 0
  ): Promise<WorktreeClaim> {
    const statBefore = await fs.stat(filePath, { bigint: true });
    const raw = await fs.readFile(filePath, "utf-8");
    const statAfter = await fs.stat(filePath, { bigint: true });
    if (
      statBefore.dev !== statAfter.dev ||
      statBefore.ino !== statAfter.ino ||
      statBefore.ctimeNs !== statAfter.ctimeNs
    ) {
      if (attempts >= 2) {
        throw new ClaimStoreError(
          "INVALID_CLAIM",
          filePath,
          "Claim changed repeatedly while being read"
        );
      }
      return this.readClaim(filePath, expectedIssueId, attempts + 1);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new ClaimStoreError("INVALID_CLAIM", filePath, "Claim is not valid JSON");
    }

    if (!isRecord(parsed)) {
      throw new ClaimStoreError("INVALID_CLAIM", filePath, "Claim must be a JSON object");
    }

    if (parsed.protocolVersion !== CLAIM_PROTOCOL_VERSION) {
      const code =
        typeof parsed.protocolVersion === "number" &&
        Number.isInteger(parsed.protocolVersion) &&
        parsed.protocolVersion > 0
          ? "UNSUPPORTED_CLAIM_PROTOCOL"
          : "INVALID_CLAIM";
      throw new ClaimStoreError(
        code,
        filePath,
        `Claim protocol ${String(parsed.protocolVersion)} is unsupported; expected ${CLAIM_PROTOCOL_VERSION}`
      );
    }

    const claim: WorktreeClaim = {
      protocolVersion: CLAIM_PROTOCOL_VERSION,
      claimId:
        typeof parsed.claimId === "string" && parsed.claimId.length > 0
          ? parsed.claimId
          : `legacy:${statAfter.dev}:${statAfter.ino}:${statAfter.ctimeNs}`,
      issueId: typeof parsed.issueId === "string" ? parsed.issueId : "",
      actor: typeof parsed.actor === "string" ? parsed.actor : "",
      branch: typeof parsed.branch === "string" ? parsed.branch : "",
      path: typeof parsed.path === "string" ? parsed.path : "",
      createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : "",
    };
    if (
      claim.issueId !== expectedIssueId ||
      !ISSUE_ID_PATTERN.test(claim.issueId) ||
      !claim.actor ||
      !claim.branch ||
      !path.isAbsolute(claim.path) ||
      Number.isNaN(Date.parse(claim.createdAt))
    ) {
      throw new ClaimStoreError(
        "INVALID_CLAIM",
        filePath,
        "Claim fields are incomplete or invalid"
      );
    }
    return claim;
  }
}
