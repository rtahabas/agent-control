import path from "node:path";
import { createSkillApi, type SkillRegisterFn } from "@/lib/skill-api";
import { loadSkillModule } from "@/lib/skill-loader";
import { readSkillsCatalog } from "@/lib/skills-catalog";
import type { SkillEntry } from "@/lib/skill-parse";

export interface RegisterOptions {
  loader?: () => Promise<SkillEntry[]>;
  sourceDir?: string;
  moduleLoader?: (skillDir: string) => Promise<SkillRegisterFn | null>;
}

let registered = false;

async function loadAndRun(
  skill: SkillEntry,
  sourceDir: string,
  moduleLoader: NonNullable<RegisterOptions["moduleLoader"]>,
): Promise<number> {
  const skillDir = path.join(sourceDir, skill.name);
  const register = await moduleLoader(skillDir);
  if (!register) return 0;

  const handle = createSkillApi();
  try {
    await register(handle.api);
  } catch (err) {
    console.error(`[skill-subscriber] ${skill.name} register threw:`, err);
    handle.dispose();
    return 0;
  }
  return handle.hookCount();
}

export async function registerSkillSubscriptions(options: RegisterOptions = {}): Promise<number> {
  if (registered) return 0;
  registered = true;

  const sourceDir = options.sourceDir ?? process.env.SKILLS_SOURCE_DIR;
  if (!sourceDir) return 0;

  const loader = options.loader ?? readSkillsCatalog;
  const moduleLoader = options.moduleLoader ?? loadSkillModule;

  const skills = await loader();
  let total = 0;
  for (const skill of skills) {
    if (skill.enabled === false) continue;
    total += await loadAndRun(skill, sourceDir, moduleLoader);
  }
  return total;
}

export function _resetSkillSubscriptionsForTests(): void {
  registered = false;
}
