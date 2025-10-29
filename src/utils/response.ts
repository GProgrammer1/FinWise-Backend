import { Response } from 'express';

export interface ApiResponse<T = any> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export function successResponse<T>(res: Response, data: T, status = 200): Response {
  return res.status(status).json({
    ok: true,
    data,
  } as ApiResponse<T>);
}

export function errorResponse(
  res: Response,
  code: string,
  message: string,
  status = 400,
  details?: any
): Response {
  return res.status(status).json({
    ok: false,
    error: {
      code,
      message,
      details,
    },
  } as ApiResponse);
}

// Common error responses
export const errors = {
  badRequest: (res: Response, message = 'Bad request', details?: any) =>
    errorResponse(res, 'BAD_REQUEST', message, 400, details),
  
  unauthorized: (res: Response, message = 'Unauthorized') =>
    errorResponse(res, 'UNAUTHORIZED', message, 401),
  
  forbidden: (res: Response, message = 'Forbidden') =>
    errorResponse(res, 'FORBIDDEN', message, 403),
  
  notFound: (res: Response, message = 'Not found') =>
    errorResponse(res, 'NOT_FOUND', message, 404),
  
  conflict: (res: Response, message = 'Conflict') =>
    errorResponse(res, 'CONFLICT', message, 409),
  
  unsupportedMedia: (res: Response, message = 'Unsupported media type') =>
    errorResponse(res, 'UNSUPPORTED_MEDIA', message, 415),
  
  tooManyRequests: (res: Response, message = 'Too many requests') =>
    errorResponse(res, 'TOO_MANY_REQUESTS', message, 429),
  
  internal: (res: Response, message = 'Internal server error') =>
    errorResponse(res, 'INTERNAL_ERROR', message, 500),
};
