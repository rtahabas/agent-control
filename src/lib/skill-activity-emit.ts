import { existsSync, mkdirSync, appendFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const HEADER = [
  "# Skill activity log — one line per invocation.",
  "# Format: ISO8601 | skill-name | args-length-chars",
  "# Written by skill-activity-emit.ts (native register(api) path) and",
  "# hook-skill-activity.sh (PostToolUse:Skill path). PII-safe.",
  "",
].join("\n");

export interface EmitOptions {
  logPath?: string;
  sourceDir?: string;
}

export function resolveLogPath(opts: EmitOptions = {}): string | null {
  const explicit = opts.logPath ?? process.env.SKILL_ACTIVITY_LOG_PATH;
  if (explicit) return explicit;
  const sourceDir = opts.sourceDir ?? process.env.SKILLS_SOURCE_DIR;
  if (!sourceDir) return null;
  // SKILLS_SOURCE_DIR is .../<MEMORY_ROOT>/.claude/skills — log lives at
  // <MEMORY_ROOT>/memory/skill-activity.log to match the bash hook target.
  const memoryRoot = path.resolve(sourceDir, "../..");
  return path.join(memoryRoot, "memory", "skill-activity.log");
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
