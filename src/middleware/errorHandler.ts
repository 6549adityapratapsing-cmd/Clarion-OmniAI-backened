import { NextFunction, Request, Response } from 'express';

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const status = err.status || err.statusCode || 500;
  const code = err.code || 'INTERNAL_SERVER_ERROR';
  const message = err.message || 'An unexpected internal error occurred.';
  const details = err.details || null;

  if (status >= 500) {
    console.error('Unhandled Server Error:', err);
  }

  res.status(status).json({
    success: false,
    error: {
      code,
      message,
      details
    }
  });
};
