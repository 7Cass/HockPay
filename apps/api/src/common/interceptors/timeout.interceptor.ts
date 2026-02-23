import {
  CallHandler,
  ExecutionContext,
  Injectable,
  RequestTimeoutException,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

/**
 * Interceptor that enforces a timeout on all HTTP requests.
 *
 * If a request takes longer than the specified timeout, a RequestTimeoutException
 * is thrown with a 408 status code.
 *
 * @example
 * ```typescript
 * // Use default 30s timeout
 * app.useGlobalInterceptors(new TimeoutInterceptor());
 *
 * // Use custom timeout
 * app.useGlobalInterceptors(new TimeoutInterceptor(10000)); // 10 seconds
 * ```
 */
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  private readonly timeoutMs: number;

  constructor(timeoutMs: number = 30000) {
    this.timeoutMs = timeoutMs;
  }

  intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      timeout(this.timeoutMs),
      catchError((error) => {
        // Convert RxJS TimeoutError to NestJS RequestTimeoutException
        if (error instanceof TimeoutError) {
          throw new RequestTimeoutException(
            `Request timeout after ${this.timeoutMs}ms`,
          );
        }
        throw error;
      }),
    );
  }
}
