import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { migrate } from "@/lib/db";

const version = (db: Database.Database) => db.pragma("user_version", { simple: true }) as number;
const columns = (db: Database.Database, table: string) =>
  (db.pragma(`table_info(${table})`) as { name: string }[]).map((c) => c.name);

const V1 = `CREATE TABLE IF NOT EXISTS agents (id TEXT PRIMARY KEY, name TEXT NOT NULL);`;
const V2 = `ALTER TABLE agents ADD COLUMN colour TEXT;`;

describe("migrate", () => {
  it("builds the schema from an empty database", () => {
    const db = new Database(":memory:");
    expect(migrate(db, [V1])).toBe(1);
    expect(version(db)).toBe(1);
    expect(columns(db, "agents")).toContain("name");
  });

  it("applies a later step to a database that already has data", () => {
    // The whole point. "CREATE TABLE IF NOT EXISTS" is a no-op against an
    // existing database, so before this a new column simply never appeared —
    // and nothing said so.
    const db = new Database(":memory:");
    migrate(db, [V1]);
    db.prepare("INSERT INTO agents (id,name) VALUES (?,?)").run("a", "Agent-One");

    expect(migrate(db, [V1, V2])).toBe(2);
    expect(version(db)).toBe(2);
    expect(columns(db, "agents")).toContain("colour");
    // Existing rows survive the upgrade.
    expect(db.prepare("SELECT name FROM agents WHERE id = 'a'").get()).toEqual({
      name: "Agent-One",
    });
  });

  it("does nothing on a database already at the current version", () => {
    const db = new Database(":memory:");
    migrate(db, [V1, V2]);
    expect(migrate(db, [V1, V2])).toBe(2);
    expect(version(db)).toBe(2);
  });

  it("leaves the version behind a step that failed, so nothing is half-applied", () => {
    const db = new Database(":memory:");
    migrate(db, [V1]);
    expect(() => migrate(db, [V1, "THIS IS NOT SQL;"])).toThrow(/step 2/);
    expect(version(db)).toBe(1);
    // The good step before it is intact, so a fixed step resumes from here.
    expect(columns(db, "agents")).toContain("name");
  });

  it("rolls back everything in a step that fails part way", () => {
    const db = new Database(":memory:");
    const half = `CREATE TABLE good (x TEXT); THIS IS NOT SQL;`;
    expect(() => migrate(db, [half])).toThrow();
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as { name: string }[];
    expect(tables.map((t) => t.name)).not.toContain("good");
  });
});
