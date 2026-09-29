import type { HistoryFilter, Trace, TraceEvent } from "@frame/core";
import { IssueId, ProjectId, SpecId } from "@frame/core";
import type { Container } from "../container.js";
import { setJsonMode } from "./json-mode.js";
import { getFormatter } from "./output.js";
import { fail, serializeTrace } from "./shared.js";

interface HistoryOptions {
  project?: string;
  issue?: string;
  spec?: string;
  actor?: string;
  event?: string;
  since?: string;
  json?: boolean;
}

function formatTrace(trace: Trace): string {
  const at = trace.at.toISOString().replace("T", " ").slice(0, 19);
  const refParts: string[] = [];
  if (trace.issueId) refParts.push(trace.issueId.toString());
  if (trace.specId) refParts.push(trace.specId.toString());
  if (trace.ref) refParts.push(`ref:${trace.ref}`);
  const refs = refParts.length > 0 ? ` [${refParts.join(" ")}]` : "";
  const transition = trace.from && trace.to ? ` (${trace.from} → ${trace.to})` : "";
  return `${at}  ${trace.event.padEnd(22)}  ${trace.actor}${refs}${transition}`;
}

export async function runHistory(container: Container, opts: HistoryOptions): Promise<void> {
  setJsonMode(opts.json ?? false);
  const filter: HistoryFilter = {};

  if (opts.project) filter.projectId = ProjectId.from(opts.project);
  if (opts.issue) filter.issueId = IssueId.from(opts.issue);
  if (opts.spec) filter.specId = SpecId.from(opts.spec);
  if (opts.actor) filter.actor = opts.actor;
  if (opts.event) filter.event = opts.event as TraceEvent;
  if (opts.since) {
    const d = new Date(opts.since);
    if (Number.isNaN(d.getTime())) fail(`Invalid --since: ${opts.since}`);
    filter.since = d;
  }

  const traces = await container.frame.history(filter);

  getFormatter(opts.json ?? false).emit({
    json: traces.map(serializeTrace),
    human: () => {
      if (traces.length === 0) {
        console.log("No history found.");
        return;
      }

      for (const trace of traces) {
        console.log(formatTrace(trace));
      }
    },
  });
}
