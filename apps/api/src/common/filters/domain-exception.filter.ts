import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { DomainError } from '@hockpay/core';

import { getStatusCodeForError, getErrorCategory } from '../constants/error-codes';
import type { ErrorResponseDto } from '../dto/error-response.dto';

/**
 * Exception filter for domain errors.
 *
 * Catches DomainError exceptions from the core layer and translates them
 * into appropriate HTTP responses with semantic status codes.
 *
 * This filter handles business rule violations and ensures that clients
 * receive consistent, structured error responses.
 */
@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(exception: DomainError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const statusCode = getStatusCodeForError(exception.code);
    const category = getErrorCategory(exception.code);
    const requestId = (request as any).id as string | undefined;

    const errorResponse: ErrorResponseDto = {
      error: {
        code: exception.code,
        message: exception.message,
        statusCode,
        timestamp: new Date().toISOString(),
        path: request.url,
        requestId,
      },
    };

    // Log the error with structured data
    const logData = {
      requestId,
      error: {
        name: exception.name,
        code: exception.code,
        message: exception.message,
        category,
      },
      request: {
        method: request.method,
        url: request.url,
        userAgent: request.headers['user-agent'],
      },
    };

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${exception.name}: ${exception.message}`,
        exception.stack,
        logData,
      );
    } else {
      this.logger.warn(
        `${exception.name} (${exception.code}): ${exception.message}`,
        logData,
      );
    }

    response.status(statusCode).json(errorResponse);
  }
}
