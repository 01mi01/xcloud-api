import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/app.error';

/** Terminal Express error handler. Maps AppError → its status, else 500. */
export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ message: err.message });
    return;
  }
  console.error('[error-handler]', err.message);
  res.status(500).json({ message: 'Internal server error' });
};
