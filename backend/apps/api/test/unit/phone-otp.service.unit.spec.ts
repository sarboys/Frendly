import { PhoneOtpService } from '../../src/services/phone-otp.service';

describe('PhoneOtpService', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      ENABLE_DEV_OTP: 'false',
      PHONE_OTP_DELIVERY_WEBHOOK_URL: 'https://relay.example.com/otp',
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
    } as Response);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('bounds webhook delivery with an abort signal', async () => {
    const service = new PhoneOtpService();

    await service.deliver('+15550000001', '1234', { requestId: 'req-1' });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://relay.example.com/otp',
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
  });
});
