import { createSign, generateKeyPairSync } from 'node:crypto';
import { SocialIdentityVerifier } from '../../src/services/social-identity-verifier.service';

describe('SocialIdentityVerifier unit', () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env.APPLE_SIGN_IN_AUDIENCES;

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalEnv == null) {
      delete process.env.APPLE_SIGN_IN_AUDIENCES;
    } else {
      process.env.APPLE_SIGN_IN_AUDIENCES = originalEnv;
    }
  });

  it('verifies apple identity token with configured audience', async () => {
    process.env.APPLE_SIGN_IN_AUDIENCES = 'tech.frendly.app';
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    const jwk = publicKey.export({ format: 'jwk' }) as Record<string, unknown>;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        keys: [
          {
            ...jwk,
            kid: 'apple-kid-1',
            alg: 'RS256',
            use: 'sig',
          },
        ],
      }),
    });

    const now = Math.floor(Date.now() / 1000);
    const token = signJwt(
      {
        alg: 'RS256',
        kid: 'apple-kid-1',
      },
      {
        iss: 'https://appleid.apple.com',
        aud: 'tech.frendly.app',
        sub: 'apple-user-1',
        email: 'private@privaterelay.appleid.com',
        email_verified: 'true',
        iat: now - 10,
        exp: now + 300,
      },
      privateKey,
    );

    await expect(
      new SocialIdentityVerifier().verifyAppleIdentityToken(token, {
        displayName: 'Sergey Polyakov',
      }),
    ).resolves.toEqual({
      provider: 'apple',
      providerUserId: 'apple-user-1',
      email: 'private@privaterelay.appleid.com',
      emailVerified: true,
      displayName: 'Sergey Polyakov',
    });
  });
});

function signJwt(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  privateKey: unknown,
) {
  const input = [
    base64UrlJson(header),
    base64UrlJson(payload),
  ].join('.');
  const signer = createSign('RSA-SHA256');
  signer.update(input);
  signer.end();
  return `${input}.${signer.sign(privateKey as never, 'base64url')}`;
}

function base64UrlJson(value: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}
