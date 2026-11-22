export class AppError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}
export class NotFoundError extends AppError {
  constructor(what = "Record") {
    super(`${what} not found`, 404, "not_found");
  }
}
export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to do that") {
    super(message, 403, "forbidden");
  }
}
export class UnauthorizedError extends AppError {
  constructor() {
    super("Sign in required", 401, "unauthorized");
  }
}
export class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly issues: string[] = [message],
  ) {
    super(message, 422, "validation");
  }
}
