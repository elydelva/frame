import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const artifacts = process.argv.slice(2);
assert.equal(artifacts.length, 4, "pass core, fs, sdk, and cli tarballs");
const root = await mkdtemp(path.join(os.tmpdir(), "frame-package-smoke-"));
const cliRoot = await mkdtemp(path.join(os.tmpdir(), "frame-cli-package-smoke-"));
try {
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify({ private: true, type: "module", devDependencies: { typescript: "^5.7.0" } })
  );
  const install = spawnSync(
    "npm",
    ["install", "--prefix", root, "--no-save", "--no-package-lock", "--no-audit", "--no-fund", ...artifacts.slice(0, 3)],
    { encoding: "utf8" }
  );
  assert.equal(install.status, 0, install.stderr || install.stdout);

  await writeFile(
    path.join(root, "sdk-consumer.ts"),
    `import { Frame, IssueId, type IRealmRepository, type Issue } from "@frame/sdk";
     const frame = new Frame({ root: "." });
     const rows: Promise<Issue[]> = frame.issues.list({ projectId: "PROJ-0001", label: "api" });
     const id = IssueId.from("ISSUE-0001");
     async function useCustomAdapter(repository: IRealmRepository) {
       return new Frame({ repository }).issues.get(id);
     }
     void rows; void useCustomAdapter;`
  );
  const typecheck = spawnSync(
    path.join(root, "node_modules", ".bin", "tsc"),
    ["--noEmit", "--module", "NodeNext", "--moduleResolution", "NodeNext", "--target", "ES2022", "--strict", "--skipLibCheck", "sdk-consumer.ts"],
    { cwd: root, encoding: "utf8" }
  );
  assert.equal(typecheck.status, 0, typecheck.stderr || typecheck.stdout);

  const sdkCheck = spawnSync("node", ["--input-type=module", "-e", `
    import assert from 'node:assert/strict';
    import { mkdtemp, rm } from 'node:fs/promises';
    import os from 'node:os';
    import path from 'node:path';
    import { Frame } from '@frame/sdk';
    const root = await mkdtemp(path.join(os.tmpdir(), 'frame-sdk-consumer-'));
    try {
      await Frame.initialize({ root });
      const frame = new Frame({ root });
      assert.deepEqual(await frame.projects.list(), []);
    } finally { await rm(root, { recursive: true, force: true }); }
  `], { cwd: root, encoding: "utf8" });
  assert.equal(sdkCheck.status, 0, sdkCheck.stderr || sdkCheck.stdout);

  await writeFile(path.join(cliRoot, "package.json"), JSON.stringify({ private: true }));
  const cliInstall = spawnSync(
    "npm",
    ["install", "--prefix", cliRoot, "--no-save", "--no-package-lock", "--no-audit", "--no-fund", artifacts[3]],
    { encoding: "utf8" }
  );
  assert.equal(cliInstall.status, 0, cliInstall.stderr || cliInstall.stdout);

  const realm = path.join(cliRoot, "realm");
  const frameBin = path.join(cliRoot, "node_modules", ".bin", "frame");
  const help = spawnSync(frameBin, ["--help"], {
    cwd: cliRoot,
    env: { ...process.env, FRAME_ROOT: realm },
    encoding: "utf8",
  });
  assert.equal(help.status, 0, help.stderr || help.stdout);
  assert.match(help.stdout, /Usage: frame/);

  const init = spawnSync(frameBin, ["init"], {
    cwd: cliRoot,
    env: { ...process.env, FRAME_ROOT: realm },
    encoding: "utf8",
  });
  assert.equal(init.status, 0, init.stderr || init.stdout);
  const lint = spawnSync(frameBin, ["lint", "--json"], {
    cwd: cliRoot,
    env: { ...process.env, FRAME_ROOT: realm },
    encoding: "utf8",
  });
  assert.equal(lint.status, 0, lint.stderr || lint.stdout);
  assert.equal(JSON.parse(lint.stdout).errorCount, 0);
  process.stdout.write("SDK and CLI packed-artifact smoke checks passed.\n");
} finally {
  await rm(root, { recursive: true, force: true });
  await rm(cliRoot, { recursive: true, force: true });
}
