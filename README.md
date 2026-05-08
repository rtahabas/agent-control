# Agent Dashboard

Single-page operator console for managing multiple Claude Code agents. Each
registered agent is a directory with its own `CLAUDE.md`, `memory/`, and
`.claude/` tree; the dashboard inspects state, chats with the agent (via the
`claude` CLI as a streaming subprocess), and can scaffold fresh agents from a
baseline template.

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript + Tailwind v4
- **better-sqlite3** registry (default `~/.agent-dashboard/agents.db`)
- `react-markdown` + `remark-gfm` + `react-syntax-highlighter` for chat bubbles
- Two bash subprocesses (`scripts/state-json.sh`, `scripts/skill-stats.sh`)
  emit per-agent state as JSON; called via `child_process.execFile`
- `claude -p <msg> --output-format stream-json --include-partial-messages` is
  spawned per chat send. `cwd` is set to the agent's path so `CLAUDE.md`
  auto-load preserves the agent's identity

## Prerequisites

- Node 22+ (for native `better-sqlite3` ABI)
- Claude Code CLI installed and on `PATH` (`claude --version` works)
- `jq`, `sqlite3` (used by the bash state script and DB bootstrap)

## Setup

```bash
npm install
npx node-gyp rebuild --directory node_modules/better-sqlite3   # if Node ABI mismatch
cp .env.example .env.local                                     # then edit
npm run dev                                                    # http://localhost:3000
```

The first run creates `~/.agent-dashboard/agents.db` (or whatever
`AGENT_DB_PATH` points at) with the `agents` table.

## Configuration

`.env.local` (gitignored) controls per-machine paths:

| Var | Purpose | Default |
|---|---|---|
| `AGENT_DB_PATH` | SQLite registry file | `~/.agent-dashboard/agents.db` |
| `SKILLS_SOURCE_DIR` | Source dir whose `<name>/SKILL.md` entries populate the scaffolder catalog | _unset · disables skill picker_ |

## Layout

- **Sidebar:** registered agents, status badge, per-agent toggle / launch / edit / delete, `+ New`
- **Top bar:** `Overview` / `Chat · <agent>` view switch, connection state, refresh
- **Overview:** Projects (git+`gh` open PR/issue counts), Skills (active / inactive / dead / external), Memory (file counts + indexes), Sub-Agents, Hooks (counts per event), Pending
- **Chat:** bubble UI, markdown + code highlighting, SSE streaming, per-agent `sessionStorage` snapshot survives refresh, live token/cost/duration/context stats above the composer

## API

| Path | Method | Notes |
|---|---|---|
| `/api/agents` | GET / POST | registry list / register existing path |
| `/api/agents/[id]` | PATCH / DELETE | edit / unregister |
| `/api/agents/[id]/toggle` | POST | flip active / inactive |
| `/api/agents/[id]/launch` | POST | open Terminal at agent path (macOS) |
| `/api/agents/scaffold` | POST | scaffold fresh tree from `templates/<name>/` + copy selected skills |
| `/api/skills/catalog` | GET | list skills available from `SKILLS_SOURCE_DIR` |
| `/api/state` | GET `?agentId=<id>` | per-agent state JSON (empty payload if no `agentId`) |
| `/api/chat/send` | POST | SSE stream: `session` / `delta` / `done` / `error` |

## Templates

`templates/<name>/` holds skeleton files written into a fresh agent's path.
Token substitution applies to file contents:

| Token | Replaced with |
|---|---|
| `{{AGENT_NAME}}` | agent display name |
| `{{ROLE}}` / `{{MISSION}}` / `{{LANGUAGE}}` / `{{PERSONALITY}}` / `{{HUMAN}}` | identity fields from the create form (fallback values applied when blank) |
| `{{TODAY}}` | scaffold date `YYYY-MM-DD` |

Currently shipped: `blank` (`CLAUDE.md` boot context + memory skeleton +
`GUARDRAILS.md` + minimal `.claude/settings.json`).

## File budget

ESLint enforces `max-lines: 150` per file. Helper extraction (`agent-create.ts`,
`scaffolder.ts`, `skills-catalog.ts`, `editor/PersonalityFields.tsx`,
`editor/SkillsPicker.tsx`) keeps the top-level components readable.
