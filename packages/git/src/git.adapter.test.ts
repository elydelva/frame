import { describe, expect, it } from "bun:test";
import { GitCommandError } from "./errors/index.js";
import { GitAdapter } from "./git.adapter.js";

describe("GitAdapter", () => {
  const adapter = new GitAdapter();

  describe("isRepo()", () => {
    it("returns true when run inside a git repository", async () => {
      const result = await adapter.isRepo();
      expect(result).toBe(true);
    });
  });

  describe("stage()", () => {
    it("resolves without error when paths array is empty", async () => {
      await expect(adapter.stage([])).resolves.toBeUndefined();
    });

    it("throws GitCommandError when path does not exist", async () => {
      await expect(adapter.stage(["/nonexistent-path-frame-test"])).rejects.toBeInstanceOf(
        GitCommandError
      );
    });
  });
});
