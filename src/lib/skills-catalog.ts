import path from "node:path";
import { readSkillsDir, type SkillEntry } from "./skill-fs";
import { getDisabledSkills } from "./skill-state";
import { getAgentPath } from "./db";

export type SkillCatalogEntry = SkillEntry;

/**
 * Resolve the skill source directory for a specific agent.
 * Agent-scoped: `<agent.path>/.claude/skills`.
 */
export function resolveSkillsDir(agentId: string): string | null {
  const agentPath = getAgentPath(agentId);
  if (!agentPath) return null;
  return path.join(agentPath, ".claude", "skills");
}

/**
 * Read the skill catalog. Agent-scoped when `sourceDir` is provided,
 * otherwise falls back to `SKILLS_SOURCE_DIR` env (legacy single-agent mode).
 */
export async function readSkillsCatalog(
  sourceDir?: string,
): Promise<SkillCatalogEntry[]> {
  const dir = sourceDir ?? process.env.SKILLS_SOURCE_DIR;
  if (!dir) return [];
  const entries = await readSkillsDir(dir);
  const disabled = getDisabledSkills();
  return entries.map((e) => ({ ...e, enabled: !disabled.has(e.name) }));
}
