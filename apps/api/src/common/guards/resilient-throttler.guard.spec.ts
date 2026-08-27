import { ThrottlerException, ThrottlerGuard } from '@nestjs/throttler';
import type { ThrottlerRequest } from '@nestjs/throttler';
import { ResilientThrottlerGuard } from './resilient-throttler.guard';

describe('ResilientThrottlerGuard', () => {
  const errorLog = jest.fn();

  function buildGuard(): ResilientThrottlerGuard {
    const guard = Object.create(
      ResilientThrottlerGuard.prototype,
    ) as ResilientThrottlerGuard;
    Object.defineProperty(guard, 'logger', { value: { error: errorLog } });
    return guard;
  }

  function handle(guard: ResilientThrottlerGuard): Promise<boolean> {
    return (
      guard as unknown as {
        handleRequest(props: ThrottlerRequest): Promise<boolean>;
      }
    ).handleRequest({} as ThrottlerRequest);
  }

  afterEach(() => {
    jest.restoreAllMocks();
    errorLog.mockClear();
  });

  it('lets the request through when the rate limit storage is unreachable', async () => {
    jest
      .spyOn(ThrottlerGuard.prototype as never, 'handleRequest')
      .mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:6379'));

    await expect(handle(buildGuard())).resolves.toBe(true);
    expect(errorLog).toHaveBeenCalledWith(
      expect.stringContaining('Rate limit storage unavailable'),
    );
  });

  it('still rejects a request that genuinely exceeded the limit', async () => {
    jest
      .spyOn(ThrottlerGuard.prototype as never, 'handleRequest')
      .mockRejectedValue(new ThrottlerException());

    await expect(handle(buildGuard())).rejects.toBeInstanceOf(
      ThrottlerException,
    );
  });

  it('passes through the allowed decision untouched', async () => {
    jest
      .spyOn(ThrottlerGuard.prototype as never, 'handleRequest')
      .mockResolvedValue(true as never);

    await expect(handle(buildGuard())).resolves.toBe(true);
  });
});
