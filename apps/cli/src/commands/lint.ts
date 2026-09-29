import { scanRealmRaw } from "@frame/fs";
import { LintEngine, type LintFinding } from "@frame/lint";
import type { Container } from "../container.js";
import { exitCli } from "./cli-errors.js";
import { setJsonMode } from "./json-mode.js";
import { getFormatter } from "./output.js";

interface LintOptions {
  json?: boolean;
}

function formatFinding(f: LintFinding): string {
  const where = f.entityId ? `${f.entityId} (${f.file})` : f.file;
  const mark = f.severity === "error" ? "✗" : "⚠";
  return `${mark} [${f.code}] ${where}: ${f.message}`;
}

export async function runLint(container: Container, opts: LintOptions): Promise<void> {
  setJsonMode(opts.json ?? false);

  const scan = await scanRealmRaw(container.realmRoot);
  const report = new LintEngine(container.config).run(scan);

  getFormatter(opts.json ?? false).emit({
    json: report,
    human: () => {
      if (report.findings.length === 0) {
        console.log("✓ No issues.");
        return;
      }
      for (const f of report.findings) {
        console.log(formatFinding(f));
      }
      console.log("");
      console.log(`${report.errorCount} error(s), ${report.warningCount} warning(s)`);
    },
  });

  // Errors fail the command (exit 1) so a pre-commit hook can block the commit.
  if (report.errorCount > 0) exitCli(1);
}
