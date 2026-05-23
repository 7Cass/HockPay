import {
  ArgumentsHost,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  function makeHost(requestOverrides: Partial<any> = {}) {
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const request = {
      id: 'req-1',
      method: 'POST',
      url: '/api/v1/withdrawals',
      headers: { 'user-agent': 'jest' },
      ...requestOverrides,
    };

    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    } as unknown as ArgumentsHost;

    return { host, response, request };
  }

  it('preserves a top-level exception response code', () => {
    const filter = new HttpExceptionFilter();
    const { host, response } = makeHost();
    const exception = new ForbiddenException({
      statusCode: HttpStatus.FORBIDDEN,
      error: 'Forbidden',
      message:
        'No store selected or could not be determined from authentication context.',
      code: 'NO_CURRENT_STORE',
    });

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'NO_CURRENT_STORE',
          message:
            'No store selected or could not be determined from authentication context.',
          statusCode: HttpStatus.FORBIDDEN,
          path: '/api/v1/withdrawals',
          requestId: 'req-1',
        }),
      }),
    );
  });

  it('keeps generic forbidden exceptions mapped to FORBIDDEN', () => {
    const filter = new HttpExceptionFilter();
    const { host, response } = makeHost();

    filter.catch(new ForbiddenException('Forbidden resource'), host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'FORBIDDEN',
          message: 'Forbidden resource',
          statusCode: HttpStatus.FORBIDDEN,
        }),
      }),
    );
  });

  it('does not expose arbitrary top-level codes outside Nest HTTP shape', () => {
    const filter = new HttpExceptionFilter();
    const { host, response } = makeHost();
    const exception = new HttpException(
      {
        code: 'SLUG_ALREADY_EXISTS',
        message: 'Slug already exists',
      },
      HttpStatus.CONFLICT,
    );

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'CONFLICT',
          message: 'Slug already exists',
          statusCode: HttpStatus.CONFLICT,
        }),
      }),
    );
  });

  it('keeps nested custom error codes and details', () => {
    const filter = new HttpExceptionFilter();
    const { host, response } = makeHost();
    const details = [{ field: 'storeId', message: 'storeId is required' }];
    const exception = new HttpException(
      {
        error: {
          code: 'NESTED_CODE',
          message: 'Nested error message',
          details,
        },
      },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'NESTED_CODE',
          message: 'Nested error message',
          details,
          statusCode: HttpStatus.BAD_REQUEST,
        }),
      }),
    );
  });
});
