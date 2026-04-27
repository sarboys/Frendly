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
  const payload = jwt.verify(token, config.accessSecret);
  if (!isAccessTokenPayload(payload)) {
    throw new Error('Invalid access token payload');
  }

  return payload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const config = getJwtConfig();
  const payload = jwt.verify(token, config.refreshSecret);
  if (!isRefreshTokenPayload(payload)) {
    throw new Error('Invalid refresh token payload');
  }

  return payload;
}

function isAccessTokenPayload(payload: string | JwtPayload): payload is AccessTokenPayload {
  return (
    typeof payload !== 'string' &&
    payload.kind === 'access' &&
    isNonEmptyString(payload.userId) &&
    isNonEmptyString(payload.sessionId)
  );
}

function isRefreshTokenPayload(payload: string | JwtPayload): payload is RefreshTokenPayload {
  return (
    typeof payload !== 'string' &&
    payload.kind === 'refresh' &&
    isNonEmptyString(payload.userId) &&
    isNonEmptyString(payload.sessionId) &&
    isNonEmptyString(payload.refreshTokenId)
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
