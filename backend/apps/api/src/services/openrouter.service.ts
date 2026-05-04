import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  OpenRouterClient,
  OpenRouterClientError,
  type OpenRouterClientOptions,
  type OpenRouterGenerateJsonInput,
  type OpenRouterGenerateJsonResult,
  parseOpenRouterJsonContent,
} from '@big-break/database';
import { ApiError } from '../common/api-error';

export type OpenRouterServiceOptions = OpenRouterClientOptions;
export type { OpenRouterGenerateJsonInput, OpenRouterGenerateJsonResult };
export { parseOpenRouterJsonContent };

export const OPENROUTER_SERVICE_OPTIONS = Symbol('OPENROUTER_SERVICE_OPTIONS');

@Injectable()
export class OpenRouterService {
  private readonly client: OpenRouterClient;

  constructor(
    @Optional()
    @Inject(OPENROUTER_SERVICE_OPTIONS)
    options: OpenRouterServiceOptions = {},
  ) {
    this.client = new OpenRouterClient(options);
  }

  get configuredModel() {
    return this.client.configuredModel;
  }

  async generateJson<T = unknown>(
    input: OpenRouterGenerateJsonInput,
  ): Promise<OpenRouterGenerateJsonResult<T>> {
    try {
      return await this.client.generateJson<T>(input);
    } catch (caught) {
      if (caught instanceof OpenRouterClientError) {
        throw new ApiError(caught.status, caught.code, caught.message);
      }
      throw caught;
    }
  }
}
