import yaml from "js-yaml";

export interface ParsedFile {
  data: Record<string, unknown>;
  body: string;
}

export function parseFrontmatter(content: string): ParsedFile {
  const lines = content
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .split("\n");
  if (lines[0]?.trim() !== "---") return { data: {}, body: lines.join("\n").trim() };

  const closing = lines.findIndex(
    (line, index) => index > 0 && (line.trim() === "---" || line.trim() === "...")
  );
  if (closing < 0) return { data: {}, body: lines.join("\n").trim() };

  const parsed = yaml.load(lines.slice(1, closing).join("\n")) ?? {};
  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Frontmatter must be a YAML mapping");
  }
  return {
    data: parsed as Record<string, unknown>,
    body: lines
      .slice(closing + 1)
      .join("\n")
      .trim(),
  };
}

export function stringifyFrontmatter(data: Record<string, unknown>, body: string): string {
  return `---\n${yaml.dump(data, { lineWidth: -1 })}---\n${body}`;
}
