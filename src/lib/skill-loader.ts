import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { SkillRegisterFn } from "@/lib/skill-api";

const ENTRY_FILES = ["index.mjs", "index.js"] as const;

async function findEntryFile(skillDir: string): Promise<string | null> {
  for (const name of ENTRY_FILES) {
    const candidate = path.join(skillDir, name);
    try {
      const stat = await fs.stat(candidate);
      if (stat.isFile()) return candidate;
    } catch {
      /* not present — try next */
    }
  }
  return null;
}

function pickRegister(mod: unknown): SkillRegisterFn | null {
  if (!mod || typeof mod !== "object") return null;
  const m = mod as Record<string, unknown>;
  if (typeof m.register === "function") return m.register as SkillRegisterFn;
  if (typeof m.default === "function") return m.default as SkillRegisterFn;
  if (m.default && typeof m.default === "object") {
    const d = m.default as Record<string, unknown>;
    if (typeof d.register === "function") return d.register as SkillRegisterFn;
  }
  return null;
}

export async function loadSkillModule(skillDir: string): Promise<SkillRegisterFn | null> {
  const entry = await findEntryFile(skillDir);
  if (!entry) return null;

  let mod: unknown;
  try {
    mod = await import(/* @vite-ignore */ pathToFileURL(entry).href);
  } catch (err) {
    console.error(`[skill-loader] import failed for ${entry}:`, err);
    return null;
  }

  const register = pickRegister(mod);
  if (!register) {
    console.warn(`[skill-loader] ${entry} has no exported register() function`);
    return null;
  }
  return register;
}
