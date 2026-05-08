import fs from "node:fs/promises";
import path from "node:path";

const TEMPLATES_ROOT = path.join(process.cwd(), "templates");

function skillsSourceDir(): string {
  const dir = process.env.SKILLS_SOURCE_DIR;
  if (!dir) {
    throw new Error(
      "SKILLS_SOURCE_DIR is not configured. Set it in .env.local to enable skill scaffolding."
    );
  }
  return dir;
}

export type Tokens = Record<string, string>;

function applyTokens(content: string, tokens: Tokens): string {
  return content.replace(/\{\{(\w+)\}\}/g, (_m, k) => tokens[k] ?? `{{${k}}}`);
}

async function walk(root: string): Promise<string[]> {
  const out: string[] = [];
  async function visit(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await visit(full);
      else if (e.isFile()) out.push(full);
    }
  }
  await visit(root);
  return out;
}

export async function pathIsEmpty(target: string): Promise<boolean> {
  try {
    const entries = await fs.readdir(target);
    return entries.length === 0;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return true;
    throw e;
  }
}

export async function copyTemplate(template: string, target: string, tokens: Tokens): Promise<void> {
  const src = path.join(TEMPLATES_ROOT, template);
  const files = await walk(src);
  for (const f of files) {
    const rel = path.relative(src, f);
    const dest = path.join(target, rel);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    const raw = await fs.readFile(f, "utf8");
    await fs.writeFile(dest, applyTokens(raw, tokens), "utf8");
  }
}

export async function copySkill(skillName: string, target: string): Promise<void> {
  const src = path.join(skillsSourceDir(), skillName);
  const dest = path.join(target, ".claude", "skills", skillName);
  const files = await walk(src);
  for (const f of files) {
    const rel = path.relative(src, f);
    const out = path.join(dest, rel);
    await fs.mkdir(path.dirname(out), { recursive: true });
    await fs.copyFile(f, out);
  }
}

export interface ScaffoldInput {
  template: string;
  target: string;
  tokens: Tokens;
  skills: string[];
}

export async function scaffold(input: ScaffoldInput): Promise<void> {
  if (!(await pathIsEmpty(input.target))) {
    throw new Error("target path is not empty: " + input.target);
  }
  await copyTemplate(input.template, input.target, input.tokens);
  for (const s of input.skills) await copySkill(s, input.target);
}
