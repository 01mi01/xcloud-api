import { Request, Response, NextFunction } from 'express';

/** Minimal request logger. */
export const requestLogger = (req: Request, _res: Response, next: NextFunction): void => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
};
