import { parse as parseYAML } from "yaml";

export interface SkillActivation {
  onStartup?: boolean;
}

export interface SkillLifecycle {
  hooks?: string[];
}

export interface SkillEntry {
  name: string;
  description: string;
  activation?: SkillActivation;
  configSchema?: Record<string, unknown>;
  lifecycle?: SkillLifecycle;
}

export function parseFrontmatter(raw: string): Record<string, unknown> {
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  try {
    const parsed: unknown = parseYAML(match[1]);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* malformed frontmatter — treat as empty */
  }
  return {};
}

function readActivation(value: unknown): SkillActivation | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const v = value as Record<string, unknown>;
  if (typeof v.onStartup !== "boolean") return undefined;
  return { onStartup: v.onStartup };
}

function readLifecycle(value: unknown): SkillLifecycle | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const v = value as Record<string, unknown>;
  if (!Array.isArray(v.hooks)) return undefined;
  const hooks = v.hooks.filter((h): h is string => typeof h === "string");
  if (hooks.length === 0) return undefined;
  return { hooks };
}

function readConfigSchema(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

export function buildSkillEntry(fm: Record<string, unknown>, fallbackName: string): SkillEntry {
  const entry: SkillEntry = {
    name: typeof fm.name === "string" ? fm.name : fallbackName,
    description: typeof fm.description === "string" ? fm.description : "",
  };
  const activation = readActivation(fm.activation);
  if (activation) entry.activation = activation;
  const lifecycle = readLifecycle(fm.lifecycle);
  if (lifecycle) entry.lifecycle = lifecycle;
  const configSchema = readConfigSchema(fm.configSchema);
  if (configSchema) entry.configSchema = configSchema;
  return entry;
}

export function parseSkillFrontmatter(raw: string, fallbackName: string): SkillEntry {
  return buildSkillEntry(parseFrontmatter(raw), fallbackName);
}
