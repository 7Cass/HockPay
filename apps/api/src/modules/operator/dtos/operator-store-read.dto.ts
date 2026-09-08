import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Environment, PaymentStatus, TransactionType } from '@hockpay/core';

/**
 * The environment an operator is investigating in.
 *
 * Required, with no default. A merchant resolves this from the session; the
 * operator has no session environment, because they do not operate one store,
 * they investigate several. An operator looking into a production incident who
 * silently receives the TEST ledger draws the wrong conclusion from correct
 * data, and nothing in the response says which environment they read.
 *
 * It appears only on the reads that are actually environment-scoped. Webhook
 * configs and their delivery logs are store-scoped, and demanding a parameter
 * those routes then ignore would be its own small lie.
 */
export class OperatorEnvironmentQueryDto {
  @IsEnum(Environment)
  environment!: Environment;
}

class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class OperatorListPaymentsQueryDto extends PaginationQueryDto {
  @IsEnum(Environment)
  environment!: Environment;

  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @IsOptional()
  @IsString()
  externalId?: string;
}

export class OperatorListTransactionsQueryDto extends PaginationQueryDto {
  @IsEnum(Environment)
  environment!: Environment;

  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;
}

export class OperatorListWebhookLogsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  configId?: string;

  @IsOptional()
  @IsEnum(['pending', 'delivered', 'failed'])
  status?: 'pending' | 'delivered' | 'failed';
}
