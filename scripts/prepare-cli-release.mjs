import { readFileSync, writeFileSync } from "node:fs";

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version ?? "")) {
  throw new Error("Usage: bun scripts/prepare-cli-release.mjs <major.minor.patch>");
}

const packagePath = "apps/cli/package.json";
const cliPath = "apps/cli/src/cli.ts";
const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
const current = packageJson.version;
const toParts = (value) => value.split(".").map(Number);
const currentParts = toParts(current);
const nextParts = toParts(version);
const firstDifference = nextParts.findIndex((part, index) => part !== currentParts[index]);
const isGreater =
  firstDifference >= 0 && nextParts[firstDifference] > currentParts[firstDifference];
if (!isGreater) throw new Error(`Version ${version} must exceed ${current}`);

const source = readFileSync(cliPath, "utf8");
const expected = `const CLI_VERSION = "${current}";`;
if (!source.includes(expected))
  throw new Error(`CLI_VERSION does not match package version ${current}`);

packageJson.version = version;
writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
writeFileSync(cliPath, source.replace(expected, `const CLI_VERSION = "${version}";`));
console.log(`Prepared frame ${version}`);
