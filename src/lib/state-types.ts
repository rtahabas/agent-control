export type AgentStatus = "active" | "inactive";
export type ProjectStatus = "clean" | "dirty" | "untracked" | "n/a";
export type SkillCategory = "active" | "inactive" | "dead" | "external";

export interface Agent {
  id: string;
  name: string;
  path: string;
  status: AgentStatus;
  created_at: string;
  notes: string | null;
}

export interface Project {
  name: string;
  branch: string;
  status: ProjectStatus;
  last_commit: string;
  repo: string | null;
  open_prs: number | null;
  open_issues: number | null;
  is_git: boolean;
}

export interface SkillEntry {
  skill: string;
  invocations: number;
  last_invoked: string | null;
}

export interface Skills {
  installed_count: number;
  total_invocations: number;
  window_days: number;
  active: SkillEntry[];
  inactive: SkillEntry[];
  dead: SkillEntry[];
  external: SkillEntry[];
}

export interface Memory {
  total_files: number;
  total_lines: number;
  modified_last_7d: number;
  modified_last_30d: number;
  categories: { feedback: number; project: number; pending: number; other: number };
  indexes: string[];
  hot_lines: number;
  hot_cap: number;
}

export interface StaleDailyLog {
  file: string;
  days_old: number;
}

export interface Health {
  stale_daily_logs: StaleDailyLog[];
}

export interface TimelinePoint {
  date: string;
  count: number;
}

export type SkillTimeline = Record<string, TimelinePoint[]>;

export interface State {
  generated: string;
  projects: Project[];
  skills: Skills;
  sub_agents: string[];
  memory: Memory;
  pending: string[];
  hooks: { SessionStart: number; PreToolUse: number; PostToolUse: number; Stop: number };
  health: Health;
  skill_timeline: SkillTimeline;
}
