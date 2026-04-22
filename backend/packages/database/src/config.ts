export interface JwtConfig {
  accessSecret: string;
  refreshSecret: string;
  accessTtl: string;
  refreshTtl: string;
}

export function getJwtConfig(): JwtConfig {
  const isProduction = process.env.NODE_ENV === 'production';
  const accessSecret = process.env.JWT_ACCESS_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;

  if (isProduction && (!accessSecret || !refreshSecret)) {
    throw new Error('JWT secrets must be configured in production');
  }

  return {
    accessSecret: accessSecret ?? 'dev-access-secret',
    refreshSecret: refreshSecret ?? 'dev-refresh-secret',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '30d',
  };
}
