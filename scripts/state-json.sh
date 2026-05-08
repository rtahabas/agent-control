#!/usr/bin/env bash
# state-json.sh
# Emits full agent state as JSON to stdout. Reads agent root via --root.
# Used by /api/state route. Bash 3.2 compatible.
#
# Usage: state-json.sh --root <agent-root-path>

set -u

AGENT_ROOT=""
SKILL_STATS="$(dirname "$0")/skill-stats.sh"

while [ $# -gt 0 ]; do
  case "$1" in
    --root) AGENT_ROOT="$2"; shift 2 ;;
    -h|--help) sed -n '2,6p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

if [ -z "$AGENT_ROOT" ]; then
  echo "missing --root <agent-root-path>" >&2
  exit 2
fi

WORKSPACE="$AGENT_ROOT/workspace"
SKILLS_DIR="$AGENT_ROOT/.claude/skills"
AGENTS_DIR="$AGENT_ROOT/.claude/agents"
MEMORY_DIR="$AGENT_ROOT/memory"
SETTINGS="$AGENT_ROOT/.claude/settings.json"

now_utc() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

extract_repo() {
  echo "$1" | sed -E 's#\.git$##; s#.*[:/]([^/]+/[^/]+)$#\1#'
}

gh_count() {
  local repo="$1" kind="$2" json
  if json=$(gh "$kind" list --repo "$repo" --state open --json number 2>/dev/null); then
    if [ -n "$json" ]; then
      echo "$json" | jq 'length' 2>/dev/null || echo "null"
    else
      echo "null"
    fi
  else
    echo "null"
  fi
}

