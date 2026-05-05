import { FakePushProvider } from '../../src/push.providers';

describe('push provider logging', () => {
  it('does not log the full push token', async () => {
    const consoleLog = jest
      .spyOn(console, 'log')
      .mockImplementation(() => undefined);
    const sampleDeviceIdForMasking = 'sample-device-id-12345678';

    await new FakePushProvider().send({
      token: sampleDeviceIdForMasking,
      title: 'Title',
      body: 'Body',
    });

    expect(consoleLog).toHaveBeenCalledWith(
      '[fake-push]',
      expect.stringContaining('"token":"samp...5678"'),
    );
    expect(consoleLog.mock.calls[0]?.[1]).not.toContain(sampleDeviceIdForMasking);

    consoleLog.mockRestore();
  });
});
