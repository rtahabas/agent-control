#!/usr/bin/env bash
# skill-stats.sh
# Reads memory/memory/skill-activity.log + cross-references .claude/skills/ inventory.
# Outputs ACTIVE / INACTIVE / DEAD categories with invocation counts.
#
# Usage:
#   skill-stats.sh --root <agent-root>            # terminal output, 30-day window
#   skill-stats.sh --root <agent-root> --md       # markdown table
#   skill-stats.sh --root <agent-root> --json     # json output
#   skill-stats.sh --root <agent-root> --days 7   # filter window
#
# PII-safe: log already strips args content; this script reads counts only.
# Bash 3.2 compatible (no associative arrays).

set -u

AGENT_ROOT=""
WINDOW_DAYS=30
MODE="terminal"

while [ $# -gt 0 ]; do
  case "$1" in
    --md) MODE="md"; shift ;;
    --json) MODE="json"; shift ;;
    --days) WINDOW_DAYS="$2"; shift 2 ;;
    --root) AGENT_ROOT="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

if [ -z "$AGENT_ROOT" ]; then
  echo "missing --root <agent-root-path>" >&2
  exit 2
fi

LOG_FILE="$AGENT_ROOT/memory/memory/skill-activity.log"
SKILLS_DIR="$AGENT_ROOT/.claude/skills"

if [ "$MODE" != "json" ]; then
  [ -d "$SKILLS_DIR" ] || { echo "skills dir missing: $SKILLS_DIR" >&2; exit 1; }
  [ -f "$LOG_FILE" ]  || { echo "log file missing: $LOG_FILE" >&2; exit 1; }
fi

iso_to_epoch() {
  local s=$1
  s=${s%Z}; s=${s/T/ }
  date -u -j -f "%Y-%m-%d %H:%M:%S" "$s" +%s 2>/dev/null \
    || date -u -d "$s" +%s 2>/dev/null \
    || echo ""
}

CUTOFF_EPOCH=$(date -u -v-"${WINDOW_DAYS}"d +%s 2>/dev/null || date -u -d "${WINDOW_DAYS} days ago" +%s)
INACTIVE_CUTOFF=$(date -u -v-14d +%s 2>/dev/null || date -u -d "14 days ago" +%s)

INSTALLED=()
while IFS= read -r d; do
  INSTALLED+=("$(basename "$d")")
done < <(find "$SKILLS_DIR" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sort)

LOG_TS=()
LOG_SKILL=()
SKIPPED=0
TOTAL_INV=0

if [ -f "$LOG_FILE" ]; then
  while IFS= read -r line; do
    case "$line" in ''|'#'*) continue ;; esac
    ts=$(printf '%s' "$line" | awk -F' \\| ' '{print $1}')
    skill=$(printf '%s' "$line" | awk -F' \\| ' '{print $2}')
    if [ -z "$ts" ] || [ -z "$skill" ]; then
      SKIPPED=$((SKIPPED+1)); continue
    fi
    ep=$(iso_to_epoch "$ts")
    if [ -z "$ep" ]; then
      SKIPPED=$((SKIPPED+1)); continue
    fi
    [ "$ep" -lt "$CUTOFF_EPOCH" ] && continue
    LOG_TS+=("$ts")
    LOG_SKILL+=("$skill")
    TOTAL_INV=$((TOTAL_INV+1))
  done < "$LOG_FILE"
fi

ACTIVE_LINES=()
INACTIVE_LINES=()
DEAD_NAMES=()
EXTERNAL_LINES=()

is_installed() {
  local needle=$1 i
  i=0
  while [ "$i" -lt "${#INSTALLED[@]}" ]; do
    [ "${INSTALLED[$i]}" = "$needle" ] && return 0
    i=$((i+1))
  done
  return 1
}

LOG_UNIQUE=$(printf '%s\n' "${LOG_SKILL[@]:-}" | sort -u | grep -v '^$' || true)
while IFS= read -r ext; do
  [ -z "$ext" ] && continue
  if ! is_installed "$ext"; then
    count=0; last=""
    i=0
    while [ "$i" -lt "${#LOG_SKILL[@]}" ]; do
      if [ "${LOG_SKILL[$i]}" = "$ext" ]; then
        count=$((count+1))
        cur="${LOG_TS[$i]}"
        if [ -z "$last" ] || [ "$cur" \> "$last" ]; then last="$cur"; fi
      fi
      i=$((i+1))
    done
    EXTERNAL_LINES+=("$count	$last	$ext")
  fi
done <<< "$LOG_UNIQUE"

for s in ${INSTALLED[@]+"${INSTALLED[@]}"}; do
  count=0
  last=""
  i=0
  while [ "$i" -lt "${#LOG_SKILL[@]}" ]; do
    if [ "${LOG_SKILL[$i]}" = "$s" ]; then
      count=$((count+1))
      cur="${LOG_TS[$i]}"
      if [ -z "$last" ] || [ "$cur" \> "$last" ]; then
        last="$cur"
      fi
    fi
    i=$((i+1))
  done
  if [ "$count" -eq 0 ]; then
    DEAD_NAMES+=("$s")
  else
    last_ep=$(iso_to_epoch "$last")
    if [ -n "$last_ep" ] && [ "$last_ep" -lt "$INACTIVE_CUTOFF" ]; then
      INACTIVE_LINES+=("$count	$last	$s")
    else
      ACTIVE_LINES+=("$count	$last	$s")
    fi
  fi
done

