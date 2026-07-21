/**
 * Explains a run that ended on anything other than success, so a stopped agent
 * says why instead of just going quiet. Returns null for a normal finish.
 *
 * Subtypes come from the SDK result message (SDKResultError):
 * error_max_turns | error_max_budget_usd | error_during_execution |
 * error_max_structured_output_retries.
 */
export function runEndedMessage(
  subtype: string | null | undefined,
  numTurns?: number | null,
  errors?: string[] | null
): string | null {
  if (!subtype || subtype === "success") return null;

  const detail = errors && errors.length > 0 ? ` — ${errors.join("; ")}` : "";
  switch (subtype) {
    case "error_max_turns": {
      const turns = numTurns ? ` after ${numTurns} turns` : "";
      return `Stopped at the turn limit${turns}. Send another message to continue, or raise CHAT_MAX_TURNS.${detail}`;
    }
    case "error_max_budget_usd":
      return `Stopped at the cost limit.${detail}`;
    case "error_max_structured_output_retries":
      return `Stopped after too many structured-output retries.${detail}`;
    case "error_during_execution":
      return `Run ended with an error.${detail}`;
    default:
      return `Run ended: ${subtype}.${detail}`;
  }
}
