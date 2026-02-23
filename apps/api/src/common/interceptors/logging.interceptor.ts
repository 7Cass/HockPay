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
import { randomUUID } from 'crypto';

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

    // Generate or retrieve request ID
    const requestId =
      (request.headers['x-request-id'] as string | undefined) || randomUUID();

    // Store request ID for use in filters
    (request as any).id = requestId;

    const startTime = Date.now();
    const { method, url, ip } = request;
    const userAgent = request.headers['user-agent'];

    // Sanitize body for logging (hide sensitive fields)
    const sanitizedBody = this.sanitizeBody(request.body);

    // Log incoming request
    this.logger.log({
      requestId,
      method,
      url,
      ip,
      userAgent,
      body: sanitizedBody,
      msg: 'Incoming request',
    });

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode;

          // Add request ID to response headers
          response.setHeader('X-Request-ID', requestId);

          // Log successful response
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

        // Add request ID to response headers if not already set
        if (!response.getHeader('X-Request-ID')) {
          response.setHeader('X-Request-ID', requestId);
        }

        // Log error
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

  /**
   * Sanitize request body to hide sensitive fields.
   */
  private sanitizeBody(body: any): any {
    if (!body) return undefined;

    const sensitiveFields = [
      'password',
      'confirmPassword',
      'currentPassword',
      'newPassword',
      'token',
      'accessToken',
      'refreshToken',
      'apiKey',
      'secret',
      'cardNumber',
      'cvv',
      'ssn',
    ];

    const sanitized = { ...body };

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}
