import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import {
  getOrCreateRequestId,
  RESPONSE_REQUEST_ID_HEADER,
} from '../request-id';

/**
 * Interceptor for structured logging of HTTP requests and responses.
 *
 * Features:
 * - Generates unique request ID for tracing
 * - Adds X-Request-ID header to responses
 * - Logs incoming requests with method, URL, and sanitized body
 * - Logs successful responses with status and duration
 * - Logs errors with stack traces
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const requestId = getOrCreateRequestId(request);
    response.setHeader(RESPONSE_REQUEST_ID_HEADER, requestId);

    const startTime = Date.now();
    const { method, url, ip } = request;
    const userAgent = request.headers['user-agent'];

    this.logger.log({
      requestId,
      method,
      url,
      ip,
      userAgent,
      msg: 'Incoming request',
    });

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode;

          this.logger.log({
            requestId,
            method,
            url,
            statusCode,
            duration: `${duration}ms`,
            msg: 'Request completed',
          });
        },
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;

        if (!response.getHeader(RESPONSE_REQUEST_ID_HEADER)) {
          response.setHeader(RESPONSE_REQUEST_ID_HEADER, requestId);
        }

        this.logger.error({
          requestId,
          method,
          url,
          duration: `${duration}ms`,
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
          msg: 'Request failed',
        });

        return throwError(() => error);
      }),
    );
  }
}
