export type CoreErrorKind =
  | "spawn_failure"
  | "non_zero_exit"
  | "json_parse_failure"
  | "contract_mismatch"
  | "ok_false"
  | "stale_refresh";

export type CoreCommandRequest = {
  command: "skillrun";
  args: string[];
  cwd?: string;
};

export type CoreProcessSnapshot = {
  durationMs: number;
  exitCode: number;
  stdout: string;
  stderr: string;
};

export abstract class CoreRunnerError extends Error {
  abstract readonly kind: CoreErrorKind;

  protected constructor(
    message: string,
    readonly command: CoreCommandRequest,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class CoreSpawnError extends CoreRunnerError {
  readonly kind = "spawn_failure";

  constructor(
    command: CoreCommandRequest,
    readonly cause: unknown,
    readonly durationMs = 0,
  ) {
    super(`Failed to start ${formatCommand(command)}.`, command);
  }
}

export class CoreNonZeroExitError extends CoreRunnerError {
  readonly kind = "non_zero_exit";
  readonly durationMs: number;
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;

  constructor(command: CoreCommandRequest, snapshot: CoreProcessSnapshot) {
    super(`${formatCommand(command)} exited with code ${snapshot.exitCode}.`, command);
    this.durationMs = snapshot.durationMs;
    this.exitCode = snapshot.exitCode;
    this.stdout = snapshot.stdout;
    this.stderr = snapshot.stderr;
  }
}

export class CoreJsonParseError extends CoreRunnerError {
  readonly kind = "json_parse_failure";

  constructor(
    command: CoreCommandRequest,
    readonly stdout: string,
    readonly detail: string,
    readonly durationMs = 0,
  ) {
    super(`${formatCommand(command)} did not return valid JSON on stdout.`, command);
  }
}

export class CoreContractMismatchError extends CoreRunnerError {
  readonly kind = "contract_mismatch";

  constructor(
    command: CoreCommandRequest,
    readonly field: string,
    readonly detail: string,
    readonly data?: unknown,
    readonly durationMs = 0,
  ) {
    super(`${formatCommand(command)} returned an invalid ${field} contract.`, command);
  }
}

export class CoreOkFalseError extends CoreRunnerError {
  readonly kind = "ok_false";

  constructor(
    command: CoreCommandRequest,
    readonly data: unknown,
    readonly durationMs = 0,
  ) {
    super(`${formatCommand(command)} returned ok=false.`, command);
  }
}

export class CoreStaleRefreshError extends CoreRunnerError {
  readonly kind = "stale_refresh";

  constructor(
    command: CoreCommandRequest,
    readonly ageMs: number,
    readonly maxAgeMs: number,
    readonly durationMs = 0,
  ) {
    super(`${formatCommand(command)} returned stale data.`, command);
  }
}

function formatCommand(command: CoreCommandRequest): string {
  return [command.command, ...command.args].join(" ");
}
