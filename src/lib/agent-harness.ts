export type AgentHarnessEmit = (event: string, data: unknown) => void;

export interface AgentHarnessSupportContext {
  readonly provider: string;
  readonly model?: string;
}

export interface AgentHarnessSupport {
  readonly supported: boolean;
  readonly reason?: string;
}

export interface AgentHarnessAttemptParams {
  readonly message: string;
  readonly sessionId: string | null | undefined;
  readonly cwd: string;
  readonly emit: AgentHarnessEmit;
  readonly abortSignal: AbortSignal;
  readonly onClose: () => void;
}

export interface AgentHarnessAttemptResult {
  readonly sessionId: string | null;
  readonly status: "ok" | "error" | "aborted";
  readonly error?: string;
}

export interface AgentHarness {
  readonly id: string;
  readonly label: string;
  readonly pluginId?: string;

  supports(ctx: AgentHarnessSupportContext): AgentHarnessSupport;

  runAttempt(params: AgentHarnessAttemptParams): Promise<AgentHarnessAttemptResult>;

  reset?(): Promise<void> | void;

  dispose?(): Promise<void> | void;
}
