import { FakePushProvider } from '../../src/push.providers';

describe('push provider logging', () => {
  it('does not log the full push token', async () => {
    const consoleLog = jest
      .spyOn(console, 'log')
      .mockImplementation(() => undefined);
    const token = 'abcdef1234567890';

    await new FakePushProvider().send({
      token,
      title: 'Title',
      body: 'Body',
    });

    expect(consoleLog).toHaveBeenCalledWith(
      '[fake-push]',
      expect.stringContaining('"token":"abcd...7890"'),
    );
    expect(consoleLog.mock.calls[0]?.[1]).not.toContain(token);

    consoleLog.mockRestore();
  });
});
