export class RuncrateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuncrateError";
  }
}

export class ApiError extends RuncrateError {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class BadRequestError extends ApiError {
  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message, 400, code, details);
    this.name = "BadRequestError";
  }
}

export class AuthenticationError extends ApiError {
  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message, 401, code, details);
    this.name = "AuthenticationError";
  }
}

export class InsufficientCreditsError extends ApiError {
  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message, 402, code, details);
    this.name = "InsufficientCreditsError";
  }
}

export class PermissionDeniedError extends ApiError {
  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message, 403, code, details);
    this.name = "PermissionDeniedError";
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message, 404, code, details);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends ApiError {
  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message, 409, code, details);
    this.name = "ConflictError";
  }
}

export class RateLimitError extends ApiError {
  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message, 429, code, details);
    this.name = "RateLimitError";
  }
}

export class InternalServerError extends ApiError {
  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message, 500, code, details);
    this.name = "InternalServerError";
  }
}

export class ConnectionError extends RuncrateError {
  constructor(message: string) {
    super(message);
    this.name = "ConnectionError";
  }
}

export class TimeoutError extends RuncrateError {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

type ApiErrorConstructor = new (
  message: string,
  code: string,
  details?: Record<string, unknown>,
) => ApiError;

const STATUS_MAP: Record<number, ApiErrorConstructor> = {
  400: BadRequestError,
  401: AuthenticationError,
  402: InsufficientCreditsError,
  403: PermissionDeniedError,
  404: NotFoundError,
  409: ConflictError,
  429: RateLimitError,
  500: InternalServerError,
};

export function makeApiError(
  statusCode: number,
  body: unknown,
  fallbackMessage: string,
): ApiError {
  let code = "unknown";
  let message = fallbackMessage;
  let details: Record<string, unknown> | undefined;

  if (body && typeof body === "object" && "error" in body) {
    const err = (body as Record<string, unknown>).error;
    if (err && typeof err === "object") {
      const e = err as Record<string, unknown>;
      code = (e.code as string) ?? "unknown";
      message = (e.message as string) ?? fallbackMessage;
      details = e.details as Record<string, unknown> | undefined;
    }
  }

  const Cls = STATUS_MAP[statusCode];
  if (!Cls) {
    return new ApiError(message, statusCode, code, details);
  }
  return new Cls(message, code, details);
}
