import path from "node:path";
import { createSkillApi, type SkillRegisterFn } from "@/lib/skill-api";
import { loadSkillModule } from "@/lib/skill-loader";
import { readSkillsCatalog, resolveSkillsDir } from "@/lib/skills-catalog";
import type { SkillEntry } from "@/lib/skill-parse";

export interface RegisterOptions {
  agentId?: string;
  loader?: () => Promise<SkillEntry[]>;
  sourceDir?: string;
  moduleLoader?: (skillDir: string) => Promise<SkillRegisterFn | null>;
}

// Per-agent registration tracking. Each agent's skills are registered once;
// subsequent calls for the same agent are idempotent. Legacy global mode
// (no agentId) registers under the sentinel "__global__".
const registeredAgents = new Set<string>();
const GLOBAL_KEY = "__global__";

async function loadAndRun(
  skill: SkillEntry,
  sourceDir: string,
  moduleLoader: NonNullable<RegisterOptions["moduleLoader"]>,
  agentId?: string,
): Promise<number> {
  const skillDir = path.join(sourceDir, skill.name);
  const register = await moduleLoader(skillDir);
  if (!register) return 0;

  const handle = createSkillApi(skill.name, {
    emitOptions: agentId ? { agentId } : { sourceDir },
  });
  try {
    await register(handle.api);
  } catch (err) {
    console.error(`[skill-subscriber] ${skill.name} register threw:`, err);
    handle.dispose();
    return 0;
  }
  return handle.hookCount();
}

export async function registerSkillSubscriptions(
  options: RegisterOptions = {},
): Promise<number> {
  const key = options.agentId ?? GLOBAL_KEY;
  if (registeredAgents.has(key)) return 0;

  // Resolve sourceDir: explicit > agent-derived > legacy env
  const sourceDir =
    options.sourceDir ??
    (options.agentId ? resolveSkillsDir(options.agentId) : null) ??
    process.env.SKILLS_SOURCE_DIR ??
    null;
  if (!sourceDir) return 0;

  // Mark registered BEFORE loading to prevent double-register on concurrent calls.
  registeredAgents.add(key);

  const loader = options.loader ?? (() => readSkillsCatalog(sourceDir));
  const moduleLoader = options.moduleLoader ?? loadSkillModule;

  const skills = await loader();
  let total = 0;
  let loaded = 0;
  for (const skill of skills) {
    if (skill.enabled === false) continue;
    const count = await loadAndRun(skill, sourceDir, moduleLoader, options.agentId);
    if (count > 0) loaded++;
    total += count;
  }
  console.info(
    `[skill-subscriber] agent=${key} registered ${total} hook(s) across ${loaded} skill(s) from ${sourceDir}`,
  );
  return total;
}

export function _resetSkillSubscriptionsForTests(): void {
  registeredAgents.clear();
}
