export class HttpError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  public constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class TemporaryJobError extends Error {
  public override readonly name = "TemporaryJobError";
}

export class TerminalJobError extends Error {
  public override readonly name = "TerminalJobError";
}
