import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

/** Express request augmented with the decoded JWT payload. */
export interface AuthedRequest extends Request {
  user?: JwtPayload;
}

// Read the secret lazily (after the service's dotenv.config() has run).
const getSecret = (): string => process.env.JWT_SECRET || 'xcloud-local-dev-secret';

/**
 * Verifies a `Bearer <jwt>` Authorization header and attaches the decoded
 * payload to `req.user`. Consolidates the copy that previously lived in
 * auth/user/tweet/feed/notification services.
 */
export const verifyToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, getSecret()) as JwtPayload;
    (req as AuthedRequest).user = payload;
    next();
  } catch {
    res.status(401).json({ message: 'Token is invalid or expired' });
  }
};
