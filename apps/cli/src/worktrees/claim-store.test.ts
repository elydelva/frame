import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { ClaimStoreError, IssueAlreadyClaimedError, WorktreeClaimStore } from "./claim-store.js";

describe("WorktreeClaimStore", () => {
  let commonDir: string;
  let store: WorktreeClaimStore;

  beforeEach(async () => {
    commonDir = await fs.mkdtemp(path.join(os.tmpdir(), "frame-claim-store-"));
    store = new WorktreeClaimStore(commonDir);
  });

  afterEach(async () => {
    await fs.rm(commonDir, { recursive: true, force: true });
  });

  it("creates, reads, lists, and releases a claim", async () => {
    const claim = await store.claim(input("ISSUE-0001"));

    expect(claim).toMatchObject({
      protocolVersion: 1,
      issueId: "ISSUE-0001",
      actor: "agent:test",
      branch: "issue/ISSUE-0001-test",
      path: "/repo/.worktrees/ISSUE-0001",
    });
    expect(Date.parse(claim.createdAt)).not.toBeNaN();
    expect(await store.get("ISSUE-0001")).toEqual(claim);
    expect(await store.list()).toEqual([
      { issueId: "ISSUE-0001", path: expect.any(String), claim, error: null },
    ]);
    expect(await store.release("ISSUE-0001")).toEqual(claim);
    expect(await store.get("ISSUE-0001")).toBeNull();
    expect(await store.list()).toEqual([]);
  });

  it("allows only one concurrent claim for an issue", async () => {
    const results = await Promise.allSettled([
      store.claim(input("ISSUE-0002", "agent:first")),
      store.claim(input("ISSUE-0002", "agent:second")),
    ]);
    const successes = results.filter((result) => result.status === "fulfilled");
    const failures = results.filter((result) => result.status === "rejected");

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    const success = successes[0];
    const failure = failures[0];
    if (success?.status === "fulfilled" && failure?.status === "rejected") {
      expect(failure.reason).toBeInstanceOf(IssueAlreadyClaimedError);
      expect(failure.reason.claim.issueId).toBe("ISSUE-0002");
      expect(failure.reason.claim.actor).toBe(success.value.actor);
    }
  });

  it("preserves malformed and unsupported records in list results", async () => {
    await writeClaimFile("ISSUE-0003", "{");
    await writeClaimFile(
      "ISSUE-0004",
      JSON.stringify({ ...claimJson("ISSUE-0004"), protocolVersion: 2 })
    );

    const entries = await store.list();

    expect(entries).toMatchObject([
      { issueId: "ISSUE-0003", claim: null, error: { code: "INVALID_CLAIM" } },
      { issueId: "ISSUE-0004", claim: null, error: { code: "UNSUPPORTED_CLAIM_PROTOCOL" } },
    ]);
  });

  it("refuses to read or overwrite malformed and unsupported claims", async () => {
    await writeClaimFile("ISSUE-0005", "{");

    await expect(store.get("ISSUE-0005")).rejects.toBeInstanceOf(ClaimStoreError);
    await expect(store.claim(input("ISSUE-0005"))).rejects.toBeInstanceOf(ClaimStoreError);
    expect(await fs.readFile(claimFile("ISSUE-0005"), "utf-8")).toBe("{");

    await writeClaimFile(
      "ISSUE-0006",
      JSON.stringify({ ...claimJson("ISSUE-0006"), protocolVersion: 2 })
    );
    await expect(store.get("ISSUE-0006")).rejects.toMatchObject({
      code: "UNSUPPORTED_CLAIM_PROTOCOL",
    });
    await expect(store.release("ISSUE-0006")).rejects.toBeInstanceOf(ClaimStoreError);
  });

  it("keeps unrelated issue claims independent", async () => {
    await store.claim(input("ISSUE-0007"));
    await store.claim(input("ISSUE-0008"));

    await store.release("ISSUE-0007");

    expect(await store.get("ISSUE-0007")).toBeNull();
    expect((await store.get("ISSUE-0008"))?.issueId).toBe("ISSUE-0008");
  });

  it("does not release a replacement claim using a stale claim snapshot", async () => {
    const original = await store.claim(input("ISSUE-0009", "agent:old"));
    await store.release("ISSUE-0009");
    const replacement = await store.claim(input("ISSUE-0009", "agent:new"));
    await writeClaimFile(
      "ISSUE-0009",
      JSON.stringify({ ...replacement, createdAt: original.createdAt })
    );

    await expect(store.release("ISSUE-0009", original.claimId)).rejects.toThrow("Claim changed");
    expect((await store.get("ISSUE-0009"))?.claimId).toBe(replacement.claimId);
  });

  it("derives stable identities for legacy claims without stored claim IDs", async () => {
    await writeClaimFile("ISSUE-0010", JSON.stringify(claimJson("ISSUE-0010")));
    const legacy = await store.get("ISSUE-0010");
    if (!legacy) throw new Error("expected legacy claim");
    expect(legacy.claimId.startsWith("legacy:")).toBe(true);
    await store.release("ISSUE-0010");
    const replacement = await store.claim(input("ISSUE-0010", "agent:new"));

    await expect(store.release("ISSUE-0010", legacy.claimId)).rejects.toThrow("Claim changed");
    expect((await store.get("ISSUE-0010"))?.claimId).toBe(replacement.claimId);
  });

  function input(issueId: string, actor = "agent:test") {
    return {
      issueId,
      actor,
      branch: `issue/${issueId}-test`,
      path: `/repo/.worktrees/${issueId}`,
    };
  }

  function claimJson(issueId: string) {
    return {
      protocolVersion: 1,
      issueId,
      actor: "agent:test",
      branch: `issue/${issueId}-test`,
      path: `/repo/.worktrees/${issueId}`,
      createdAt: "2026-09-28T12:00:00.000Z",
    };
  }

  function claimFile(issueId: string): string {
    return path.join(commonDir, "frame", "claims", `${issueId}.json`);
  }

  async function writeClaimFile(issueId: string, body: string): Promise<void> {
    await fs.mkdir(path.dirname(claimFile(issueId)), { recursive: true });
    await fs.writeFile(claimFile(issueId), body, "utf-8");
  }
});
