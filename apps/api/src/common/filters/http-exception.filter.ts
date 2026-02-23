import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

import type { ErrorResponseDto, ErrorDetail } from '../dto/error-response.dto';

/**
 * Exception filter for HTTP exceptions.
 *
 * Catches HttpException from NestJS (including BadRequestException,
 * NotFoundException, etc.) and formats them consistently.
 *
 * This filter serves as a fallback when controllers throw HTTP
 * exceptions directly instead of domain errors.
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const statusCode = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const requestId = (request as any).id as string | undefined;

    // Extract message and details from exception response
    let message: string;
    let code: string;
    let details: ErrorDetail[] | undefined;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
      code = this.getErrorCode(statusCode);
    } else if (typeof exceptionResponse === 'object') {
      const responseObj = exceptionResponse as Record<string, unknown>;

      // Check for custom error object format: { error: { code, message } }
      if (
        responseObj.error &&
        typeof responseObj.error === 'object' &&
        responseObj.error !== null
      ) {
        const customError = responseObj.error as Record<string, unknown>;
        code = (customError.code as string) || this.getErrorCode(statusCode);
        message = (customError.message as string) || exception.message;
        details = customError.details as ErrorDetail[] | undefined;
      } else {
        message = (responseObj.message as string) || exception.message;
        code = this.getErrorCode(statusCode);
        details = this.extractDetails(responseObj);
      }
    } else {
      message = exception.message;
      code = this.getErrorCode(statusCode);
    }

    const errorResponse: ErrorResponseDto = {
      error: {
        code,
        message: Array.isArray(message) ? message.join(', ') : message,
        statusCode,
        timestamp: new Date().toISOString(),
        path: request.url,
        details,
        requestId,
      },
    };

    // Log the error with structured data
    const logData = {
      requestId,
      error: {
        name: exception.name,
        message: errorResponse.error.message,
        statusCode,
        details,
      },
      request: {
        method: request.method,
        url: request.url,
        userAgent: request.headers['user-agent'],
      },
    };

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${exception.name}: ${errorResponse.error.message}`,
        exception.stack,
        logData,
      );
    } else if (statusCode >= HttpStatus.BAD_REQUEST) {
      this.logger.warn(
        `${exception.name} (${statusCode}): ${errorResponse.error.message}`,
        logData,
      );
    }

    response.status(statusCode).json(errorResponse);
  }

  /**
   * Extract validation details from exception response.
   * Handles class-validator error format.
   */
  private extractDetails(
    response: Record<string, unknown>,
  ): ErrorDetail[] | undefined {
    const message = response.message;

    // Class-validator validation errors format
    if (Array.isArray(message) && message.length > 0) {
      const firstItem = message[0];

      // Handle nested validation error format
      if (typeof firstItem === 'object' && firstItem !== null) {
        const details: ErrorDetail[] = [];

        for (const item of message) {
          if (typeof item === 'object' && item !== null) {
            // Handle class-validator format: { constraints: {}, property: "" }
            if ('constraints' in item) {
              const constraints = item.constraints as Record<string, string>;
              const property = (item.property as string) || 'unknown';

              for (const [, msg] of Object.entries(constraints)) {
                details.push({
                  field: property,
                  message: msg,
                });
              }
            }
            // Handle simple object format: { field, message }
            else if ('field' in item && 'message' in item) {
              details.push({
                field: item.field as string,
                message: item.message as string,
              });
            }
          }
        }

        return details.length > 0 ? details : undefined;
      }

      // Handle simple string array format
      if (typeof firstItem === 'string') {
        return message.map((msg, index) => {
          // Try to extract field name from message like "email must be valid"
          const match = msg.match(/^(\w+)\s+/);
          return {
            field: match ? match[1] : `field${index}`,
            message: msg,
          };
        });
      }
    }

    return undefined;
  }

  /**
   * Generate error code from HTTP status code.
   * Maps common HTTP statuses to application-specific error codes.
   */
  private getErrorCode(statusCode: number): string {
    const errorCodes: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'RATE_LIMIT_EXCEEDED',
      500: 'INTERNAL_SERVER_ERROR',
      502: 'BAD_GATEWAY',
      503: 'SERVICE_UNAVAILABLE',
      504: 'GATEWAY_TIMEOUT',
    };

    return errorCodes[statusCode] || 'HTTP_ERROR';
  }
}
