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

  it('supports per-call model, timeout and JSON schema response format', async () => {
    const rawResponse = {
      choices: [
        {
          message: {
            content: '{"steps":[{"externalContentItemId":"item-1"}]}',
          },
        },
      ],
    };
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(rawResponse),
      text: jest.fn(),
    });
    const service = new OpenRouterService({
      apiKey: 'test-key',
      model: 'default-model',
      timeoutMs: 30_000,
      fetchImpl,
    });

    await expect(
      service.generateJson({
        model: 'qwen/qwen3-next-80b-a3b-instruct:free',
        timeoutMs: 4500,
        systemPrompt: 'Generate a route draft.',
        userPrompt: 'Use these candidates.',
        responseFormat: {
          type: 'json_schema',
          json_schema: {
            name: 'route_steps',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                steps: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      externalContentItemId: { type: 'string' },
                    },
                    required: ['externalContentItemId'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['steps'],
              additionalProperties: false,
            },
          },
        },
      }),
    ).resolves.toMatchObject({
      model: 'qwen/qwen3-next-80b-a3b-instruct:free',
      parsedJson: {
        steps: [{ externalContentItemId: 'item-1' }],
      },
    });

    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.model).toBe('qwen/qwen3-next-80b-a3b-instruct:free');
    expect(body.response_format).toEqual(
      expect.objectContaining({
        type: 'json_schema',
        json_schema: expect.objectContaining({ name: 'route_steps' }),
      }),
    );
  });

  it('times out hung OpenRouter requests', async () => {
    jest.useFakeTimers();
    try {
      const fetchImpl = jest.fn((_url, _init) => new Promise<never>(() => undefined));
      const service = new OpenRouterService({
        apiKey: 'test-key',
        timeoutMs: 1000,
        fetchImpl,
      });

      const promise = service.generateJson({
        systemPrompt: 'Generate route drafts.',
        userPrompt: 'Use these venues.',
      });

      await Promise.resolve();
      jest.advanceTimersByTime(1000);

      await expect(promise).rejects.toMatchObject({
        statusCode: 504,
        code: 'openrouter_timeout',
      });
      expect(fetchImpl.mock.calls[0]?.[1].signal?.aborted).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });
});
