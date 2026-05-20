import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm, symlink, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { readSkillsDir } from "@/lib/skill-fs";

describe("readSkillsDir — symlink handling", () => {
  let workDir: string;
  let projectSkills: string;

  beforeAll(async () => {
    workDir = await mkdtemp(path.join(tmpdir(), "skill-fs-symlink-"));
    const sourceTree = path.join(workDir, "source");
    projectSkills = path.join(workDir, "project");
    await mkdir(sourceTree, { recursive: true });
    await mkdir(projectSkills, { recursive: true });

    // 1) Real skill living outside the project tree.
    const realSkillDir = path.join(sourceTree, "linked-skill");
    await mkdir(realSkillDir, { recursive: true });
    await writeFile(
      path.join(realSkillDir, "SKILL.md"),
      "---\nname: linked-skill\ndescription: lives outside\n---\n",
    );
    await symlink(realSkillDir, path.join(projectSkills, "linked-skill"));

    // 2) Plain on-tree skill directory.
    const inlineSkill = path.join(projectSkills, "inline-skill");
    await mkdir(inlineSkill, { recursive: true });
    await writeFile(
      path.join(inlineSkill, "SKILL.md"),
      "---\nname: inline-skill\ndescription: on tree\n---\n",
    );

    // 3) Broken symlink — target does not exist.
    await symlink(
      path.join(workDir, "missing-target"),
      path.join(projectSkills, "broken-link"),
    );

    // 4) Symlink that points to a file, not a directory.
    const stray = path.join(sourceTree, "stray.txt");
    await writeFile(stray, "not a skill");
    await symlink(stray, path.join(projectSkills, "file-link"));
  });

  afterAll(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it("follows symlinks that resolve to skill directories", async () => {
    const entries = await readSkillsDir(projectSkills);
    const names = entries.map((e) => e.name);
    expect(names).toContain("linked-skill");
  });

  it("still picks up regular on-tree skill directories", async () => {
    const entries = await readSkillsDir(projectSkills);
    const names = entries.map((e) => e.name);
    expect(names).toContain("inline-skill");
  });

  it("returns the symlinked skill's parsed frontmatter", async () => {
    const entries = await readSkillsDir(projectSkills);
    const found = entries.find((e) => e.name === "linked-skill");
    expect(found?.description).toBe("lives outside");
  });

  it("ignores broken symlinks", async () => {
    const entries = await readSkillsDir(projectSkills);
    const names = entries.map((e) => e.name);
    expect(names).not.toContain("broken-link");
  });

  it("ignores symlinks that point to files instead of directories", async () => {
    const entries = await readSkillsDir(projectSkills);
    const names = entries.map((e) => e.name);
    expect(names).not.toContain("file-link");
  });
});
