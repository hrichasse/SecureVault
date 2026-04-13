/**
 * Shared Module — barrel export
 *
 * Shared utilities, constants, and helpers used across all modules.
 */

// API response helpers
export function successResponse<T>(data: T, message?: string) {
  return { data, ...(message ? { message } : {}) }
}

export function errorResponse(error: string, code?: string) {
  return { error, ...(code ? { code } : {}) }
}

// HTTP status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
} as const
