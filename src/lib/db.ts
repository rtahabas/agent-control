import Database from "better-sqlite3";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

/**
 * Schema history. Append only, never edit a shipped entry.
 *
 * "CREATE TABLE IF NOT EXISTS" alone only ever builds a database from nothing.
 * Against one that already exists it is a no-op, so a column added later would
 * simply never appear — and the failure is silent, which is the dangerous part.
 * This file is shared by every agent and the Telegram bridge, so each of them
 * would carry on against a shape the code no longer believes in.
 *
 * Each step runs once, in order, tracked by SQLite's own user_version.
 */
const MIGRATIONS: string[] = [
  // 1 — the original tables.
  `
  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    notes TEXT
  );
  CREATE TABLE IF NOT EXISTS skill_states (
    name TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 1
  );
  `,
];

/**
 * Brings a database up to the current schema, from empty or from any older
 * version. Each step is its own transaction: a failure half way leaves the
 * version at the last step that completed, so the next start resumes there
 * instead of replaying work already done.
 */
export function migrate(db: Database.Database, steps: string[] = MIGRATIONS): number {
  const current = db.pragma("user_version", { simple: true }) as number;
  for (let v = current; v < steps.length; v++) {
    db.exec("BEGIN");
    try {
      db.exec(steps[v]);
      db.pragma(`user_version = ${v + 1}`);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw new Error(`schema step ${v + 1} failed: ${(e as Error).message}`);
    }
  }
  return steps.length;
}

function dbPath(): string {
  return (
    process.env.AGENT_DB_PATH ||
    path.join(os.homedir(), ".agent-dashboard", "agents.db")
  );
}

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    const file = dbPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    _db = new Database(file);
    _db.pragma("journal_mode = WAL");
    migrate(_db);
  }
  return _db;
}

export interface Agent {
  id: string;
  name: string;
  path: string;
  status: "active" | "inactive";
  created_at: string;
  notes: string | null;
}

export function getAgents(): Agent[] {
  return getDb()
    .prepare("SELECT id,name,path,status,created_at,notes FROM agents ORDER BY created_at")
    .all() as Agent[];
}

export function toggleAgent(id: string): { changed: boolean; status: string | null } {
  const db = getDb();
  const result = db
    .prepare(
      "UPDATE agents SET status = CASE status WHEN 'active' THEN 'inactive' ELSE 'active' END WHERE id = ?"
    )
    .run(id);
  if (result.changes === 0) return { changed: false, status: null };
  const row = db.prepare("SELECT status FROM agents WHERE id = ?").get(id) as
    | { status: string }
    | undefined;
  return { changed: true, status: row?.status ?? null };
}

export function getAgentPath(id: string): string | null {
  const row = getDb()
    .prepare("SELECT path FROM agents WHERE id = ?")
    .get(id) as { path: string } | undefined;
  return row?.path ?? null;
}

export function getAgent(id: string): Agent | null {
  const row = getDb()
    .prepare("SELECT id,name,path,status,created_at,notes FROM agents WHERE id = ?")
    .get(id) as Agent | undefined;
  return row ?? null;
}

export interface CreateAgentInput {
  id: string;
  name: string;
  path: string;
  status?: AgentStatus;
  notes?: string | null;
}
export type AgentStatus = "active" | "inactive";

export function createAgent(input: CreateAgentInput): Agent {
  const status: AgentStatus = input.status ?? "active";
  const created_at = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  getDb()
    .prepare(
      "INSERT INTO agents (id,name,path,status,created_at,notes) VALUES (?,?,?,?,?,?)"
    )
    .run(input.id, input.name, input.path, status, created_at, input.notes ?? null);
  return {
    id: input.id,
    name: input.name,
    path: input.path,
    status,
    created_at,
    notes: input.notes ?? null,
  };
}

export interface UpdateAgentInput {
  name?: string;
  path?: string;
  notes?: string | null;
  status?: AgentStatus;
}

export function updateAgent(id: string, patch: UpdateAgentInput): Agent | null {
  const fields: string[] = [];
  const values: (string | null)[] = [];
  if (patch.name !== undefined) {
    fields.push("name = ?");
    values.push(patch.name);
  }
  if (patch.path !== undefined) {
    fields.push("path = ?");
    values.push(patch.path);
  }
  if (patch.notes !== undefined) {
    fields.push("notes = ?");
    values.push(patch.notes);
  }
  if (patch.status !== undefined) {
    fields.push("status = ?");
    values.push(patch.status);
  }
  if (fields.length === 0) return getAgent(id);
  values.push(id);
  const result = getDb()
    .prepare(`UPDATE agents SET ${fields.join(", ")} WHERE id = ?`)
    .run(...values);
  if (result.changes === 0) return null;
  return getAgent(id);
}

export function deleteAgent(id: string): boolean {
  const result = getDb().prepare("DELETE FROM agents WHERE id = ?").run(id);
  return result.changes > 0;
}
