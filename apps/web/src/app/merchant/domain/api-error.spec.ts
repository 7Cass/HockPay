import { NETWORK_FAILURE, UNKNOWN_FAILURE, toApiFailure } from './api-error';

describe('falha da API', () => {
  it('lê o envelope dos filtros da API', () => {
    const failure = toApiFailure({
      status: 422,
      error: {
        error: {
          code: 'STORE_LIVE_NOT_ENABLED',
          message: 'Store is not enabled for LIVE',
          statusCode: 422,
          requestId: 'req_123',
        },
      },
    });

    expect(failure).toEqual({
      code: 'STORE_LIVE_NOT_ENABLED',
      message: 'Store is not enabled for LIVE',
      status: 422,
      requestId: 'req_123',
    });
  });

  it('trata status 0 como servidor que não respondeu', () => {
    // O `HttpErrorResponse` aqui traz "Unknown Error", que não ajuda ninguém.
    const failure = toApiFailure({ status: 0, message: 'Http failure response: Unknown Error' });

    expect(failure.code).toBe(NETWORK_FAILURE);
    expect(failure.status).toBe(0);
    expect(failure.message).toContain('não respondeu');
  });

  it('cai no fallback quando a resposta não tem o formato da casa', () => {
    const failure = toApiFailure({ status: 500, error: '<html>502 Bad Gateway</html>' }, 'Falhou.');

    expect(failure.code).toBe(UNKNOWN_FAILURE);
    expect(failure.message).toBe('Falhou.');
    expect(failure.status).toBe(500);
  });

  it('aproveita a mensagem solta quando só ela existe', () => {
    const failure = toApiFailure({ status: 400, message: 'Validation failed' });

    expect(failure.code).toBe(UNKNOWN_FAILURE);
    expect(failure.message).toBe('Validation failed');
  });

  it('não explode com o que não é objeto', () => {
    expect(toApiFailure(undefined).code).toBe(NETWORK_FAILURE);
    expect(toApiFailure('quebrou', 'Falhou.').code).toBe(NETWORK_FAILURE);
  });
});
