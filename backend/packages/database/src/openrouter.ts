export type OpenRouterFetchResponseLike = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
};

export type OpenRouterFetchLike = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
    signal?: AbortSignal;
  },
) => Promise<OpenRouterFetchResponseLike>;

export type OpenRouterGenerateJsonInput = {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
};

export type OpenRouterGenerateJsonResult<T = unknown> = {
  rawResponse: unknown;
  parsedJson: T;
  model: string;
  latencyMs: number;
};

export type OpenRouterClientOptions = {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: OpenRouterFetchLike;
};

export class OpenRouterClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'OpenRouterClientError';
  }
}

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_MODEL = 'qwen/qwen3-next-80b-a3b-instruct:free';
const DEFAULT_TIMEOUT_MS = 180_000;

export class OpenRouterClient {
  private readonly apiKey: string | null;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: OpenRouterFetchLike;

  constructor(options: OpenRouterClientOptions = {}) {
    this.apiKey = textOrNull(options.apiKey) ?? textOrNull(process.env.OPENROUTER_API_KEY);
    this.model = textOrNull(options.model) ?? textOrNull(process.env.OPENROUTER_MODEL) ?? DEFAULT_MODEL;
    this.baseUrl =
      textOrNull(options.baseUrl) ??
      textOrNull(process.env.OPENROUTER_BASE_URL) ??
      DEFAULT_BASE_URL;
    this.timeoutMs =
      positiveInteger(options.timeoutMs) ??
      positiveInteger(process.env.OPENROUTER_TIMEOUT_MS) ??
      DEFAULT_TIMEOUT_MS;
    this.fetchImpl =
      options.fetchImpl ??
      ((globalThis.fetch as unknown as OpenRouterFetchLike | undefined) ??
        unavailableFetch);
  }

  get configuredModel() {
    return this.model;
  }

  async generateJson<T = unknown>(
    input: OpenRouterGenerateJsonInput,
  ): Promise<OpenRouterGenerateJsonResult<T>> {
    if (!this.apiKey) {
      throw new OpenRouterClientError(
        503,
        'openrouter_unavailable',
        'OpenRouter API key is missing',
      );
    }

    const startedAt = Date.now();
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let timedOut = false;

    try {
      const operation = this.executeGenerateJson<T>(input, startedAt, controller.signal);
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          timedOut = true;
          controller.abort();
          reject(this.timeoutError());
        }, this.timeoutMs);
        timeout.unref?.();
      });

      return await Promise.race([operation, timeoutPromise]);
    } catch (caught) {
      if (caught instanceof OpenRouterClientError) {
        throw caught;
      }
      if (timedOut || isAbortError(caught)) {
        throw this.timeoutError();
      }
      throw new OpenRouterClientError(
        503,
        'openrouter_unavailable',
        'OpenRouter request failed',
      );
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }

  private async executeGenerateJson<T>(
    input: OpenRouterGenerateJsonInput,
    startedAt: number,
    signal: AbortSignal,
  ): Promise<OpenRouterGenerateJsonResult<T>> {
    const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        temperature: input.temperature ?? 0.4,
        max_tokens: input.maxTokens ?? 1800,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: [
              'Return strict JSON only.',
              'Do not invent real places.',
              'Use only approved venues and active offers provided in the prompt.',
              input.systemPrompt,
            ].join('\n'),
          },
          {
            role: 'user',
            content: input.userPrompt,
          },
        ],
      }),
      signal,
    });

    if (!response.ok) {
      throw new OpenRouterClientError(
        503,
        'openrouter_unavailable',
        `OpenRouter request failed with status ${response.status}`,
      );
    }

    const rawResponse = await response.json();
    const content = extractAssistantContent(rawResponse);
    return {
      rawResponse,
      parsedJson: parseOpenRouterJsonContent<T>(content),
      model: this.model,
      latencyMs: Date.now() - startedAt,
    };
  }

  private timeoutError() {
    return new OpenRouterClientError(
      504,
      'openrouter_timeout',
      `OpenRouter request timed out after ${this.timeoutMs}ms`,
    );
  }
}

export function parseOpenRouterJsonContent<T = unknown>(content: string): T {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const payload = fenced?.[1]?.trim() ?? trimmed;

  try {
    return JSON.parse(payload) as T;
  } catch {
    throw new OpenRouterClientError(
      502,
      'openrouter_invalid_json',
      'OpenRouter returned invalid JSON',
    );
  }
}

function extractAssistantContent(rawResponse: unknown) {
  if (!rawResponse || typeof rawResponse !== 'object') {
    throw new OpenRouterClientError(
      502,
      'openrouter_invalid_json',
      'OpenRouter response is empty',
    );
  }

  const choices = (rawResponse as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new OpenRouterClientError(
      502,
      'openrouter_invalid_json',
      'OpenRouter response choices are missing',
    );
  }

  const first = choices[0] as { message?: { content?: unknown } };
  const content = first.message?.content;
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    const parts = content
      .map((part) =>
        part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string'
          ? (part as { text: string }).text
          : '',
      )
      .filter(Boolean);
    if (parts.length > 0) {
      return parts.join('\n');
    }
  }

  throw new OpenRouterClientError(
    502,
    'openrouter_invalid_json',
    'OpenRouter response content is missing',
  );
}

function textOrNull(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function positiveInteger(value: unknown) {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number.parseInt(value, 10)
      : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isAbortError(value: unknown) {
  return value instanceof Error && value.name === 'AbortError';
}

async function unavailableFetch(): Promise<OpenRouterFetchResponseLike> {
  throw new Error('fetch_unavailable');
}
