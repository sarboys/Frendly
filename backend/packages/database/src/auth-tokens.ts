import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';
import { getJwtConfig } from './config';

export interface AccessTokenPayload extends JwtPayload {
  userId: string;
  sessionId: string;
  kind: 'access';
}

export interface RefreshTokenPayload extends JwtPayload {
  userId: string;
  sessionId: string;
  refreshTokenId: string;
  kind: 'refresh';
}

export function signAccessToken(userId: string, sessionId: string): string {
  const config = getJwtConfig();
  const options: SignOptions = {
    expiresIn: config.accessTtl as SignOptions['expiresIn'],
  };

  return jwt.sign({ userId, sessionId, kind: 'access' }, config.accessSecret, options);
}

export function signRefreshToken(userId: string, sessionId: string, refreshTokenId: string): string {
  const config = getJwtConfig();
  const options: SignOptions = {
    expiresIn: config.refreshTtl as SignOptions['expiresIn'],
  };

  return jwt.sign({ userId, sessionId, refreshTokenId, kind: 'refresh' }, config.refreshSecret, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const config = getJwtConfig();
  return jwt.verify(token, config.accessSecret) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const config = getJwtConfig();
  return jwt.verify(token, config.refreshSecret) as RefreshTokenPayload;
}
