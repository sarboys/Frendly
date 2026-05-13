import { createHash } from 'node:crypto';
import { TbankAcquiringService } from '../../src/services/tbank-acquiring.service';

describe('TbankAcquiringService unit', () => {
  const config = {
    terminalKey: 'test-terminal',
    password: 'test-password',
    apiUrl: 'https://securepay.test',
    timeoutMs: 1000,
  };

  afterEach(() => {
    delete process.env.PAYMENTS_TBANK_ENABLED;
  });

  it('builds token from root fields only and excludes nested payment data', () => {
    const service = new TbankAcquiringService(config, jest.fn() as any);
    const token = service.buildToken({
      TerminalKey: 'test-terminal',
      Amount: 1000,
      OrderId: 'order-1',
      Token: 'client-token',
      DATA: {
        userId: 'user-1',
      },
      Receipt: {
        Email: 'buyer@example.com',
      },
    });

    const expected = createHash('sha256')
      .update('1000order-1test-passwordtest-terminal', 'utf8')
      .digest('hex');
    expect(token).toBe(expected);
  });

  it('sends signed Init request without leaking password into the payload', async () => {
    process.env.PAYMENTS_TBANK_ENABLED = 'true';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        Success: true,
        PaymentId: 'payment-1',
        PaymentURL: 'https://pay.test/form',
        Status: 'NEW',
      }),
    });
    const service = new TbankAcquiringService(config, fetchMock as any);

    await expect(
      service.initPayment({
        Amount: 1000,
        OrderId: 'order-1',
        Description: 'Frendly+',
        NotificationURL: 'https://api.test/payments/tbank/webhook',
        SuccessURL: 'frendly://payment/success?orderId=order-1',
        FailURL: 'frendly://payment/fail?orderId=order-1',
        PayType: 'O',
      }),
    ).resolves.toMatchObject({
      Success: true,
      PaymentId: 'payment-1',
      PaymentURL: 'https://pay.test/form',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://securepay.test/v2/Init',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({
      TerminalKey: 'test-terminal',
      Amount: 1000,
      OrderId: 'order-1',
      PayType: 'O',
      Token: expect.any(String),
    });
    expect(body.Password).toBeUndefined();
  });
});
