import type { Container } from "../../container.js";
import { setJsonMode } from "../json-mode.js";
import { getFormatter } from "../output.js";
import { serializeProject } from "../shared.js";

interface ProjectListOptions {
  json?: boolean;
}

export async function runProjectList(
  container: Container,
  opts: ProjectListOptions
): Promise<void> {
  setJsonMode(opts.json ?? false);
  const projects = await container.repo.findAllProjects();

  getFormatter(opts.json ?? false).emit({
    json: projects.map(serializeProject),
    human: () => {
      if (projects.length === 0) {
        console.log("No projects.");
        return;
      }

      for (const p of projects) {
        console.log(`${p.id.toString()}  ${p.title}  [${p.status}]`);
      }
    },
  });
}
