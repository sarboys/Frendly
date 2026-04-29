import {
  OpenRouterService,
  parseOpenRouterJsonContent,
} from '../../src/services/openrouter.service';

describe('OpenRouterService unit', () => {
  it('parses valid JSON content', () => {
    expect(parseOpenRouterJsonContent('{"routes":[{"title":"Кино без кино"}]}')).toEqual({
      routes: [{ title: 'Кино без кино' }],
    });
  });

  it('parses fenced JSON content', () => {
    expect(
      parseOpenRouterJsonContent('```json\n{"routes":[{"title":"Тихий центр"}]}\n```'),
    ).toEqual({
      routes: [{ title: 'Тихий центр' }],
    });
  });

  it('rejects invalid JSON content', () => {
    expect(() => parseOpenRouterJsonContent('routes: []')).toThrow(
      expect.objectContaining({
        code: 'openrouter_invalid_json',
      }),
    );
  });

  it('returns raw response and parsed JSON separately', async () => {
    const rawResponse = {
      choices: [
        {
          message: {
            content: '{"routes":[{"title":"Маршрут"}]}',
          },
        },
      ],
    };
    const service = new OpenRouterService({
      apiKey: 'test-key',
      model: 'test-model',
      fetchImpl: jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(rawResponse),
        text: jest.fn(),
      }),
    });

    await expect(
      service.generateJson({
        systemPrompt: 'Generate route drafts.',
        userPrompt: 'Use these venues.',
      }),
    ).resolves.toMatchObject({
      rawResponse,
      parsedJson: {
        routes: [{ title: 'Маршрут' }],
      },
      model: 'test-model',
    });
  });

  it('throws controlled error on network failure', async () => {
    const service = new OpenRouterService({
      apiKey: 'test-key',
      fetchImpl: jest.fn().mockRejectedValue(new Error('network failed')),
    });

    await expect(
      service.generateJson({
        systemPrompt: 'Generate route drafts.',
        userPrompt: 'Use these venues.',
      }),
    ).rejects.toMatchObject({
      code: 'openrouter_unavailable',
    });
  });
});
