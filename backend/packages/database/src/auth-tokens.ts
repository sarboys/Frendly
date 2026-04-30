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

export interface PartnerAccessTokenPayload extends JwtPayload {
  partnerAccountId: string;
  sessionId: string;
  kind: 'partner_access';
}

export interface PartnerRefreshTokenPayload extends JwtPayload {
  partnerAccountId: string;
  sessionId: string;
  refreshTokenId: string;
  kind: 'partner_refresh';
}

export interface AdminAccessTokenPayload extends JwtPayload {
  adminUserId: string;
  sessionId: string;
  kind: 'admin_access';
}

export interface AdminRefreshTokenPayload extends JwtPayload {
  adminUserId: string;
  sessionId: string;
  refreshTokenId: string;
  kind: 'admin_refresh';
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

export function signPartnerAccessToken(
  partnerAccountId: string,
  sessionId: string,
): string {
  const config = getJwtConfig();
  const options: SignOptions = {
    expiresIn: config.accessTtl as SignOptions['expiresIn'],
  };

  return jwt.sign(
    { partnerAccountId, sessionId, kind: 'partner_access' },
    config.accessSecret,
    options,
  );
}

export function signPartnerRefreshToken(
  partnerAccountId: string,
  sessionId: string,
  refreshTokenId: string,
): string {
  const config = getJwtConfig();
  const options: SignOptions = {
    expiresIn: config.refreshTtl as SignOptions['expiresIn'],
  };

  return jwt.sign(
    { partnerAccountId, sessionId, refreshTokenId, kind: 'partner_refresh' },
    config.refreshSecret,
    options,
  );
}

export function signAdminAccessToken(
  adminUserId: string,
  sessionId: string,
): string {
  const config = getJwtConfig();
  const options: SignOptions = {
    expiresIn: config.accessTtl as SignOptions['expiresIn'],
  };

  return jwt.sign(
    { adminUserId, sessionId, kind: 'admin_access' },
    config.accessSecret,
    options,
  );
}

export function signAdminRefreshToken(
  adminUserId: string,
  sessionId: string,
  refreshTokenId: string,
): string {
  const config = getJwtConfig();
  const options: SignOptions = {
    expiresIn: config.refreshTtl as SignOptions['expiresIn'],
  };

  return jwt.sign(
    { adminUserId, sessionId, refreshTokenId, kind: 'admin_refresh' },
    config.refreshSecret,
    options,
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const config = getJwtConfig();
  const payload = jwt.verify(token, config.accessSecret);
  if (!isAccessTokenPayload(payload)) {
    throw new Error('Invalid access token payload');
  }

  return payload;
}

export function verifyPartnerAccessToken(token: string): PartnerAccessTokenPayload {
  const config = getJwtConfig();
  const payload = jwt.verify(token, config.accessSecret);
  if (!isPartnerAccessTokenPayload(payload)) {
    throw new Error('Invalid partner access token payload');
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

export function verifyPartnerRefreshToken(token: string): PartnerRefreshTokenPayload {
  const config = getJwtConfig();
  const payload = jwt.verify(token, config.refreshSecret);
  if (!isPartnerRefreshTokenPayload(payload)) {
    throw new Error('Invalid partner refresh token payload');
  }

  return payload;
}

export function verifyAdminAccessToken(token: string): AdminAccessTokenPayload {
  const config = getJwtConfig();
  const payload = jwt.verify(token, config.accessSecret);
  if (!isAdminAccessTokenPayload(payload)) {
    throw new Error('Invalid admin access token payload');
  }

  return payload;
}

export function verifyAdminRefreshToken(token: string): AdminRefreshTokenPayload {
  const config = getJwtConfig();
  const payload = jwt.verify(token, config.refreshSecret);
  if (!isAdminRefreshTokenPayload(payload)) {
    throw new Error('Invalid admin refresh token payload');
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

function isPartnerAccessTokenPayload(
  payload: string | JwtPayload,
): payload is PartnerAccessTokenPayload {
  return (
    typeof payload !== 'string' &&
    payload.kind === 'partner_access' &&
    isNonEmptyString(payload.partnerAccountId) &&
    isNonEmptyString(payload.sessionId)
  );
}

function isAdminAccessTokenPayload(
  payload: string | JwtPayload,
): payload is AdminAccessTokenPayload {
  return (
    typeof payload !== 'string' &&
    payload.kind === 'admin_access' &&
    isNonEmptyString(payload.adminUserId) &&
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

function isPartnerRefreshTokenPayload(
  payload: string | JwtPayload,
): payload is PartnerRefreshTokenPayload {
  return (
    typeof payload !== 'string' &&
    payload.kind === 'partner_refresh' &&
    isNonEmptyString(payload.partnerAccountId) &&
    isNonEmptyString(payload.sessionId) &&
    isNonEmptyString(payload.refreshTokenId)
  );
}

function isAdminRefreshTokenPayload(
  payload: string | JwtPayload,
): payload is AdminRefreshTokenPayload {
  return (
    typeof payload !== 'string' &&
    payload.kind === 'admin_refresh' &&
    isNonEmptyString(payload.adminUserId) &&
    isNonEmptyString(payload.sessionId) &&
    isNonEmptyString(payload.refreshTokenId)
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
