import { ArgumentsHost } from '@nestjs/common';
import { ApiExceptionFilter } from '../../src/common/api-exception.filter';

function createHost(response: any, request: any = {}) {
  return {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as ArgumentsHost;
}

describe('ApiExceptionFilter unit', () => {
  it('does not write an error response after headers were sent', () => {
    const response = {
      headersSent: true,
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const request = {
      context: {
        requestId: 'req-1',
      },
    };
    const filter = new ApiExceptionFilter();

    filter.catch(new Error('late failure'), createHost(response, request));

    expect(response.status).not.toHaveBeenCalled();
    expect(response.json).not.toHaveBeenCalled();
  });
});
