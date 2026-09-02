import { existsSync, mkdirSync, appendFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getAgentPath } from "./db";

const HEADER = [
  "# Skill activity log — one line per invocation.",
  "# Format: ISO8601 | skill-name | args-length-chars",
  "# Written by skill-activity-emit.ts (native register(api) path) and",
  "# hook-skill-activity.sh (PostToolUse:Skill path). PII-safe.",
  "",
].join("\n");

export interface EmitOptions {
  logPath?: string;
  agentId?: string;
  agentPath?: string;
  sourceDir?: string;
}

/**
 * Resolve the skill-activity log path.
 *
 * Resolution order:
 *   1. explicit `opts.logPath`
 *   2. `SKILL_ACTIVITY_LOG_PATH` env (legacy override)
 *   3. agent-derived: `<agentPath>/memory/memory/skill-activity.log` (canonical) or `<agentPath>/memory/skill-activity.log` (flat)
 *      where `agentPath` comes from `opts.agentPath` or `getAgentPath(opts.agentId)`
 *   4. legacy `sourceDir` based derivation (assumes sourceDir = `<root>/.claude/skills`)
 *   5. legacy `SKILLS_SOURCE_DIR` env (same derivation as #4)
 */
export function resolveLogPath(opts: EmitOptions = {}): string | null {
  const explicit = opts.logPath ?? process.env.SKILL_ACTIVITY_LOG_PATH;
  if (explicit) return explicit;

  // Prefer agent-derived path when caller knows the agent.
  let projectRoot: string | null = null;
  const agentPath = opts.agentPath ?? (opts.agentId ? getAgentPath(opts.agentId) : null);
  if (agentPath) {
    projectRoot = agentPath;
  } else {
    const sourceDir = opts.sourceDir ?? process.env.SKILLS_SOURCE_DIR;
    if (sourceDir) projectRoot = path.resolve(sourceDir, "../..");
  }
  if (!projectRoot) return null;

  // Two layouts seen in practice for the bash-hook log file location:
  //   - nested: <PROJECT_ROOT>/memory/memory/skill-activity.log  (canonical)
  //   - flat:   <PROJECT_ROOT>/memory/skill-activity.log         (legacy assumption)
  // Prefer the existing file so native emit converges with the bash hook
  // writer instead of creating a parallel ghost log. When neither exists,
  // default to the nested location which matches the canonical layout.
  const candidates = [
    path.join(projectRoot, "memory", "memory", "skill-activity.log"),
    path.join(projectRoot, "memory", "skill-activity.log"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return candidates[0];
}

export function emitSkillActivity(
  skill: string,
  argLen: number,
  opts: EmitOptions = {},
): boolean {
  const target = resolveLogPath(opts);
  if (!target) return false;
  try {
    if (!existsSync(target)) {
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, HEADER, { encoding: "utf8" });
    }
    const ts = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    const safeSkill = skill || "<unknown>";
    const safeLen = Number.isFinite(argLen) && argLen >= 0 ? argLen : 0;
    appendFileSync(target, `${ts} | ${safeSkill} | ${safeLen}\n`, { encoding: "utf8" });
    return true;
  } catch (err) {
    console.error(`[skill-activity-emit] append failed for ${skill}:`, err);
    return false;
  }
}