sort_lines() {
  if [ $# -eq 0 ]; then return 0; fi
  printf '%s\n' "$@" | sort -t $'\t' -k1,1nr -k2,2r
}

emit_skill_array() {
  local first=1
  printf '['
  for line in "$@"; do
    [ -z "$line" ] && continue
    [ $first -eq 0 ] && printf ','
    first=0
    IFS=$'\t' read -r c ts s <<< "$line"
    jq -nc --arg s "$s" --argjson c "$c" --arg ts "$ts" \
      '{skill:$s, invocations:$c, last_invoked:$ts}'
  done
  printf ']'
}

emit_dead_array() {
  local first=1
  printf '['
  for s in "$@"; do
    [ -z "$s" ] && continue
    [ $first -eq 0 ] && printf ','
    first=0
    jq -nc --arg s "$s" '{skill:$s, invocations:0, last_invoked:null}'
  done
  printf ']'
}

if [ "$MODE" = "json" ]; then
  active_json=$(emit_skill_array "${ACTIVE_LINES[@]:-}")
  inactive_json=$(emit_skill_array "${INACTIVE_LINES[@]:-}")
  external_json=$(emit_skill_array "${EXTERNAL_LINES[@]:-}")
  dead_json=$(emit_dead_array "${DEAD_NAMES[@]:-}")
  jq -n \
    --argjson active "$active_json" \
    --argjson inactive "$inactive_json" \
    --argjson dead "$dead_json" \
    --argjson external "$external_json" \
    --argjson installed_count "${#INSTALLED[@]}" \
    --argjson total_inv "$TOTAL_INV" \
    --argjson skipped "$SKIPPED" \
    --argjson window_days "$WINDOW_DAYS" \
    '{
      window_days: $window_days,
      installed_count: $installed_count,
      total_invocations: $total_inv,
      skipped_entries: $skipped,
      active: $active,
      inactive: $inactive,
      dead: $dead,
      external: $external
    }'
  exit 0
fi

if [ "$MODE" = "md" ]; then
  echo "## Agent-One Skill Stats (last ${WINDOW_DAYS} days)"
  echo
  echo "| Status | Skill | Invocations | Last invoked |"
  echo "|---|---|---:|---|"
  while IFS=$'\t' read -r c ts s; do
    [ -z "$s" ] && continue
    echo "| ACTIVE | \`$s\` | $c | $ts |"
  done < <(sort_lines "${ACTIVE_LINES[@]:-}")
  while IFS=$'\t' read -r c ts s; do
    [ -z "$s" ] && continue
    echo "| INACTIVE | \`$s\` | $c | $ts |"
  done < <(sort_lines "${INACTIVE_LINES[@]:-}")
  for s in "${DEAD_NAMES[@]:-}"; do
    [ -z "$s" ] && continue
    echo "| DEAD | \`$s\` | 0 | — |"
  done
  while IFS=$'\t' read -r c ts s; do
    [ -z "$s" ] && continue
    echo "| EXTERNAL | \`$s\` | $c | $ts |"
  done < <(sort_lines "${EXTERNAL_LINES[@]:-}")
  echo
  echo "**Total:** ${#INSTALLED[@]} installed (project-tier) | ${#ACTIVE_LINES[@]} active | ${#INACTIVE_LINES[@]} inactive | ${#DEAD_NAMES[@]} dead | ${#EXTERNAL_LINES[@]} external | $TOTAL_INV invocations"
  [ "$SKIPPED" -gt 0 ] && echo "_($SKIPPED malformed log entries skipped)_"
  exit 0
fi

echo "=== Agent-One Skill Stats (last ${WINDOW_DAYS} days) ==="
echo
echo "ACTIVE (${#ACTIVE_LINES[@]})"
if [ "${#ACTIVE_LINES[@]}" -eq 0 ]; then
  echo "  (none)"
else
  while IFS=$'\t' read -r c ts s; do
    [ -z "$s" ] && continue
    printf "  %-28s %d invocations    last %s\n" "$s" "$c" "$ts"
  done < <(sort_lines "${ACTIVE_LINES[@]}")
fi
echo
echo "INACTIVE (${#INACTIVE_LINES[@]} — used but >14d idle)"
if [ "${#INACTIVE_LINES[@]}" -eq 0 ]; then
  echo "  (none)"
else
  while IFS=$'\t' read -r c ts s; do
    [ -z "$s" ] && continue
    printf "  %-28s %d invocations    last %s\n" "$s" "$c" "$ts"
  done < <(sort_lines "${INACTIVE_LINES[@]}")
fi
echo
echo "DEAD (${#DEAD_NAMES[@]} — never invoked in window)"
if [ "${#DEAD_NAMES[@]}" -eq 0 ]; then
  echo "  (none)"
else
  printf '%s, ' "${DEAD_NAMES[@]}" | sed 's/, $//' | fold -s -w 70 | sed 's/^/  /'
  echo
fi
echo
echo "EXTERNAL (${#EXTERNAL_LINES[@]} — invoked but not in project-tier .claude/skills/)"
if [ "${#EXTERNAL_LINES[@]}" -eq 0 ]; then
  echo "  (none)"
else
  while IFS=$'\t' read -r c ts s; do
    [ -z "$s" ] && continue
    printf "  %-28s %d invocations    last %s\n" "$s" "$c" "$ts"
  done < <(sort_lines "${EXTERNAL_LINES[@]}")
fi
echo
echo "TOTAL: ${#INSTALLED[@]} installed (project-tier) | ${#ACTIVE_LINES[@]} active | ${#INACTIVE_LINES[@]} inactive | ${#DEAD_NAMES[@]} dead | ${#EXTERNAL_LINES[@]} external | $TOTAL_INV invocations"
[ "$SKIPPED" -gt 0 ] && echo "($SKIPPED malformed log entries skipped)"
exit 0
