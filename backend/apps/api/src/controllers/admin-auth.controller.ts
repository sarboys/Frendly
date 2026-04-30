import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { Admin } from '../common/admin.decorator';
import { CurrentAdmin } from '../common/current-admin.decorator';
import { Public } from '../common/public.decorator';
import { AdminAuthService, AdminTokenPair } from '../services/admin-auth.service';

const ACCESS_COOKIE = 'frendly_admin_access';
const REFRESH_COOKIE = 'frendly_admin_refresh';
const ACCESS_MAX_AGE_MS = 15 * 60 * 1000;
const REFRESH_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Public()
  @Post('login')
  async login(@Body() body: Record<string, unknown>, @Res({ passthrough: true }) response: Response) {
    const result = await this.adminAuthService.login(body);
    this.setAuthCookies(response, result.tokens);
    return { admin: result.admin };
  }

  @Public()
  @Post('refresh')
  async refresh(@Body() body: Record<string, unknown>, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const refreshToken = this.tokenFromBodyOrCookie(body.refreshToken, request, REFRESH_COOKIE);
    const result = await this.adminAuthService.refresh(refreshToken);
    this.setAuthCookies(response, result.tokens);
    return { admin: result.admin };
  }

  @Public()
  @Post('logout')
  async logout(@Body() body: Record<string, unknown>, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const refreshToken = this.tokenFromBodyOrCookie(body.refreshToken, request, REFRESH_COOKIE);
    await this.adminAuthService.logout(refreshToken);
    this.clearAuthCookies(response);
    return { ok: true };
  }

  @Admin()
  @Get('me')
  me(@CurrentAdmin() current: { adminUserId?: string; authMode?: string }) {
    if (current.authMode === 'legacy_token' || !current.adminUserId) {
      return {
        admin: {
          id: 'legacy-token',
          email: 'legacy@frendly',
          displayName: 'Legacy Admin',
          role: 'owner',
        },
      };
    }
    return this.adminAuthService.getMe(current.adminUserId);
  }

  private setAuthCookies(response: Response, tokens: AdminTokenPair) {
    response.cookie(ACCESS_COOKIE, tokens.accessToken, cookieOptions(ACCESS_MAX_AGE_MS));
    response.cookie(REFRESH_COOKIE, tokens.refreshToken, cookieOptions(REFRESH_MAX_AGE_MS));
  }

  private clearAuthCookies(response: Response) {
    response.clearCookie(ACCESS_COOKIE, clearCookieOptions());
    response.clearCookie(REFRESH_COOKIE, clearCookieOptions());
  }

  private tokenFromBodyOrCookie(value: unknown, request: Request, cookieName: string) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
    return parseCookie(request.headers.cookie ?? '')[cookieName] ?? '';
  }
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
    ...(process.env.ADMIN_COOKIE_DOMAIN ? { domain: process.env.ADMIN_COOKIE_DOMAIN } : {}),
  };
}

function clearCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    ...(process.env.ADMIN_COOKIE_DOMAIN ? { domain: process.env.ADMIN_COOKIE_DOMAIN } : {}),
  };
}

function parseCookie(header: string) {
  return Object.fromEntries(
    header
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf('=');
        if (index === -1) {
          return [part, ''];
        }
        return [part.slice(0, index), safeDecode(part.slice(index + 1))];
      }),
  );
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return '';
  }
}
