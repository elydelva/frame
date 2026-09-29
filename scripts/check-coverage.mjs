import { readFileSync } from "node:fs";

const report = readFileSync("coverage/lcov.info", "utf8");
const counts = { linesFound: 0, linesHit: 0, functionsFound: 0, functionsHit: 0 };

for (const line of report.split("\n")) {
  const [key, rawValue] = line.split(":", 2);
  const value = Number(rawValue);
  if (key === "LF") counts.linesFound += value;
  if (key === "LH") counts.linesHit += value;
  if (key === "FNF") counts.functionsFound += value;
  if (key === "FNH") counts.functionsHit += value;
}

const threshold = 0.8;
for (const [name, hit, found] of [
  ["lines", counts.linesHit, counts.linesFound],
  ["functions", counts.functionsHit, counts.functionsFound],
]) {
  if (found === 0) throw new Error(`Coverage report contains no ${name}`);
  const ratio = hit / found;
  console.log(`${name}: ${(ratio * 100).toFixed(2)}% (${hit}/${found}; minimum 80%)`);
  if (ratio < threshold) process.exitCode = 1;
}
