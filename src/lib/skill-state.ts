import { getDb } from "@/lib/db";

const NAME_RE = /^[a-z0-9][a-z0-9_-]*$/;

export function isValidSkillName(name: string): boolean {
  return typeof name === "string" && name.length > 0 && name.length <= 64 && NAME_RE.test(name);
}

export function isSkillEnabled(name: string): boolean {
  if (!isValidSkillName(name)) return true;
  const row = getDb()
    .prepare("SELECT enabled FROM skill_states WHERE name = ?")
    .get(name) as { enabled: number } | undefined;
  if (!row) return true;
  return row.enabled === 1;
}

export function setSkillEnabled(name: string, enabled: boolean): boolean {
  if (!isValidSkillName(name)) return false;
  const db = getDb();
  if (enabled) {
    db.prepare("DELETE FROM skill_states WHERE name = ?").run(name);
  } else {
    db.prepare(
      "INSERT INTO skill_states (name, enabled) VALUES (?, 0) ON CONFLICT(name) DO UPDATE SET enabled = 0",
    ).run(name);
  }
  return true;
}

export function getDisabledSkills(): Set<string> {
  const rows = getDb()
    .prepare("SELECT name FROM skill_states WHERE enabled = 0")
    .all() as { name: string }[];
  return new Set(rows.map((r) => r.name));
}

export function toggleSkillEnabled(name: string): { changed: boolean; enabled: boolean } {
  if (!isValidSkillName(name)) return { changed: false, enabled: true };
  const current = isSkillEnabled(name);
  setSkillEnabled(name, !current);
  return { changed: true, enabled: !current };
}
