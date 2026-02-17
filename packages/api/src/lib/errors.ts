import type { Context } from "hono";

export type ApiError = {
  error: string;
  code: string;
  statusCode: number;
};

export function notFound(c: Context, message = "Resource not found"): Response {
  return c.json<ApiError>(
    { error: message, code: "NOT_FOUND", statusCode: 404 },
    404
  );
}

export function badRequest(c: Context, message: string): Response {
  return c.json<ApiError>(
    { error: message, code: "BAD_REQUEST", statusCode: 400 },
    400
  );
}

export function internalError(c: Context, message = "Internal server error"): Response {
  return c.json<ApiError>(
    { error: message, code: "INTERNAL_ERROR", statusCode: 500 },
    500
  );
}
