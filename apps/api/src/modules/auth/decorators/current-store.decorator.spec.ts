import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { resolveCurrentStore } from './current-store.decorator';

function makeContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;
}

describe('resolveCurrentStore', () => {
  it('returns the API key store id from the request context', () => {
    const storeId = resolveCurrentStore(
      makeContext({ store: { id: 'store-from-api-key' } }),
    );

    expect(storeId).toBe('store-from-api-key');
  });

  it('returns the JWT store id from the request context', () => {
    const storeId = resolveCurrentStore(
      makeContext({ user: { storeId: 'store-from-jwt' } }),
    );

    expect(storeId).toBe('store-from-jwt');
  });

  it('throws a structured 403 when no store is selected', () => {
    expect(() => resolveCurrentStore(makeContext({}))).toThrow(
      ForbiddenException,
    );

    try {
      resolveCurrentStore(makeContext({}));
    } catch (error) {
      const response = (error as ForbiddenException).getResponse();
      expect(response).toMatchObject({
        statusCode: 403,
        error: 'Forbidden',
        message:
          'No store selected or could not be determined from authentication context.',
        code: 'NO_CURRENT_STORE',
      });
    }
  });
});