count_md_in()    { find "$1" -maxdepth 1 -name '*.md' -type f 2>/dev/null | wc -l | tr -d ' '; }
count_lines_in() { local n; n=$(wc -l "$1"/*.md 2>/dev/null | tail -1 | awk '{print $1}'); echo "${n:-0}"; }
count_recent()   { find "$1" -maxdepth 1 -name '*.md' -type f -mtime -"$2" 2>/dev/null | wc -l | tr -d ' '; }
count_prefix()   { find "$1" -maxdepth 1 -name "${2}*.md" -type f 2>/dev/null | wc -l | tr -d ' '; }

count_hooks_for_event() {
  jq -r --arg e "$1" '.hooks[$e] // [] | map(.hooks // []) | add // [] | length' "$SETTINGS" 2>/dev/null || echo 0
}

project_obj() {
  local proj="$1" path="$WORKSPACE/$1"
  local branch=null status=null last_commit=null prs=null issues=null repo=null
  branch_str="—"; status_str="n/a"; last_str=null
  if [ -d "$path/.git" ]; then
    branch_str=$(git -C "$path" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "—")
    if [ -n "$(git -C "$path" status --porcelain 2>/dev/null)" ]; then
      if git -C "$path" diff --quiet 2>/dev/null && git -C "$path" diff --cached --quiet 2>/dev/null; then
        status_str="untracked"
      else
        status_str="dirty"
      fi
    else
      status_str="clean"
    fi
    last_str=$(git -C "$path" log -1 --format="%cd" --date=short 2>/dev/null || echo "")
    if url=$(git -C "$path" remote get-url origin 2>/dev/null) && [ -n "$url" ]; then
      repo_str=$(extract_repo "$url")
      prs_n=$(gh_count "$repo_str" pr)
      issues_n=$(gh_count "$repo_str" issue)
      jq -n \
        --arg name "$proj" \
        --arg branch "$branch_str" \
        --arg status "$status_str" \
        --arg last_commit "$last_str" \
        --arg repo "$repo_str" \
        --argjson prs "$prs_n" \
        --argjson issues "$issues_n" \
        '{name:$name, branch:$branch, status:$status, last_commit:$last_commit, repo:$repo, open_prs:$prs, open_issues:$issues, is_git:true}'
      return
    fi
  fi
  jq -n \
    --arg name "$proj" \
    --arg branch "$branch_str" \
    --arg status "$status_str" \
    --arg last_commit "$last_str" \
    '{name:$name, branch:$branch, status:$status, last_commit:$last_commit, repo:null, open_prs:null, open_issues:null, is_git:false}'
}

# ----- collect -----
GENERATED=$(now_utc)

PROJECTS=()
if [ -d "$WORKSPACE" ]; then
  while IFS= read -r d; do PROJECTS+=("$(basename "$d")"); done \
    < <(find "$WORKSPACE" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sort)
fi

PROJECTS_JSON=$(
  first=1; printf '['
  for p in "${PROJECTS[@]:-}"; do
    [ -z "$p" ] && continue
    [ $first -eq 0 ] && printf ','
    first=0
    project_obj "$p"
  done
  printf ']'
)

SKILLS_JSON=$("$SKILL_STATS" --json --root "$AGENT_ROOT")

AGENT_LIST=()
while IFS= read -r f; do AGENT_LIST+=("$(basename "$f" .md)"); done \
  < <(find "$AGENTS_DIR" -mindepth 1 -maxdepth 1 -name '*.md' -type f 2>/dev/null | sort)
AGENTS_JSON=$(printf '%s\n' "${AGENT_LIST[@]:-}" | jq -R . | jq -s 'map(select(. != ""))')

MEM_TOTAL=$(count_md_in "$MEMORY_DIR")
MEM_LINES=$(count_lines_in "$MEMORY_DIR")
MEM_RECENT_7=$(count_recent "$MEMORY_DIR" 7)
MEM_RECENT_30=$(count_recent "$MEMORY_DIR" 30)
MEM_FB=$(count_prefix "$MEMORY_DIR" "feedback_")
MEM_PROJ=$(count_prefix "$MEMORY_DIR" "project_")
MEM_PEND=$(count_prefix "$MEMORY_DIR" "pending_")
MEM_OTHER=$((MEM_TOTAL - MEM_FB - MEM_PROJ - MEM_PEND))

INDEX_FILES=()
while IFS= read -r f; do INDEX_FILES+=("$(basename "$f")"); done \
  < <(find "$MEMORY_DIR" -maxdepth 1 \( -name 'INDEX*.md' -o -name 'AGENTSKILLS.md' -o -name 'MEMORY.md' -o -name 'GUARDRAILS.md' -o -name 'HEARTBEAT.md' -o -name 'today.md' -o -name 'commitments.md' \) -type f 2>/dev/null | sort)
INDEX_JSON=$(printf '%s\n' "${INDEX_FILES[@]:-}" | jq -R . | jq -s 'map(select(. != ""))')

PENDING_JSON=$(
  if [ -f "$MEMORY_DIR/INDEX-pending.md" ]; then
    grep -E '^- \[' "$MEMORY_DIR/INDEX-pending.md" | jq -R . | jq -s .
  else
    echo "[]"
  fi
)

H_SESSIONSTART=$(count_hooks_for_event SessionStart)
H_PRETOOL=$(count_hooks_for_event PreToolUse)
H_POSTTOOL=$(count_hooks_for_event PostToolUse)
H_STOP=$(count_hooks_for_event Stop)

# ----- health -----
HOT_FILE="$MEMORY_DIR/MEMORY.md"
HOT_CAP=100
if [ -f "$HOT_FILE" ]; then
  HOT_LINES=$(wc -l < "$HOT_FILE" | tr -d ' ')
else
  HOT_LINES=0
fi

DAILY_DIR="$MEMORY_DIR/memory"
NOW_EPOCH=$(date -u +%s)
STALE_LINES=()
if [ -d "$DAILY_DIR" ]; then
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    name=$(basename "$f")
    date_str=$(printf '%s' "$name" | grep -oE '^[0-9]{4}-[0-9]{2}-[0-9]{2}' || true)
    [ -z "$date_str" ] && continue
    file_epoch=$(date -u -j -f "%Y-%m-%d" "$date_str" +%s 2>/dev/null || date -u -d "$date_str" +%s 2>/dev/null || echo "")
    [ -z "$file_epoch" ] && continue
    days=$(( (NOW_EPOCH - file_epoch) / 86400 ))
    [ "$days" -le 30 ] && continue
    STALE_LINES+=("$(jq -nc --arg n "$name" --argjson d "$days" '{file:$n, days_old:$d}')")
  done < <(find "$DAILY_DIR" -maxdepth 1 -name '20[0-9][0-9]-[0-9][0-9]-[0-9][0-9]*.md' -type f 2>/dev/null | sort)
fi
if [ ${#STALE_LINES[@]} -eq 0 ]; then
  STALE_DAILY_JSON="[]"
else
  STALE_DAILY_JSON="[$(IFS=,; echo "${STALE_LINES[*]}")]"
fi

jq -n \
  --arg generated "$GENERATED" \
  --argjson projects "$PROJECTS_JSON" \
  --argjson skills "$SKILLS_JSON" \
  --argjson agents "$AGENTS_JSON" \
  --argjson indexes "$INDEX_JSON" \
  --argjson pending "$PENDING_JSON" \
  --argjson mem_total "$MEM_TOTAL" \
  --argjson mem_lines "$MEM_LINES" \
  --argjson mem_recent_7 "$MEM_RECENT_7" \
  --argjson mem_recent_30 "$MEM_RECENT_30" \
  --argjson mem_fb "$MEM_FB" \
  --argjson mem_proj "$MEM_PROJ" \
  --argjson mem_pend "$MEM_PEND" \
  --argjson mem_other "$MEM_OTHER" \
  --argjson h_start "$H_SESSIONSTART" \
  --argjson h_pre "$H_PRETOOL" \
  --argjson h_post "$H_POSTTOOL" \
  --argjson h_stop "$H_STOP" \
  --argjson hot_lines "$HOT_LINES" \
  --argjson hot_cap "$HOT_CAP" \
  --argjson stale_daily "$STALE_DAILY_JSON" \
  '{
    generated: $generated,
    projects: $projects,
    skills: $skills,
    sub_agents: $agents,
    memory: {
      total_files: $mem_total,
      total_lines: $mem_lines,
      modified_last_7d: $mem_recent_7,
      modified_last_30d: $mem_recent_30,
      categories: { feedback: $mem_fb, project: $mem_proj, pending: $mem_pend, other: $mem_other },
      indexes: $indexes,
      hot_lines: $hot_lines,
      hot_cap: $hot_cap
    },
    pending: $pending,
    hooks: { SessionStart: $h_start, PreToolUse: $h_pre, PostToolUse: $h_post, Stop: $h_stop },
    health: {
      stale_daily_logs: $stale_daily
    }
  }'
