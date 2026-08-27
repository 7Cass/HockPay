import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ExternalIdAlreadyExistsError } from '@hockpay/core';
import { Prisma } from '@hockpay/database';
import type { Response } from 'express';
import {
  getErrorCategory,
  getStatusCodeForError,
} from '../constants/error-codes';
import type { ErrorResponseDto } from '../dto/error-response.dto';

/**
 * Falhas do banco saem no mesmo envelope de erro de todo o resto da API.
 *
 * `PrismaClientUnknownRequestError` cobre o que o Prisma nao classifica —
 * `RAISE EXCEPTION` de trigger, constraint de exclusao, erro de conector. Sem
 * ele, essas falhas caiam no handler padrao do Nest e voltavam como
 * `{statusCode, message}` sem `code` e, pior, sem `requestId`: justamente o
 * que se procura no log quando um 500 aparece.
 *
 * A mensagem do Postgres fica no log do servidor, nunca na resposta.
 */
@Catch(
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientUnknownRequestError,
)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(
    exception:
      | Prisma.PrismaClientKnownRequestError
      | Prisma.PrismaClientUnknownRequestError,
    host: ArgumentsHost,
  ) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = (request as { id?: string }).id;
    const mapped =
      exception instanceof Prisma.PrismaClientKnownRequestError
        ? mapPrismaError(exception)
        : null;

    if (!mapped) {
      const code =
        exception instanceof Prisma.PrismaClientKnownRequestError
          ? exception.code
          : 'unknown';
      this.logger.error(`Unmapped Prisma error ${code}`, exception.stack);
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: {
          code: 'DATABASE_ERROR',
          message: 'An unexpected database error occurred',
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          timestamp: new Date().toISOString(),
          path: request.url,
          requestId,
        },
      } satisfies ErrorResponseDto);
      return;
    }

    const statusCode = getStatusCodeForError(mapped.code);
    response.status(statusCode).json({
      error: {
        code: mapped.code,
        message: mapped.message,
        statusCode,
        timestamp: new Date().toISOString(),
        path: request.url,
        requestId,
      },
    } satisfies ErrorResponseDto);

    this.logger.warn(`${mapped.code}: ${mapped.message}`, {
      requestId,
      category: getErrorCategory(mapped.code),
    });
  }
}

export function mapPrismaError(
  exception: Prisma.PrismaClientKnownRequestError,
): { code: string; message: string } | null {
  if (exception.code !== 'P2002') {
    return null;
  }

  const modelName = exception.meta?.modelName;
  const model = typeof modelName === 'string' ? modelName : '';
  const target = uniqueTarget(exception.meta?.target);

  if (
    model === 'Payment' ||
    target.includes('payments_store_id_environment_external_id')
  ) {
    const error = new ExternalIdAlreadyExistsError(extractExternalId(target));
    return { code: error.code, message: error.message };
  }

  if (
    model === 'IdempotencyKey' ||
    target.includes('idempotency_keys_key_store_id_environment')
  ) {
    return {
      code: 'IDEMPOTENCY_KEY_CONFLICT',
      message: 'Idempotency key was already used with a different request',
    };
  }

  return null;
}

function uniqueTarget(target: unknown): string {
  if (Array.isArray(target)) {
    return target.map(String).join(',').toLowerCase();
  }
  return typeof target === 'string' ? target.toLowerCase() : '';
}

function extractExternalId(target: string): string {
  return target.includes('external') ? 'externalId' : '';
}
