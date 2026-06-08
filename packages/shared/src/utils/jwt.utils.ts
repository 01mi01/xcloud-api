import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';

const getSecret = (): string => process.env.JWT_SECRET || 'xcloud-local-dev-secret';

export const signToken = (payload: object, options: SignOptions = { expiresIn: '7d' }): string =>
  jwt.sign(payload, getSecret(), options);

export const verifyJwt = (token: string): JwtPayload =>
  jwt.verify(token, getSecret()) as JwtPayload;
